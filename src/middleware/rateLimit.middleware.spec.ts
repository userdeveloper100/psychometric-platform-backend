import { Request, Response, NextFunction } from 'express';
import { createRateLimiter } from './rateLimit.middleware';
import { getRedisClient, isRedisReady } from '../config/redis';

jest.mock('../config/redis');

const mockedIsReady = isRedisReady as jest.MockedFunction<typeof isRedisReady>;
const mockedGetClient = getRedisClient as jest.MockedFunction<typeof getRedisClient>;

const makeClient = () => ({
    incr: jest.fn(),
    expire: jest.fn(),
    ttl: jest.fn(),
});

const makeReqRes = () => {
    const req = { ip: '1.2.3.4', headers: {} } as unknown as Request;
    const res = {
        setHeader: jest.fn(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
    } as unknown as Response;
    const next = jest.fn() as unknown as NextFunction;
    return { req, res, next };
};

describe('createRateLimiter', () => {
    const limiter = createRateLimiter({ windowSeconds: 60, max: 2, keyPrefix: 'test' });

    test('fails open (calls next) when Redis is unavailable', async () => {
        mockedIsReady.mockReturnValue(false);
        mockedGetClient.mockReturnValue(null);
        const { req, res, next } = makeReqRes();

        await limiter(req, res, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(res.status).not.toHaveBeenCalled();
    });

    describe('with Redis ready', () => {
        let client: ReturnType<typeof makeClient>;

        beforeEach(() => {
            client = makeClient();
            mockedIsReady.mockReturnValue(true);
            mockedGetClient.mockReturnValue(client as any);
            client.ttl.mockResolvedValue(60);
        });

        test('allows a request under the limit and sets headers', async () => {
            client.incr.mockResolvedValue(1);
            client.expire.mockResolvedValue(true);
            const { req, res, next } = makeReqRes();

            await limiter(req, res, next);

            expect(client.expire).toHaveBeenCalledWith('ratelimit:test:1.2.3.4', 60);
            expect(res.setHeader).toHaveBeenCalledWith('RateLimit-Limit', 2);
            expect(res.setHeader).toHaveBeenCalledWith('RateLimit-Remaining', 1);
            expect(next).toHaveBeenCalledTimes(1);
        });

        test('does not reset expiry on subsequent requests in the window', async () => {
            client.incr.mockResolvedValue(2);
            const { req, res, next } = makeReqRes();

            await limiter(req, res, next);

            expect(client.expire).not.toHaveBeenCalled();
            expect(next).toHaveBeenCalledTimes(1);
        });

        test('blocks with 429 when the limit is exceeded', async () => {
            client.incr.mockResolvedValue(3); // max is 2
            const { req, res, next } = makeReqRes();

            await limiter(req, res, next);

            expect(next).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(429);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    error: expect.objectContaining({ code: 'RATE_LIMIT_EXCEEDED' }),
                })
            );
        });

        test('fails open when a Redis operation throws', async () => {
            client.incr.mockRejectedValue(new Error('redis down'));
            const { req, res, next } = makeReqRes();

            await limiter(req, res, next);

            expect(next).toHaveBeenCalledTimes(1);
            expect(res.status).not.toHaveBeenCalled();
        });
    });
});
