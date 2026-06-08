/**
 * Redis-backed fixed-window rate limiter (fail-open).
 *
 * Keys requests by authenticated userId, falling back to client IP. When Redis
 * is unavailable the limiter allows the request through (availability over
 * enforcement), so it never becomes a single point of failure.
 */

import { Request, Response, NextFunction } from 'express';
import { getRedisClient, isRedisReady } from '../config/redis';
import { errorResponse } from '../utils/response-helpers';
import { ErrorCode } from '../types/api-response.types';
import { AuthRequest } from './auth.middleware';

export interface RateLimitOptions {
    /** Window length in seconds. */
    windowSeconds: number;
    /** Maximum requests allowed per key within the window. */
    max: number;
    /** Namespace so different limiters don't share counters. */
    keyPrefix?: string;
}

const resolveClientId = (req: Request): string => {
    const userId = (req as AuthRequest).user?.userId;
    return userId || req.ip || 'unknown';
};

export const createRateLimiter = (options: RateLimitOptions) => {
    const { windowSeconds, max, keyPrefix = 'global' } = options;

    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        // Fail-open: no Redis, no limiting.
        if (!isRedisReady()) {
            return next();
        }

        const key = `ratelimit:${keyPrefix}:${resolveClientId(req)}`;

        try {
            const client = getRedisClient()!;
            const count = await client.incr(key);

            if (count === 1) {
                await client.expire(key, windowSeconds);
            }

            const ttl = await client.ttl(key);

            res.setHeader('RateLimit-Limit', max);
            res.setHeader('RateLimit-Remaining', Math.max(0, max - count));
            res.setHeader('RateLimit-Reset', ttl >= 0 ? ttl : windowSeconds);

            if (count > max) {
                errorResponse(
                    res,
                    ErrorCode.RATE_LIMIT_EXCEEDED,
                    'Too many requests, please try again later.',
                    { retryAfter: ttl >= 0 ? ttl : windowSeconds }
                );
                return;
            }

            return next();
        } catch {
            // Fail-open on any Redis error.
            return next();
        }
    };
};

/** General limiter for the whole API. */
export const globalRateLimiter = createRateLimiter({
    windowSeconds: 60,
    max: 100,
    keyPrefix: 'global',
});

/** Stricter limiter for auth endpoints (brute-force protection). */
export const authRateLimiter = createRateLimiter({
    windowSeconds: 60,
    max: 10,
    keyPrefix: 'auth',
});
