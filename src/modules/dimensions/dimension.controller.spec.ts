import * as dimensionController from './dimension.controller';
import * as dimensionService from './dimension.service';
import { mockRequest, mockResponse, jsonBody, statusCode } from '../../test-utils/express-mocks';

jest.mock('./dimension.service');

const svc = dimensionService as jest.Mocked<typeof dimensionService>;
const adminA = { userId: 'u1', role: 'ADMIN', instituteId: 'institute-a' };

describe('dimension.controller', () => {
    describe('createDimension', () => {
        test('201 on success', async () => {
            svc.createDimension.mockResolvedValue({ id: 'd1' } as any);
            const req = mockRequest({ params: { testId: 't1' }, body: { name: 'N', description: 'D' } });
            const res = mockResponse();

            await dimensionController.createDimension(req, res);

            expect(statusCode(res)).toBe(201);
            expect(jsonBody(res).data).toEqual({ id: 'd1' });
        });

        test('400 when name/description missing', async () => {
            const req = mockRequest({ params: { testId: 't1' }, body: {} });
            const res = mockResponse();

            await dimensionController.createDimension(req, res);

            expect(statusCode(res)).toBe(400);
        });

        test('404 when test not found', async () => {
            svc.createDimension.mockRejectedValue(new Error('Test not found'));
            const req = mockRequest({ params: { testId: 't1' }, body: { name: 'N', description: 'D' } });
            const res = mockResponse();

            await dimensionController.createDimension(req, res);

            expect(statusCode(res)).toBe(404);
        });
    });

    describe('getTestDimensions', () => {
        test('200 with list', async () => {
            svc.getTestDimensions.mockResolvedValue([{ id: 'd1' }] as any);
            const req = mockRequest({ params: { testId: 't1' } });
            const res = mockResponse();

            await dimensionController.getTestDimensions(req, res);

            expect(statusCode(res)).toBe(200);
            expect(jsonBody(res).data).toHaveLength(1);
        });
    });

    describe('getAllDimensions', () => {
        test('200 paginated', async () => {
            svc.getAllDimensions.mockResolvedValue([{ id: 'd1' }] as any);
            svc.countDimensions.mockResolvedValue(3);
            const req = mockRequest({ query: { page: '1', limit: '10' }, user: adminA });
            const res = mockResponse();

            await dimensionController.getAllDimensions(req, res);

            expect(statusCode(res)).toBe(200);
            expect(jsonBody(res).meta.pagination.total).toBe(3);
        });

        test('400 on invalid pagination', async () => {
            const req = mockRequest({ query: { page: '0', limit: '10' } });
            const res = mockResponse();

            await dimensionController.getAllDimensions(req, res);

            expect(statusCode(res)).toBe(400);
        });
    });

    // SEC-06: the tenant comes only from req.user. Params and body values never widen the scope.
    describe('SEC-06 tenant scope and parent chain', () => {
        const spoof = 'institute-b';

        test('createDimension passes the requester institute, ignores a body instituteId, and maps a foreign test to 404', async () => {
            svc.createDimension.mockRejectedValue(new Error('Test not found'));
            const req = mockRequest({
                params: { testId: 'test-b' },
                body: { name: 'N', description: 'D', instituteId: spoof },
                user: adminA,
            });
            const res = mockResponse();

            await dimensionController.createDimension(req, res);

            expect(svc.createDimension).toHaveBeenCalledWith('test-b', { name: 'N', description: 'D' }, 'institute-a');
            expect(statusCode(res)).toBe(404);
        });

        test('createDimension without an institute in the token is refused with 403', async () => {
            svc.createDimension.mockRejectedValue(new Error('Institute scope is required'));
            const req = mockRequest({
                params: { testId: 'test-a' },
                body: { name: 'N', description: 'D' },
                user: { userId: 'u1', role: 'ADMIN' },
            });
            const res = mockResponse();

            await dimensionController.createDimension(req, res);

            expect(statusCode(res)).toBe(403);
        });

        test('getTestDimensions maps a foreign test to 404 and uses the requester institute', async () => {
            svc.getTestDimensions.mockRejectedValue(new Error('Test not found'));
            const req = mockRequest({ params: { testId: 'test-b' }, query: { instituteId: spoof }, user: adminA });
            const res = mockResponse();

            await dimensionController.getTestDimensions(req, res);

            expect(svc.getTestDimensions).toHaveBeenCalledWith('test-b', 'institute-a');
            expect(statusCode(res)).toBe(404);
        });

        test('getAllDimensions lists only the requester institute, ignoring a spoofed query instituteId', async () => {
            svc.getAllDimensions.mockResolvedValue([] as any);
            svc.countDimensions.mockResolvedValue(0);
            const req = mockRequest({ query: { page: '1', limit: '10', instituteId: spoof }, user: adminA });
            const res = mockResponse();

            await dimensionController.getAllDimensions(req, res);

            expect(svc.getAllDimensions).toHaveBeenCalledWith({ page: 1, limit: 10, instituteId: 'institute-a' });
            expect(svc.countDimensions).toHaveBeenCalledWith('institute-a');
            expect(statusCode(res)).toBe(200);
        });

        test('getAllDimensions without an institute in the token is refused with 403', async () => {
            svc.getAllDimensions.mockRejectedValue(new Error('Institute scope is required'));
            const req = mockRequest({ query: {}, user: { userId: 'u1', role: 'ADMIN' } });
            const res = mockResponse();

            await dimensionController.getAllDimensions(req, res);

            expect(statusCode(res)).toBe(403);
        });

        test('deleteDimension passes the requester institute, ignores a body instituteId, and maps a foreign dimension to 404', async () => {
            svc.deleteDimension.mockRejectedValue(new Error('Dimension not found'));
            const req = mockRequest({ params: { id: 'dim-b' }, body: { instituteId: spoof }, user: adminA });
            const res = mockResponse();

            await dimensionController.deleteDimension(req as any, res);

            expect(svc.deleteDimension).toHaveBeenCalledWith('dim-b', 'u1', 'institute-a');
            expect(statusCode(res)).toBe(404);
        });

        test('deleteDimension without an institute in the token is refused with 403', async () => {
            svc.deleteDimension.mockRejectedValue(new Error('Institute scope is required'));
            const req = mockRequest({ params: { id: 'dim-a' }, user: { userId: 'u1', role: 'ADMIN' } });
            const res = mockResponse();

            await dimensionController.deleteDimension(req as any, res);

            expect(statusCode(res)).toBe(403);
        });
    });

    describe('deleteDimension', () => {
        test('401 when no user', async () => {
            const req = mockRequest({ params: { id: 'd1' } });
            const res = mockResponse();

            await dimensionController.deleteDimension(req as any, res);

            expect(statusCode(res)).toBe(401);
        });

        test('200 on success', async () => {
            svc.deleteDimension.mockResolvedValue({ success: true } as any);
            const req = mockRequest({ params: { id: 'd1' }, user: { userId: 'u1' } });
            const res = mockResponse();

            await dimensionController.deleteDimension(req as any, res);

            expect(statusCode(res)).toBe(200);
        });
    });
});
