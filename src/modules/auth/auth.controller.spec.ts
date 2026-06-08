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
    describe('register', () => {
        test('201 with token + user on success', async () => {
            svc.registerInstituteAdmin.mockResolvedValue({ token: 'tok', user: { id: 'u1' } } as any);
            const req = mockRequest({ body: { instituteName: 'Acme', email: 'a@b.com', password: 'pw' } });
            const res = mockResponse();

            await authController.register(req, res);

            expect(statusCode(res)).toBe(201);
            const body = jsonBody(res);
            expect(body.success).toBe(true);
            expect(body.data).toEqual({ token: 'tok', user: { id: 'u1' } });
        });

        test('400 when required fields missing', async () => {
            const req = mockRequest({ body: { email: 'a@b.com' } });
            const res = mockResponse();

            await authController.register(req, res);

            expect(statusCode(res)).toBe(400);
            expect(jsonBody(res).success).toBe(false);
        });

        test('409 when email already registered', async () => {
            svc.registerInstituteAdmin.mockRejectedValue(new Error('Email already registered'));
            const req = mockRequest({ body: { instituteName: 'Acme', email: 'a@b.com', password: 'pw' } });
            const res = mockResponse();

            await authController.register(req, res);

            expect(statusCode(res)).toBe(409);
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
            const req = mockRequest({ user: { userId: 'u1', role: 'ADMIN' }, query: {} });
            const res = mockResponse();

            await authController.getAllUsers(req, res);

            expect(statusCode(res)).toBe(200);
            expect(jsonBody(res).meta.pagination).toBeDefined();
        });
    });
});
