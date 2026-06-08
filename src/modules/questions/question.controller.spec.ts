import * as questionController from './question.controller';
import * as questionService from './question.service';
import { mockRequest, mockResponse, jsonBody, statusCode } from '../../test-utils/express-mocks';

jest.mock('./question.service');
jest.mock('../../config/prisma', () => ({
    __esModule: true,
    default: { question: { count: jest.fn().mockResolvedValue(5) } },
}));

const svc = questionService as jest.Mocked<typeof questionService>;

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
            const req = mockRequest({ query: { page: '1', limit: '10' } });
            const res = mockResponse();

            await questionController.getAllQuestions(req, res);

            expect(statusCode(res)).toBe(200);
            expect(jsonBody(res).meta.pagination.total).toBe(5);
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
