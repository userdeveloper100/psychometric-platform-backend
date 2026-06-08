import * as dimensionController from './dimension.controller';
import * as dimensionService from './dimension.service';
import { mockRequest, mockResponse, jsonBody, statusCode } from '../../test-utils/express-mocks';

jest.mock('./dimension.service');
jest.mock('../../config/prisma', () => ({
    __esModule: true,
    default: { dimension: { count: jest.fn().mockResolvedValue(3) } },
}));

const svc = dimensionService as jest.Mocked<typeof dimensionService>;

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
            const req = mockRequest({ query: { page: '1', limit: '10' } });
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
