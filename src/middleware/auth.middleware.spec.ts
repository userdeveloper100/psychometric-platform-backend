import jwt from 'jsonwebtoken';
import { authenticateJWT } from './auth.middleware';
import { env } from '../config/env';
import { generateToken } from '../utils/jwt';
import { mockRequest, mockResponse, statusCode } from '../test-utils/express-mocks';

const payload = { userId: 'u1', role: 'ADMIN', instituteId: 'i1' };

const runMiddleware = (authorization?: string) => {
    const req = mockRequest({ headers: authorization === undefined ? {} : { authorization } });
    const res = mockResponse();
    const next = jest.fn();
    authenticateJWT(req as any, res, next);
    return { next, res };
};

describe('authenticateJWT: accepted tokens', () => {
    test('accepts a token issued by utils/jwt (SEC-07: both sides use the same configured secret)', () => {
        // Load both modules into a fresh registry, so each reads the configured secret at import time.
        let accepted = false;
        jest.isolateModules(() => {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const jwtUtil = require('../utils/jwt');
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const middleware = require('./auth.middleware');
            const token: string = jwtUtil.generateToken(payload);
            const { next } = runMiddlewareWith(middleware.authenticateJWT, `Bearer ${token}`);
            accepted = next.mock.calls.length === 1;
        });
        expect(accepted).toBe(true);
    });

    test('accepts a token issued by generateToken and attaches the decoded user', () => {
        const token = generateToken(payload);
        const req = mockRequest({ headers: { authorization: `Bearer ${token}` } });
        const next = jest.fn();
        authenticateJWT(req as any, mockResponse(), next);
        expect(next).toHaveBeenCalledTimes(1);
        expect((req as any).user).toMatchObject({ userId: 'u1', role: 'ADMIN' });
    });
});

describe('authenticateJWT: rejected tokens (401)', () => {
    test('missing Authorization header', () => {
        const { next, res } = runMiddleware(undefined);
        expect(statusCode(res)).toBe(401);
        expect(next).not.toHaveBeenCalled();
    });

    test('malformed header scheme (not Bearer)', () => {
        const { next, res } = runMiddleware(`Basic ${generateToken(payload)}`);
        expect(statusCode(res)).toBe(401);
        expect(next).not.toHaveBeenCalled();
    });

    test('Bearer with no token value', () => {
        const { next, res } = runMiddleware('Bearer ');
        expect(statusCode(res)).toBe(401);
        expect(next).not.toHaveBeenCalled();
    });

    test('not a JWT at all', () => {
        const { next, res } = runMiddleware('Bearer not-a-jwt');
        expect(statusCode(res)).toBe(401);
        expect(next).not.toHaveBeenCalled();
    });

    test('expired token', () => {
        const expired = jwt.sign({ ...payload, exp: Math.floor(Date.now() / 1000) - 60 }, env.JWT_SECRET);
        const { next, res } = runMiddleware(`Bearer ${expired}`);
        expect(statusCode(res)).toBe(401);
        expect(next).not.toHaveBeenCalled();
    });

    test('token signed with a different secret', () => {
        const forged = jwt.sign(payload, 'x'.repeat(MIN_LENGTH_FOR_TEST));
        const { next, res } = runMiddleware(`Bearer ${forged}`);
        expect(statusCode(res)).toBe(401);
        expect(next).not.toHaveBeenCalled();
    });

    test('tampered payload with the original signature', () => {
        const token = generateToken(payload);
        const [header, , signature] = token.split('.');
        const forgedPayload = Buffer.from(JSON.stringify({ ...payload, role: 'SUPER' })).toString('base64url');
        const { next, res } = runMiddleware(`Bearer ${header}.${forgedPayload}.${signature}`);
        expect(statusCode(res)).toBe(401);
        expect(next).not.toHaveBeenCalled();
    });
});

const MIN_LENGTH_FOR_TEST = 40;

// Helper for the isolated-registry test: runs a given middleware function.
function runMiddlewareWith(middleware: typeof authenticateJWT, authorization: string) {
    const req = mockRequest({ headers: { authorization } });
    const res = mockResponse();
    const next = jest.fn();
    middleware(req as any, res, next);
    return { next, res };
}
