import jwt from 'jsonwebtoken';
import logger from '../config/logger';
import { env } from '../config/env';
import { authenticateJWT } from './auth.middleware';
import { authorizeRoles } from './role.middleware';
import { mockRequest, mockResponse, statusCode } from '../test-utils/express-mocks';

jest.mock('../config/logger', () => ({
    __esModule: true,
    default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const warnings = () => (logger.warn as jest.Mock).mock.calls;
const loggedEntry = (index = 0) => warnings()[index]?.[1];
const allLogged = () => JSON.stringify(warnings());

beforeEach(() => {
    jest.clearAllMocks();
});

describe('security events: auth_failed (authenticateJWT)', () => {
    const run = (authorization?: string) => {
        const req = mockRequest({ headers: authorization === undefined ? {} : { authorization } });
        const res = mockResponse();
        const next = jest.fn();
        authenticateJWT(req as any, res, next);
        return { res, next };
    };

    test('a missing Authorization header logs reason "missing" and keeps the 401 body', () => {
        const { res } = run();
        expect(statusCode(res)).toBe(401);
        expect(loggedEntry()).toEqual(expect.objectContaining({ event: 'auth_failed', reason: 'missing' }));
    });

    test('a header that is not "Bearer <token>" logs reason "malformed"', () => {
        run('Basic dXNlcjpwYXNz');
        expect(loggedEntry()).toEqual(expect.objectContaining({ event: 'auth_failed', reason: 'malformed' }));
    });

    test('"Bearer" with no token logs reason "malformed"', () => {
        run('Bearer ');
        expect(loggedEntry()).toEqual(expect.objectContaining({ event: 'auth_failed', reason: 'malformed' }));
    });

    test('an expired token logs reason "expired"', () => {
        const expired = jwt.sign({ userId: 'u1', role: 'ADMIN', instituteId: 'i1' }, env.JWT_SECRET, { expiresIn: -10 });
        const { res } = run(`Bearer ${expired}`);
        expect(statusCode(res)).toBe(401);
        expect(loggedEntry()).toEqual(expect.objectContaining({ event: 'auth_failed', reason: 'expired' }));
    });

    test('a token signed with another secret logs reason "invalid"', () => {
        const forged = jwt.sign({ userId: 'u1', role: 'ADMIN', instituteId: 'i1' }, 'another-secret-value-of-sufficient-length-here');
        run(`Bearer ${forged}`);
        expect(loggedEntry()).toEqual(expect.objectContaining({ event: 'auth_failed', reason: 'invalid' }));
    });

    test('no token, the JWT string and the Authorization header are never written to the log', () => {
        const token = jwt.sign({ userId: 'u1', role: 'ADMIN', instituteId: 'i1' }, 'another-secret-value-of-sufficient-length-here');
        run(`Bearer ${token}`);
        run('Bearer not.a.jwt');
        run();

        expect(warnings().length).toBe(3);
        expect(allLogged()).not.toContain(token);
        expect(allLogged()).not.toContain('Bearer');
        expect(allLogged()).not.toContain('not.a.jwt');
    });
});

describe('security events: authorization_denied and auth_failed (authorizeRoles)', () => {
    const run = (req: unknown) => {
        const res = mockResponse();
        const next = jest.fn();
        authorizeRoles('ADMIN')(req as any, res, next);
        return { res, next };
    };

    test('a STUDENT on an ADMIN route logs authorization_denied with the verified fields and the route template', () => {
        const req = mockRequest({
            method: 'DELETE',
            baseUrl: '/api/tests',
            route: { path: '/:id' },
            params: { id: 'test-123' },
            user: { userId: 'u9', role: 'STUDENT', instituteId: 'i1' },
            headers: { authorization: 'Bearer secret.jwt.value' },
        });

        const { res, next } = run(req);

        expect(statusCode(res)).toBe(403);
        expect(next).not.toHaveBeenCalled();
        expect(loggedEntry()).toEqual({
            event: 'authorization_denied',
            timestamp: expect.any(String),
            userId: 'u9',
            instituteId: 'i1',
            role: 'STUDENT',
            action: 'DELETE /api/tests/:id',
            reason: 'role_not_permitted',
        });
        expect(allLogged()).not.toContain('secret.jwt.value');
    });

    test('a request with no verified user logs auth_failed and returns the existing 401', () => {
        const { res } = run(mockRequest({ method: 'GET', baseUrl: '/api/users' }));
        expect(statusCode(res)).toBe(401);
        expect(loggedEntry()).toEqual(expect.objectContaining({ event: 'auth_failed', reason: 'no_authenticated_user' }));
    });

    test('an allowed role is passed through and logs nothing', () => {
        const { next } = run(mockRequest({ user: { userId: 'u1', role: 'ADMIN', instituteId: 'i1' } }));
        expect(next).toHaveBeenCalledTimes(1);
        expect(warnings().length).toBe(0);
    });
});
