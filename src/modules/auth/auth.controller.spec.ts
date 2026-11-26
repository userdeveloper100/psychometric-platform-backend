import * as authController from './auth.controller';
import * as authService from './auth.service';
import { mockRequest, mockResponse, jsonBody, statusCode } from '../../test-utils/express-mocks';

jest.mock('./auth.service');
jest.mock('../../config/prisma', () => ({
    __esModule: true,
    default: { user: { count: jest.fn().mockResolvedValue(2) } },
}));

const svc = authService as jest.Mocked<typeof authService>;

describe('auth.controller', () => {
    describe('register (DEC-02: public registration disabled)', () => {
        test('403 for an uninvited registration, with the invitation message', async () => {
            const req = mockRequest({ body: { instituteName: 'Acme', email: 'a@b.com', password: 'pw' } });
            const res = mockResponse();

            await authController.register(req, res);

            expect(statusCode(res)).toBe(403);
            expect(jsonBody(res).message).toBe('Public registration is disabled. An invitation is required.');
        });

        test('403 even for a complete body, and no account or institute is created', async () => {
            const req = mockRequest({
                body: { instituteName: 'Acme', email: 'a@b.com', password: 'pw' },
                user: { userId: 'u1', role: 'ADMIN', instituteId: 'i1' },
            });
            const res = mockResponse();

            await authController.register(req, res);

            expect(statusCode(res)).toBe(403);
            expect(svc.createUserInvite).not.toHaveBeenCalled();
            expect(svc.acceptUserInvite).not.toHaveBeenCalled();
        });
    });

    describe('createUserInvite (DEC-02)', () => {
        const adminReq = (body: Record<string, unknown>, instituteId = 'i1') =>
            mockRequest({ body, user: { userId: 'u1', role: 'ADMIN', instituteId } });

        test('201 with the raw token once, scoped to the token institute, ignoring a body instituteId', async () => {
            svc.createUserInvite.mockResolvedValue({
                invite: { id: 'inv1', email: 't@b.com', role: 'ADMIN', expiresAt: new Date() },
                token: 'raw-token-once',
            } as any);
            const req = adminReq({ email: 't@b.com', role: 'ADMIN', instituteId: 'i2' });
            const res = mockResponse();

            await authController.createUserInvite(req, res);

            expect(statusCode(res)).toBe(201);
            expect(jsonBody(res).data.token).toBe('raw-token-once');
            expect(svc.createUserInvite).toHaveBeenCalledWith(
                expect.objectContaining({ instituteId: 'i1', createdBy: 'u1', email: 't@b.com', role: 'ADMIN' })
            );
        });

        test('defaults expiresAt to about 7 days ahead when it is omitted', async () => {
            svc.createUserInvite.mockResolvedValue({ invite: { id: 'inv1' }, token: 't' } as any);
            const res = mockResponse();

            await authController.createUserInvite(adminReq({ email: 't@b.com', role: 'STUDENT' }), res);

            const { expiresAt } = svc.createUserInvite.mock.calls[0][0];
            const days = (expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
            expect(days).toBeGreaterThan(6.9);
            expect(days).toBeLessThan(7.1);
        });

        test('403 for a SUPER_ADMIN invite (privilege escalation), with no service call', async () => {
            const res = mockResponse();

            await authController.createUserInvite(adminReq({ email: 't@b.com', role: 'SUPER_ADMIN' }), res);

            expect(statusCode(res)).toBe(403);
            expect(svc.createUserInvite).not.toHaveBeenCalled();
        });

        test.each(['RECRUITER', 'EVALUATOR', 'ADMIN', 'STUDENT'])('%s can be invited (201 path reaches the service)', async (role) => {
            svc.createUserInvite.mockResolvedValue({ invite: { id: 'inv1' }, token: 't' } as any);
            const res = mockResponse();

            await authController.createUserInvite(adminReq({ email: 't@b.com', role }), res);

            expect(statusCode(res)).toBe(201);
        });

        test('403 when the token has no institute (fails closed, no service call)', async () => {
            const res = mockResponse();

            await authController.createUserInvite(adminReq({ email: 't@b.com', role: 'ADMIN' }, ''), res);

            expect(statusCode(res)).toBe(403);
            expect(svc.createUserInvite).not.toHaveBeenCalled();
        });

        test.each([
            ['a missing email', { role: 'ADMIN' }],
            ['a malformed email', { email: 'not-an-email', role: 'ADMIN' }],
            ['an unknown role', { email: 't@b.com', role: 'OWNER' }],
            ['a past expiry', { email: 't@b.com', role: 'ADMIN', expiresAt: '2000-01-01T00:00:00.000Z' }],
            ['an expiry beyond 30 days', { email: 't@b.com', role: 'ADMIN', expiresAt: '2999-01-01T00:00:00.000Z' }],
            ['an unparseable expiry', { email: 't@b.com', role: 'ADMIN', expiresAt: 'soon' }],
        ])('400 for %s', async (_label, body) => {
            const res = mockResponse();

            await authController.createUserInvite(adminReq(body), res);

            expect(statusCode(res)).toBe(400);
            expect(svc.createUserInvite).not.toHaveBeenCalled();
        });
    });

    describe('listUserInvites and revokeUserInvite (DEC-02)', () => {
        test('200 with the list scoped to the token institute, and no token field in the response', async () => {
            svc.listUserInvites.mockResolvedValue([{ id: 'inv1', email: 't@b.com', role: 'ADMIN' }] as any);
            svc.countUserInvites.mockResolvedValue(1);
            const req = mockRequest({ query: {}, user: { userId: 'u1', role: 'ADMIN', instituteId: 'i1' } });
            const res = mockResponse();

            await authController.listUserInvites(req, res);

            expect(statusCode(res)).toBe(200);
            expect(svc.listUserInvites).toHaveBeenCalledWith(expect.objectContaining({ instituteId: 'i1' }));
            expect(JSON.stringify(jsonBody(res))).not.toMatch(/tokenHash|"token"/);
        });

        test('200 when revoking an invite of the token institute', async () => {
            svc.revokeUserInvite.mockResolvedValue({ id: 'inv1' } as any);
            const req = mockRequest({
                params: { id: 'inv1' },
                user: { userId: 'u1', role: 'ADMIN', instituteId: 'i1' },
            });
            const res = mockResponse();

            await authController.revokeUserInvite(req, res);

            expect(statusCode(res)).toBe(200);
            expect(svc.revokeUserInvite).toHaveBeenCalledWith({ id: 'inv1', adminId: 'u1', instituteId: 'i1' });
        });

        test('404 when the invite is foreign, missing or already used (the service reports not found)', async () => {
            svc.revokeUserInvite.mockRejectedValue(new Error('Invite not found'));
            const req = mockRequest({
                params: { id: 'inv-of-b' },
                user: { userId: 'u1', role: 'ADMIN', instituteId: 'i1' },
            });
            const res = mockResponse();

            await authController.revokeUserInvite(req, res);

            expect(statusCode(res)).toBe(404);
        });
    });

    describe('acceptUserInvite (DEC-02)', () => {
        test('201 with the created user on a valid invite', async () => {
            svc.acceptUserInvite.mockResolvedValue({ id: 'u9', email: 't@b.com', role: 'ADMIN', instituteId: 'i1' } as any);
            const req = mockRequest({ body: { token: 'valid-token', name: 'Jane', password: 'pw-123' } });
            const res = mockResponse();

            await authController.acceptUserInvite(req, res);

            expect(statusCode(res)).toBe(201);
            expect(svc.acceptUserInvite).toHaveBeenCalledWith({ token: 'valid-token', password: 'pw-123' });
        });

        test('400 for a missing token, name or password, with no service call', async () => {
            const res = mockResponse();

            await authController.acceptUserInvite(mockRequest({ body: { token: 'x', password: 'pw' } }), res);

            expect(statusCode(res)).toBe(400);
            expect(svc.acceptUserInvite).not.toHaveBeenCalled();
        });

        test('one generic 400 for every refused invite, and the token is not echoed', async () => {
            svc.acceptUserInvite.mockRejectedValue(new Error('Invite is invalid or no longer usable'));
            const req = mockRequest({ body: { token: 'secret-token-value', name: 'Jane', password: 'pw' } });
            const res = mockResponse();

            await authController.acceptUserInvite(req, res);

            expect(statusCode(res)).toBe(400);
            expect(jsonBody(res).message).toBe('Invite is invalid or no longer usable');
            expect(JSON.stringify(jsonBody(res))).not.toContain('secret-token-value');
        });
    });

    describe('login', () => {
        test('200 on success', async () => {
            svc.login.mockResolvedValue({ token: 'tok' } as any);
            const req = mockRequest({ body: { email: 'a@b.com', password: 'pw' } });
            const res = mockResponse();

            await authController.login(req, res);

            expect(statusCode(res)).toBe(200);
            expect(jsonBody(res).success).toBe(true);
        });

        test('400 when credentials missing', async () => {
            const req = mockRequest({ body: {} });
            const res = mockResponse();

            await authController.login(req, res);

            expect(statusCode(res)).toBe(400);
        });

        test('401 on invalid credentials', async () => {
            svc.login.mockRejectedValue(new Error('Invalid credentials'));
            const req = mockRequest({ body: { email: 'a@b.com', password: 'bad' } });
            const res = mockResponse();

            await authController.login(req, res);

            expect(statusCode(res)).toBe(401);
        });
    });

    describe('getAllUsers', () => {
        test('403 for non-admin', async () => {
            const req = mockRequest({ user: { userId: 'u1', role: 'STUDENT' } });
            const res = mockResponse();

            await authController.getAllUsers(req, res);

            expect(statusCode(res)).toBe(403);
        });

        test('200 paginated for admin', async () => {
            svc.getAllUsers.mockResolvedValue([{ id: 'u1' }] as any);
            const req = mockRequest({ user: { userId: 'u1', role: 'ADMIN', instituteId: 'i1' }, query: {} });
            const res = mockResponse();

            await authController.getAllUsers(req, res);

            expect(statusCode(res)).toBe(200);
            expect(jsonBody(res).meta.pagination).toBeDefined();
        });

        // Step 12 release gate: the list is limited to the token's institute, and a query instituteId is ignored.
        test('the user list is scoped to the token institute and ignores a query instituteId', async () => {
            svc.getAllUsers.mockResolvedValue([] as any);
            const req = mockRequest({
                user: { userId: 'u1', role: 'ADMIN', instituteId: 'i1' },
                query: { instituteId: 'i2' },
            });
            const res = mockResponse();

            await authController.getAllUsers(req, res);

            expect(svc.getAllUsers).toHaveBeenCalledWith(expect.objectContaining({ instituteId: 'i1' }));
        });

        test('403 for an admin token with no institute (fails closed, no query)', async () => {
            const req = mockRequest({ user: { userId: 'u1', role: 'ADMIN', instituteId: '' }, query: {} });
            const res = mockResponse();

            await authController.getAllUsers(req, res);

            expect(statusCode(res)).toBe(403);
            expect(svc.getAllUsers).not.toHaveBeenCalled();
        });
    });
});
