import { authorizeRoles } from './role.middleware';
import { mockRequest, mockResponse, statusCode } from '../test-utils/express-mocks';

const run = (user: unknown, roles: string[] = ['ADMIN']) => {
    const req = mockRequest(user === undefined ? {} : { user });
    const res = mockResponse();
    const next = jest.fn();
    authorizeRoles(...roles)(req as any, res, next);
    return { next, res };
};

describe('authorizeRoles (SEC-02 reusable role check)', () => {
    test('no authenticated user returns 401 and does not call next', () => {
        const { next, res } = run(undefined);
        expect(statusCode(res)).toBe(401);
        expect(next).not.toHaveBeenCalled();
    });

    test('a STUDENT is refused with 403 when only ADMIN is permitted', () => {
        const { next, res } = run({ userId: 'u1', role: 'STUDENT', instituteId: 'i1' });
        expect(statusCode(res)).toBe(403);
        expect(next).not.toHaveBeenCalled();
    });

    test('an ADMIN passes through', () => {
        const { next, res } = run({ userId: 'u1', role: 'ADMIN', instituteId: 'i1' });
        expect(next).toHaveBeenCalledTimes(1);
        expect(res.status).not.toHaveBeenCalled();
    });

    test('the check uses the permitted list, so an unlisted role is refused', () => {
        const { next, res } = run({ userId: 'u1', role: 'STUDENT' }, ['ADMIN', 'STUDENT']);
        expect(next).toHaveBeenCalledTimes(1);
        expect(res.status).not.toHaveBeenCalled();
    });
});
