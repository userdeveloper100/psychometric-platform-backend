import * as responseController from './response.controller';
import * as responseService from './response.service';
import { mockRequest, mockResponse, jsonBody, statusCode } from '../../test-utils/express-mocks';

jest.mock('./response.service');

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

        // DB-03: content refusals are client errors. They must not fall through to 500.
        test.each([
            'One or more questions are invalid or inactive',
            'Duplicate question answers are not allowed',
            'Each response needs a questionId and an integer answer',
            'Student does not match invite',
            'Answer for question q1 must be between 1 and 5',
        ])('400 for the refusal "%s"', async (message) => {
            svc.submitResponses.mockRejectedValue(new Error(message));
            const req = mockRequest({
                body: { token: 'tok', studentId: 's1', responses: [{ questionId: 'q1', answer: 3 }] },
            });
            const res = mockResponse();

            await responseController.submitResponses(req, res);

            expect(statusCode(res)).toBe(400);
            expect(jsonBody(res).message).toBe(message);
        });

        test('500 for an unexpected failure, which is not a client refusal', async () => {
            svc.submitResponses.mockRejectedValue(new Error('connection reset'));
            const req = mockRequest({
                body: { token: 'tok', studentId: 's1', responses: [{ questionId: 'q1', answer: 3 }] },
            });
            const res = mockResponse();

            await responseController.submitResponses(req, res);

            expect(statusCode(res)).toBe(500);
        });

        test('400 when responses is not an array', async () => {
            const req = mockRequest({ body: { token: 'tok', studentId: 's1', responses: { questionId: 'q1', answer: 3 } } });
            const res = mockResponse();

            await responseController.submitResponses(req, res);

            expect(statusCode(res)).toBe(400);
            expect(svc.submitResponses).not.toHaveBeenCalled();
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
            svc.countResponses.mockResolvedValue(8);
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

    // SEC-03: the tenant scope comes only from req.user. Query, params and body values are ignored.
    describe('SEC-03 tenant scope from req.user', () => {
        const adminA = { userId: 'u1', role: 'ADMIN', instituteId: 'institute-a' };
        const spoof = 'institute-b';

        test('getAllResponses passes the requester institute and ignores a spoofed query instituteId', async () => {
            svc.getAllResponses.mockResolvedValue([] as any);
            svc.countResponses.mockResolvedValue(0);
            const req = mockRequest({ query: { page: '1', limit: '10', instituteId: spoof }, user: adminA });
            const res = mockResponse();

            await responseController.getAllResponses(req, res);

            expect(svc.getAllResponses).toHaveBeenCalledWith({ page: 1, limit: 10, instituteId: 'institute-a' });
            expect(svc.countResponses).toHaveBeenCalledWith('institute-a');
            expect(statusCode(res)).toBe(200);
        });

        test('getAllResponses without an institute in the token is refused with 403', async () => {
            svc.getAllResponses.mockRejectedValue(new Error('Institute scope is required'));
            const req = mockRequest({ query: {}, user: { userId: 'u1', role: 'ADMIN' } });
            const res = mockResponse();

            await responseController.getAllResponses(req, res);

            expect(statusCode(res)).toBe(403);
        });

        test('getStudentResponses passes the requester institute and ignores a spoofed query instituteId', async () => {
            svc.getStudentResponses.mockResolvedValue([] as any);
            const req = mockRequest({
                params: { studentId: 'student-b' },
                query: { instituteId: spoof },
                user: adminA,
            });
            const res = mockResponse();

            await responseController.getStudentResponses(req, res);

            expect(svc.getStudentResponses).toHaveBeenCalledWith('student-b', 'institute-a');
            expect(statusCode(res)).toBe(200);
        });

        test('getStudentResponses maps a student of another institute to 404', async () => {
            svc.getStudentResponses.mockRejectedValue(new Error('Student not found'));
            const req = mockRequest({ params: { studentId: 'student-b' }, user: adminA });
            const res = mockResponse();

            await responseController.getStudentResponses(req, res);

            expect(statusCode(res)).toBe(404);
        });

        test('getTestResponses passes the requester institute and maps a foreign test to 404', async () => {
            svc.getTestResponses.mockRejectedValue(new Error('Test not found'));
            const req = mockRequest({ params: { testId: 'test-b' }, body: { instituteId: spoof }, user: adminA });
            const res = mockResponse();

            await responseController.getTestResponses(req, res);

            expect(svc.getTestResponses).toHaveBeenCalledWith('test-b', 'institute-a');
            expect(statusCode(res)).toBe(404);
        });

        test('getTestResponses without an institute in the token is refused with 403', async () => {
            svc.getTestResponses.mockRejectedValue(new Error('Institute scope is required'));
            const req = mockRequest({ params: { testId: 'test-a' }, user: { userId: 'u1', role: 'ADMIN' } });
            const res = mockResponse();

            await responseController.getTestResponses(req, res);

            expect(statusCode(res)).toBe(403);
        });

        test('deleteResponse passes the requester institute, ignores a body instituteId, and maps a foreign response to 404', async () => {
            svc.deleteResponse.mockRejectedValue(new Error('Response not found'));
            const req = mockRequest({ params: { id: 'response-b' }, body: { instituteId: spoof }, user: adminA });
            const res = mockResponse();

            await responseController.deleteResponse(req, res);

            expect(svc.deleteResponse).toHaveBeenCalledWith('response-b', 'u1', 'institute-a');
            expect(statusCode(res)).toBe(404);
        });

        test('deleteResponse without an institute in the token is refused with 403', async () => {
            svc.deleteResponse.mockRejectedValue(new Error('Institute scope is required'));
            const req = mockRequest({ params: { id: 'response-a' }, user: { userId: 'u1', role: 'ADMIN' } });
            const res = mockResponse();

            await responseController.deleteResponse(req, res);

            expect(statusCode(res)).toBe(403);
        });
    });
});
