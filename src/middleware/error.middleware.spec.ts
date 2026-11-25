import logger from '../config/logger';
import errorMiddleware from './error.middleware';
import { mockRequest, mockResponse, jsonBody, statusCode } from '../test-utils/express-mocks';

jest.mock('../config/logger', () => ({
    __esModule: true,
    default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const originalEnv = process.env.NODE_ENV;

afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    jest.clearAllMocks();
});

const runWith = (err: Error & { statusCode?: number }) => {
    const res = mockResponse();
    errorMiddleware(err, mockRequest({ body: { token: 'raw-token-in-body' } }), res, jest.fn());
    return res;
};

describe('error.middleware (Step 12 release gate)', () => {
    test('in production a 500 returns a generic message, never the internal error text', () => {
        process.env.NODE_ENV = 'production';
        const res = runWith(new Error('relation "TestInvite" does not exist'));

        expect(statusCode(res)).toBe(500);
        expect(jsonBody(res)).toEqual({ success: false, message: 'Internal Server Error' });
        expect(JSON.stringify(jsonBody(res))).not.toContain('TestInvite');
    });

    test('in production the error log has no stack', () => {
        process.env.NODE_ENV = 'production';
        runWith(new Error('boom'));

        const [, meta] = (logger.error as jest.Mock).mock.calls[0];
        expect(meta).toEqual(expect.objectContaining({ name: 'Error', message: 'boom', statusCode: 500 }));
        expect(meta.stack).toBeUndefined();
    });

    test('the request body is never logged', () => {
        process.env.NODE_ENV = 'production';
        runWith(new Error('boom'));

        expect(JSON.stringify((logger.error as jest.Mock).mock.calls)).not.toContain('raw-token-in-body');
    });

    test('outside production the stack is written to the log, and the 500 keeps its message', () => {
        process.env.NODE_ENV = 'test';
        const res = runWith(new Error('details for developers'));

        const [, meta] = (logger.error as jest.Mock).mock.calls[0];
        expect(typeof meta.stack).toBe('string');
        expect(jsonBody(res).message).toBe('details for developers');
    });

    test('a client error keeps its status and message in production (only 5xx is generic)', () => {
        process.env.NODE_ENV = 'production';
        const err = Object.assign(new Error('Unexpected token } in JSON'), { statusCode: 400 });
        const res = runWith(err);

        expect(statusCode(res)).toBe(400);
        expect(jsonBody(res).message).toBe('Unexpected token } in JSON');
    });
});
