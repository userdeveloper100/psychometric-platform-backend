/**
 * Redis client (graceful / fail-open).
 *
 * The client is created lazily via connectRedis() — typically from server.ts.
 * It NEVER throws on connection failure: if Redis is unreachable the app keeps
 * running and all Redis-backed features (cache, rate limiting) degrade to no-ops.
 * Consumers must guard with isRedisReady() before using getRedisClient().
 */

import { createClient } from 'redis';

type RedisClient = ReturnType<typeof createClient>;

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

let client: RedisClient | null = null;
let ready = false;

export const isRedisReady = (): boolean => ready;

export const getRedisClient = (): RedisClient | null => client;

/**
 * Create and connect the Redis client. Non-fatal: resolves even if the
 * connection fails, leaving Redis features disabled (isRedisReady() === false).
 */
export const connectRedis = async (): Promise<void> => {
    if (client) return;

    client = createClient({
        url: REDIS_URL,
        socket: {
            // Stop retrying after 5 attempts when Redis is absent, so we don't
            // flood logs with reconnect errors in environments without Redis.
            reconnectStrategy: (retries: number) =>
                retries > 5 ? false : Math.min(retries * 200, 2000),
        },
    });

    client.on('ready', () => {
        ready = true;
        console.log('Redis connected');
    });

    client.on('error', (err: Error) => {
        ready = false;
        // Log once-ish; node-redis emits on every failed reconnect.
        console.warn(`Redis unavailable: ${err.message}`);
    });

    client.on('end', () => {
        ready = false;
    });

    try {
        await client.connect();
    } catch (err) {
        ready = false;
        console.warn('Redis connection failed — continuing without cache/rate-limit.');
    }
};

export const disconnectRedis = async (): Promise<void> => {
    if (!client) return;
    try {
        await client.quit();
    } catch {
        // ignore — best effort on shutdown
    } finally {
        client = null;
        ready = false;
    }
};
