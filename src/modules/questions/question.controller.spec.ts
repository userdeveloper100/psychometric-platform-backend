import * as questionController from './question.controller';
import * as questionService from './question.service';
import { mockRequest, mockResponse, jsonBody, statusCode } from '../../test-utils/express-mocks';

jest.mock('./question.service');

const svc = questionService as jest.Mocked<typeof questionService>;
const adminA = { userId: 'u1', role: 'ADMIN', instituteId: 'institute-a' };

describe('question.controller', () => {
    describe('createQuestion', () => {
        test('201 on success', async () => {
            svc.createQuestion.mockResolvedValue({ id: 'q1' } as any);
            const req = mockRequest({ params: { dimensionId: 'd1' }, body: { text: 'Q?' } });
            const res = mockResponse();

            await questionController.createQuestion(req, res);

            expect(statusCode(res)).toBe(201);
            expect(jsonBody(res).data).toEqual({ id: 'q1' });
        });

        test('400 when text missing', async () => {
            const req = mockRequest({ params: { dimensionId: 'd1' }, body: {} });
            const res = mockResponse();

            await questionController.createQuestion(req, res);

            expect(statusCode(res)).toBe(400);
        });

        test('404 when dimension not found', async () => {
            svc.createQuestion.mockRejectedValue(new Error('Dimension not found'));
            const req = mockRequest({ params: { dimensionId: 'd1' }, body: { text: 'Q?' } });
            const res = mockResponse();

            await questionController.createQuestion(req, res);

            expect(statusCode(res)).toBe(404);
        });
    });

    describe('getDimensionQuestions', () => {
        test('200 with list', async () => {
            svc.getDimensionQuestions.mockResolvedValue([{ id: 'q1' }] as any);
            const req = mockRequest({ params: { dimensionId: 'd1' } });
            const res = mockResponse();

            await questionController.getDimensionQuestions(req, res);

            expect(statusCode(res)).toBe(200);
            expect(jsonBody(res).data).toHaveLength(1);
        });
    });

    describe('getAllQuestions', () => {
        test('200 paginated', async () => {
            svc.getAllQuestions.mockResolvedValue([{ id: 'q1' }] as any);
            svc.countQuestions.mockResolvedValue(5);
            const req = mockRequest({ query: { page: '1', limit: '10' }, user: adminA });
            const res = mockResponse();

            await questionController.getAllQuestions(req, res);

            expect(statusCode(res)).toBe(200);
            expect(jsonBody(res).meta.pagination.total).toBe(5);
        });
    });

    // SEC-06: the tenant comes only from req.user. Params and body values never widen the scope.
    describe('SEC-06 tenant scope and parent chain', () => {
        const spoof = 'institute-b';

        test('createQuestion passes the requester institute and maps a dimension of another institute to 404', async () => {
            svc.createQuestion.mockRejectedValue(new Error('Dimension not found'));
            const req = mockRequest({
                params: { dimensionId: 'dim-b' },
                body: { text: 'Q?', instituteId: spoof },
                user: adminA,
            });
            const res = mockResponse();

            await questionController.createQuestion(req, res);

            expect(svc.createQuestion).toHaveBeenCalledWith('dim-b', { text: 'Q?', scaleMin: undefined, scaleMax: undefined }, 'institute-a');
            expect(statusCode(res)).toBe(404);
        });

        test('createQuestion without an institute in the token is refused with 403', async () => {
            svc.createQuestion.mockRejectedValue(new Error('Institute scope is required'));
            const req = mockRequest({ params: { dimensionId: 'dim-a' }, body: { text: 'Q?' }, user: { userId: 'u1', role: 'ADMIN' } });
            const res = mockResponse();

            await questionController.createQuestion(req, res);

            expect(statusCode(res)).toBe(403);
        });

        test('getDimensionQuestions maps a dimension of another institute to 404 and uses the requester institute', async () => {
            svc.getDimensionQuestions.mockRejectedValue(new Error('Dimension not found'));
            const req = mockRequest({ params: { dimensionId: 'dim-b' }, query: { instituteId: spoof }, user: adminA });
            const res = mockResponse();

            await questionController.getDimensionQuestions(req, res);

            expect(svc.getDimensionQuestions).toHaveBeenCalledWith('dim-b', 'institute-a');
            expect(statusCode(res)).toBe(404);
        });

        test('getAllQuestions lists only the requester institute, ignoring a spoofed query instituteId', async () => {
            svc.getAllQuestions.mockResolvedValue([] as any);
            svc.countQuestions.mockResolvedValue(0);
            const req = mockRequest({ query: { page: '1', limit: '10', instituteId: spoof }, user: adminA });
            const res = mockResponse();

            await questionController.getAllQuestions(req, res);

            expect(svc.getAllQuestions).toHaveBeenCalledWith({ page: 1, limit: 10, instituteId: 'institute-a' });
            expect(svc.countQuestions).toHaveBeenCalledWith('institute-a');
            expect(statusCode(res)).toBe(200);
        });

        test('getAllQuestions without an institute in the token is refused with 403', async () => {
            svc.getAllQuestions.mockRejectedValue(new Error('Institute scope is required'));
            const req = mockRequest({ query: {}, user: { userId: 'u1', role: 'ADMIN' } });
            const res = mockResponse();

            await questionController.getAllQuestions(req, res);

            expect(statusCode(res)).toBe(403);
        });

        test('deleteQuestion passes the requester institute, ignores a body instituteId, and maps a foreign question to 404', async () => {
            svc.deleteQuestion.mockRejectedValue(new Error('Question not found'));
            const req = mockRequest({ params: { id: 'q-b' }, body: { instituteId: spoof }, user: adminA });
            const res = mockResponse();

            await questionController.deleteQuestion(req as any, res);

            expect(svc.deleteQuestion).toHaveBeenCalledWith('q-b', 'u1', 'institute-a');
            expect(statusCode(res)).toBe(404);
        });

        test('deleteQuestion without an institute in the token is refused with 403', async () => {
            svc.deleteQuestion.mockRejectedValue(new Error('Institute scope is required'));
            const req = mockRequest({ params: { id: 'q-a' }, user: { userId: 'u1', role: 'ADMIN' } });
            const res = mockResponse();

            await questionController.deleteQuestion(req as any, res);

            expect(statusCode(res)).toBe(403);
        });
    });

    describe('deleteQuestion', () => {
        test('401 when no user', async () => {
            const req = mockRequest({ params: { id: 'q1' } });
            const res = mockResponse();

            await questionController.deleteQuestion(req as any, res);

            expect(statusCode(res)).toBe(401);
        });

        test('404 when question not found', async () => {
            svc.deleteQuestion.mockRejectedValue(new Error('Question not found'));
            const req = mockRequest({ params: { id: 'q1' }, user: { userId: 'u1' } });
            const res = mockResponse();

            await questionController.deleteQuestion(req as any, res);

            expect(statusCode(res)).toBe(404);
        });
    });
});
