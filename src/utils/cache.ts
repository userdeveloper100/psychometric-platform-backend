/**
 * Cache helpers (fail-open).
 *
 * Every function silently no-ops / returns null when Redis is unavailable, so
 * callers can wrap reads in caching without changing behaviour when Redis is
 * down. Values are JSON-serialized.
 */

import { getRedisClient, isRedisReady } from '../config/redis';

const DEFAULT_TTL_SECONDS = 300; // 5 minutes

/**
 * Read and deserialize a cached value. Returns null on miss, parse error, or
 * when Redis is unavailable.
 */
export const cacheGet = async <T>(key: string): Promise<T | null> => {
    if (!isRedisReady()) return null;
    try {
        const raw = await getRedisClient()!.get(key);
        return raw ? (JSON.parse(raw) as T) : null;
    } catch {
        return null;
    }
};

/**
 * Serialize and store a value with a TTL. No-op when Redis is unavailable.
 */
export const cacheSet = async (
    key: string,
    value: unknown,
    ttlSeconds: number = DEFAULT_TTL_SECONDS
): Promise<void> => {
    if (!isRedisReady()) return;
    try {
        await getRedisClient()!.set(key, JSON.stringify(value), { EX: ttlSeconds });
    } catch {
        // fail-open: caching is best-effort
    }
};

/**
 * Delete a single cache key. No-op when Redis is unavailable.
 */
export const cacheDelete = async (key: string): Promise<void> => {
    if (!isRedisReady()) return;
    try {
        await getRedisClient()!.del(key);
    } catch {
        // fail-open
    }
};

/**
 * Delete all keys matching a glob pattern (e.g. "dimensions:test:*").
 * No-op when Redis is unavailable.
 */
export const cacheDeleteByPattern = async (pattern: string): Promise<void> => {
    if (!isRedisReady()) return;
    try {
        const client = getRedisClient()!;
        const keys = await client.keys(pattern);
        if (keys.length) {
            await client.del(keys);
        }
    } catch {
        // fail-open
    }
};

/**
 * Read-through cache: return the cached value if present, otherwise run the
 * producer, cache its result, and return it. Falls back to the producer when
 * Redis is unavailable.
 */
export const withCache = async <T>(
    key: string,
    producer: () => Promise<T>,
    ttlSeconds: number = DEFAULT_TTL_SECONDS
): Promise<T> => {
    const cached = await cacheGet<T>(key);
    if (cached !== null) return cached;

    const fresh = await producer();
    await cacheSet(key, fresh, ttlSeconds);
    return fresh;
};
