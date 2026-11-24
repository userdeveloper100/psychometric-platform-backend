import * as testController from './test.controller';
import * as testService from './test.service';
import { mockRequest, mockResponse, jsonBody, statusCode } from '../../test-utils/express-mocks';

jest.mock('./test.service', () => ({
    __esModule: true,
    TestStatus: { DRAFT: 'DRAFT', PUBLISHED: 'PUBLISHED' },
    createTest: jest.fn(),
    getInstituteTests: jest.fn(),
    getAllTests: jest.fn(),
    publishTest: jest.fn(),
    deleteTest: jest.fn(),
}));
jest.mock('../../config/prisma', () => ({
    __esModule: true,
    default: { psychometricTest: { count: jest.fn().mockResolvedValue(9) } },
}));

const svc = testService as jest.Mocked<typeof testService>;
const adminUser = { role: 'ADMIN', instituteId: 'i1' };
const meta = { total: 9, totalPages: 1, hasNextPage: false, hasPreviousPage: false };

describe('test.controller', () => {
    describe('createTest', () => {
        test('201 on success', async () => {
            svc.createTest.mockResolvedValue({ id: 't1' } as any);
            const req = mockRequest({
                body: { title: 'T', description: 'D', instituteId: 'i1' },
                user: adminUser,
            });
            const res = mockResponse();

            await testController.createTest(req, res);

            expect(statusCode(res)).toBe(201);
        });

        test('400 when required fields missing', async () => {
            const req = mockRequest({ body: { title: 'T' }, user: adminUser });
            const res = mockResponse();

            await testController.createTest(req, res);

            expect(statusCode(res)).toBe(400);
        });

        test('403 when service rejects with role error', async () => {
            svc.createTest.mockRejectedValue(new Error('Only ADMIN users can create tests'));
            const req = mockRequest({
                body: { title: 'T', description: 'D', instituteId: 'i1' },
                user: adminUser,
            });
            const res = mockResponse();

            await testController.createTest(req, res);

            expect(statusCode(res)).toBe(403);
        });
    });

    describe('getInstituteTests', () => {
        test('200 paginated', async () => {
            svc.getInstituteTests.mockResolvedValue({ data: [{ id: 't1' }], meta } as any);
            const req = mockRequest({ query: { instituteId: 'i1', page: '1', limit: '10' } });
            const res = mockResponse();

            await testController.getInstituteTests(req, res);

            expect(statusCode(res)).toBe(200);
            expect(jsonBody(res).meta.pagination.total).toBe(9);
        });

        test('400 when instituteId missing', async () => {
            const req = mockRequest({ query: {} });
            const res = mockResponse();

            await testController.getInstituteTests(req, res);

            expect(statusCode(res)).toBe(400);
        });

        test('400 on invalid status filter', async () => {
            const req = mockRequest({ query: { instituteId: 'i1', status: 'BOGUS' } });
            const res = mockResponse();

            await testController.getInstituteTests(req, res);

            expect(statusCode(res)).toBe(400);
        });
    });

    describe('getAllTests', () => {
        test('200 paginated', async () => {
            svc.getAllTests.mockResolvedValue([{ id: 't1' }] as any);
            const req = mockRequest({ query: { page: '1', limit: '10' } });
            const res = mockResponse();

            await testController.getAllTests(req, res);

            expect(statusCode(res)).toBe(200);
            expect(jsonBody(res).meta.pagination.total).toBe(9);
        });
    });

    describe('publishTest', () => {
        test('409 when already published', async () => {
            svc.publishTest.mockRejectedValue(new Error('Test is already published'));
            const req = mockRequest({ params: { id: 't1' }, body: { instituteId: 'i1' }, user: adminUser });
            const res = mockResponse();

            await testController.publishTest(req, res);

            expect(statusCode(res)).toBe(409);
        });

        test('200 on success', async () => {
            svc.publishTest.mockResolvedValue({ id: 't1', status: 'PUBLISHED' } as any);
            const req = mockRequest({ params: { id: 't1' }, body: { instituteId: 'i1' }, user: adminUser });
            const res = mockResponse();

            await testController.publishTest(req, res);

            expect(statusCode(res)).toBe(200);
        });
    });

    describe('deleteTest', () => {
        test('404 when test not found', async () => {
            svc.deleteTest.mockRejectedValue(new Error('Test not found'));
            const req = mockRequest({ params: { id: 't1' }, body: { instituteId: 'i1' }, user: adminUser });
            const res = mockResponse();

            await testController.deleteTest(req, res);

            expect(statusCode(res)).toBe(404);
        });
    });

    // SEC-01: the institute comes only from req.user. A body or query instituteId is ignored.
    describe('SEC-01 institute ownership for publish and delete', () => {
        const spoofed = { instituteId: 'institute-b' };

        test('publishTest passes the institute from req.user and ignores a spoofed body instituteId', async () => {
            svc.publishTest.mockResolvedValue({ id: 't1', status: 'PUBLISHED' } as any);
            const req = mockRequest({ params: { id: 't1' }, body: spoofed, user: adminUser });
            const res = mockResponse();

            await testController.publishTest(req, res);

            expect(svc.publishTest).toHaveBeenCalledWith({
                testId: 't1',
                requestedBy: { role: 'ADMIN', instituteId: 'i1' },
            });
            expect(statusCode(res)).toBe(200);
        });

        test('publishTest maps another institute test ("Test not found") to 404', async () => {
            svc.publishTest.mockRejectedValue(new Error('Test not found'));
            const req = mockRequest({ params: { id: 'test-of-b' }, body: spoofed, user: adminUser });
            const res = mockResponse();

            await testController.publishTest(req, res);

            expect(statusCode(res)).toBe(404);
        });

        test('publishTest maps a STUDENT to 403', async () => {
            svc.publishTest.mockRejectedValue(new Error('Only ADMIN users can publish tests'));
            const req = mockRequest({ params: { id: 't1' }, user: { role: 'STUDENT', instituteId: 'i1' } });
            const res = mockResponse();

            await testController.publishTest(req, res);

            expect(statusCode(res)).toBe(403);
        });

        test('publishTest without an authenticated user returns 401 and never calls the service', async () => {
            const req = mockRequest({ params: { id: 't1' }, body: spoofed });
            const res = mockResponse();

            await testController.publishTest(req, res);

            expect(statusCode(res)).toBe(401);
            expect(svc.publishTest).not.toHaveBeenCalled();
        });

        test('deleteTest passes the institute from req.user and ignores a spoofed body instituteId', async () => {
            svc.deleteTest.mockResolvedValue({ success: true } as any);
            const req = mockRequest({ params: { id: 't1' }, body: spoofed, user: adminUser });
            const res = mockResponse();

            await testController.deleteTest(req, res);

            expect(svc.deleteTest).toHaveBeenCalledWith({
                testId: 't1',
                requestedBy: { role: 'ADMIN', instituteId: 'i1' },
            });
            expect(statusCode(res)).toBe(200);
        });

        test('deleteTest maps another institute test ("Test not found") to 404', async () => {
            svc.deleteTest.mockRejectedValue(new Error('Test not found'));
            const req = mockRequest({ params: { id: 'test-of-b' }, body: spoofed, user: adminUser });
            const res = mockResponse();

            await testController.deleteTest(req, res);

            expect(statusCode(res)).toBe(404);
        });

        test('deleteTest maps a STUDENT to 403', async () => {
            svc.deleteTest.mockRejectedValue(new Error('Only ADMIN users can delete tests'));
            const req = mockRequest({ params: { id: 't1' }, user: { role: 'STUDENT', instituteId: 'i1' } });
            const res = mockResponse();

            await testController.deleteTest(req, res);

            expect(statusCode(res)).toBe(403);
        });

        test('deleteTest without an authenticated user returns 401 and never calls the service', async () => {
            const req = mockRequest({ params: { id: 't1' }, body: spoofed });
            const res = mockResponse();

            await testController.deleteTest(req, res);

            expect(statusCode(res)).toBe(401);
            expect(svc.deleteTest).not.toHaveBeenCalled();
        });
    });
});
