import * as reportController from './report.controller';
import * as reportService from './report.service';
import { mockRequest, mockResponse, jsonBody, statusCode } from '../../test-utils/express-mocks';

jest.mock('./report.service');
jest.mock('../../config/prisma', () => ({
    __esModule: true,
    default: { psychometricTest: { count: jest.fn().mockResolvedValue(6) } },
}));

const svc = reportService as jest.Mocked<typeof reportService>;

describe('report.controller', () => {
    describe('getAllReports', () => {
        test('200 paginated', async () => {
            svc.getAllReports.mockResolvedValue([{ id: 'r1' }] as any);
            const req = mockRequest({ query: { page: '1', limit: '10' } });
            const res = mockResponse();

            await reportController.getAllReports(req, res);

            expect(statusCode(res)).toBe(200);
            expect(jsonBody(res).meta.pagination.total).toBe(6);
        });

        test('400 on invalid pagination', async () => {
            const req = mockRequest({ query: { page: 'x', limit: '10' } });
            const res = mockResponse();

            await reportController.getAllReports(req, res);

            expect(statusCode(res)).toBe(400);
        });
    });

    describe('getTestReport', () => {
        test('200 on success', async () => {
            svc.getTestReport.mockResolvedValue({ testId: 't1', summary: {} } as any);
            const req = mockRequest({ params: { id: 't1' } });
            const res = mockResponse();

            await reportController.getTestReport(req, res);

            expect(statusCode(res)).toBe(200);
            expect(jsonBody(res).success).toBe(true);
        });

        test('404 when test not found', async () => {
            svc.getTestReport.mockRejectedValue(new Error('Test not found'));
            const req = mockRequest({ params: { id: 't1' } });
            const res = mockResponse();

            await reportController.getTestReport(req, res);

            expect(statusCode(res)).toBe(404);
        });
    });
});
