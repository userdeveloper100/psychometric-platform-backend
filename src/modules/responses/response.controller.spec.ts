import * as responseController from './response.controller';
import * as responseService from './response.service';
import { mockRequest, mockResponse, jsonBody, statusCode } from '../../test-utils/express-mocks';

jest.mock('./response.service');
jest.mock('../../config/prisma', () => ({
    __esModule: true,
    default: { response: { count: jest.fn().mockResolvedValue(8) } },
}));

const svc = responseService as jest.Mocked<typeof responseService>;

describe('response.controller', () => {
    describe('submitResponses', () => {
        test('201 on success', async () => {
            svc.submitResponses.mockResolvedValue({ submitted: 3 } as any);
            const req = mockRequest({
                body: { token: 'tok', studentId: 's1', responses: [{ questionId: 'q1', value: 4 }] },
                user: { userId: 'u1' },
            });
            const res = mockResponse();

            await responseController.submitResponses(req, res);

            expect(statusCode(res)).toBe(201);
        });

        test('400 when payload incomplete', async () => {
            const req = mockRequest({ body: { token: 'tok', responses: [] } });
            const res = mockResponse();

            await responseController.submitResponses(req, res);

            expect(statusCode(res)).toBe(400);
        });

        test('400 on invalid invite token', async () => {
            svc.submitResponses.mockRejectedValue(new Error('Invalid or inactive invite token'));
            const req = mockRequest({
                body: { token: 'bad', studentId: 's1', responses: [{ questionId: 'q1', value: 4 }] },
            });
            const res = mockResponse();

            await responseController.submitResponses(req, res);

            expect(statusCode(res)).toBe(400);
        });
    });

    describe('getStudentResponses', () => {
        test('200 on success', async () => {
            svc.getStudentResponses.mockResolvedValue([{ id: 'r1' }] as any);
            const req = mockRequest({ params: { studentId: 's1' } });
            const res = mockResponse();

            await responseController.getStudentResponses(req, res);

            expect(statusCode(res)).toBe(200);
        });

        test('400 when studentId missing', async () => {
            const req = mockRequest({ params: {} });
            const res = mockResponse();

            await responseController.getStudentResponses(req, res);

            expect(statusCode(res)).toBe(400);
        });
    });

    describe('getAllResponses', () => {
        test('200 paginated', async () => {
            svc.getAllResponses.mockResolvedValue([{ id: 'r1' }] as any);
            const req = mockRequest({ query: { page: '1', limit: '10' } });
            const res = mockResponse();

            await responseController.getAllResponses(req, res);

            expect(statusCode(res)).toBe(200);
            expect(jsonBody(res).meta.pagination.total).toBe(8);
        });
    });

    describe('deleteResponse', () => {
        test('404 when not found', async () => {
            svc.deleteResponse.mockRejectedValue(new Error('Response not found'));
            const req = mockRequest({ params: { id: 'r1' }, user: { userId: 'u1' } });
            const res = mockResponse();

            await responseController.deleteResponse(req, res);

            expect(statusCode(res)).toBe(404);
        });

        test('200 on success', async () => {
            svc.deleteResponse.mockResolvedValue({ success: true } as any);
            const req = mockRequest({ params: { id: 'r1' }, user: { userId: 'u1' } });
            const res = mockResponse();

            await responseController.deleteResponse(req, res);

            expect(statusCode(res)).toBe(200);
        });
    });
});
