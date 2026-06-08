import { cacheGet, cacheSet, cacheDelete, withCache } from './cache';
import { getRedisClient, isRedisReady } from '../config/redis';

jest.mock('../config/redis');

const mockedIsReady = isRedisReady as jest.MockedFunction<typeof isRedisReady>;
const mockedGetClient = getRedisClient as jest.MockedFunction<typeof getRedisClient>;

// Minimal fake of the redis client surface the cache util touches.
const makeClient = () => ({
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    keys: jest.fn(),
});

describe('cache util', () => {
    describe('when Redis is unavailable (fail-open)', () => {
        beforeEach(() => {
            mockedIsReady.mockReturnValue(false);
            mockedGetClient.mockReturnValue(null);
        });

        test('cacheGet returns null without touching the client', async () => {
            await expect(cacheGet('k')).resolves.toBeNull();
        });

        test('cacheSet is a no-op', async () => {
            await expect(cacheSet('k', { a: 1 })).resolves.toBeUndefined();
        });

        test('withCache falls back to the producer', async () => {
            const producer = jest.fn().mockResolvedValue({ value: 42 });
            await expect(withCache('k', producer)).resolves.toEqual({ value: 42 });
            expect(producer).toHaveBeenCalledTimes(1);
        });
    });

    describe('when Redis is ready', () => {
        let client: ReturnType<typeof makeClient>;

        beforeEach(() => {
            client = makeClient();
            mockedIsReady.mockReturnValue(true);
            mockedGetClient.mockReturnValue(client as any);
        });

        test('cacheGet deserializes a stored JSON value', async () => {
            client.get.mockResolvedValue(JSON.stringify({ a: 1 }));
            await expect(cacheGet('k')).resolves.toEqual({ a: 1 });
            expect(client.get).toHaveBeenCalledWith('k');
        });

        test('cacheGet returns null on a miss', async () => {
            client.get.mockResolvedValue(null);
            await expect(cacheGet('k')).resolves.toBeNull();
        });

        test('cacheGet returns null on malformed JSON (fail-open)', async () => {
            client.get.mockResolvedValue('{not json');
            await expect(cacheGet('k')).resolves.toBeNull();
        });

        test('cacheSet serializes with a TTL', async () => {
            client.set.mockResolvedValue('OK');
            await cacheSet('k', { a: 1 }, 120);
            expect(client.set).toHaveBeenCalledWith('k', JSON.stringify({ a: 1 }), { EX: 120 });
        });

        test('cacheDelete removes the key', async () => {
            client.del.mockResolvedValue(1);
            await cacheDelete('k');
            expect(client.del).toHaveBeenCalledWith('k');
        });

        test('withCache returns a cache hit without calling the producer', async () => {
            client.get.mockResolvedValue(JSON.stringify({ cached: true }));
            const producer = jest.fn();
            await expect(withCache('k', producer)).resolves.toEqual({ cached: true });
            expect(producer).not.toHaveBeenCalled();
        });

        test('withCache populates the cache on a miss', async () => {
            client.get.mockResolvedValue(null);
            client.set.mockResolvedValue('OK');
            const producer = jest.fn().mockResolvedValue({ fresh: true });

            await expect(withCache('k', producer, 60)).resolves.toEqual({ fresh: true });
            expect(producer).toHaveBeenCalledTimes(1);
            expect(client.set).toHaveBeenCalledWith('k', JSON.stringify({ fresh: true }), { EX: 60 });
        });
    });
});
