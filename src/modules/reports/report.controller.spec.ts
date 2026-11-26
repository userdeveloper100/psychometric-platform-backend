import * as reportController from './report.controller';
import * as reportService from './report.service';
import { mockRequest, mockResponse, jsonBody, statusCode } from '../../test-utils/express-mocks';

jest.mock('./report.service');

const svc = reportService as jest.Mocked<typeof reportService>;
const adminA = { userId: 'u1', role: 'ADMIN', instituteId: 'institute-a' };
const spoof = 'institute-b';

describe('report.controller', () => {
    describe('getAllReports', () => {
        test('200 paginated, with the total from the scoped count', async () => {
            svc.getAllReports.mockResolvedValue([{ id: 'r1' }] as any);
            svc.countReports.mockResolvedValue(6);
            const req = mockRequest({ query: { page: '1', limit: '10' }, user: adminA });
            const res = mockResponse();

            await reportController.getAllReports(req, res);

            expect(statusCode(res)).toBe(200);
            expect(jsonBody(res).meta.pagination.total).toBe(6);
        });

        test('400 on invalid pagination', async () => {
            const req = mockRequest({ query: { page: 'x', limit: '10' }, user: adminA });
            const res = mockResponse();

            await reportController.getAllReports(req, res);

            expect(statusCode(res)).toBe(400);
        });

        test('lists only the requester institute, ignoring a spoofed query instituteId', async () => {
            svc.getAllReports.mockResolvedValue([] as any);
            svc.countReports.mockResolvedValue(0);
            const req = mockRequest({ query: { page: '1', limit: '10', instituteId: spoof }, user: adminA });
            const res = mockResponse();

            await reportController.getAllReports(req, res);

            expect(svc.getAllReports).toHaveBeenCalledWith({ page: 1, limit: 10, instituteId: 'institute-a' });
            expect(svc.countReports).toHaveBeenCalledWith('institute-a');
        });

        test('without an institute in the token is refused with 403', async () => {
            svc.getAllReports.mockRejectedValue(new Error('Institute scope is required'));
            const req = mockRequest({ query: {}, user: { userId: 'u1', role: 'ADMIN' } });
            const res = mockResponse();

            await reportController.getAllReports(req, res);

            expect(statusCode(res)).toBe(403);
        });
    });

    // SEC-10 functional defect: the handler must read the parameter the route defines (:testId, :studentId).
    describe('getTestReport', () => {
        test('reads req.params.testId and returns 200 for an own test', async () => {
            svc.getTestReport.mockResolvedValue({ testId: 't1', students: [] } as any);
            const req = mockRequest({ params: { testId: 't1' }, user: adminA });
            const res = mockResponse();

            await reportController.getTestReport(req, res);

            expect(svc.getTestReport).toHaveBeenCalledWith('t1', 'institute-a');
            expect(statusCode(res)).toBe(200);
            expect(jsonBody(res).success).toBe(true);
        });

        test('400 when testId is missing from params', async () => {
            const req = mockRequest({ params: {}, user: adminA });
            const res = mockResponse();

            await reportController.getTestReport(req, res);

            expect(statusCode(res)).toBe(400);
            expect(svc.getTestReport).not.toHaveBeenCalled();
        });

        test('a query or body instituteId is ignored, and a foreign test is 404', async () => {
            svc.getTestReport.mockRejectedValue(new Error('Test not found'));
            const req = mockRequest({
                params: { testId: 'test-b' },
                query: { instituteId: spoof },
                body: { instituteId: spoof },
                user: adminA,
            });
            const res = mockResponse();

            await reportController.getTestReport(req, res);

            expect(svc.getTestReport).toHaveBeenCalledWith('test-b', 'institute-a');
            expect(statusCode(res)).toBe(404);
        });

        test('without an institute in the token is refused with 403', async () => {
            svc.getTestReport.mockRejectedValue(new Error('Institute scope is required'));
            const req = mockRequest({ params: { testId: 'test-a' }, user: { userId: 'u1', role: 'ADMIN' } });
            const res = mockResponse();

            await reportController.getTestReport(req, res);

            expect(statusCode(res)).toBe(403);
        });
    });

    describe('getStudentReport', () => {
        test('reads studentId and testId from params and returns one student (200)', async () => {
            svc.getStudentReport.mockResolvedValue({ studentId: 's1', testId: 't1', dimensions: [] } as any);
            const req = mockRequest({ params: { studentId: 's1', testId: 't1' }, user: adminA });
            const res = mockResponse();

            await reportController.getStudentReport(req, res);

            expect(svc.getStudentReport).toHaveBeenCalledWith('s1', 't1', 'institute-a');
            expect(statusCode(res)).toBe(200);
            expect(jsonBody(res).data.studentId).toBe('s1');
        });

        test('400 when studentId or testId is missing', async () => {
            const req = mockRequest({ params: { studentId: 's1' }, user: adminA });
            const res = mockResponse();

            await reportController.getStudentReport(req, res);

            expect(statusCode(res)).toBe(400);
            expect(svc.getStudentReport).not.toHaveBeenCalled();
        });

        test('a student of another institute is 404, and the spoofed body instituteId is ignored', async () => {
            svc.getStudentReport.mockRejectedValue(new Error('Student not found'));
            const req = mockRequest({
                params: { studentId: 'student-b', testId: 'test-a' },
                body: { instituteId: spoof },
                user: adminA,
            });
            const res = mockResponse();

            await reportController.getStudentReport(req, res);

            expect(svc.getStudentReport).toHaveBeenCalledWith('student-b', 'test-a', 'institute-a');
            expect(statusCode(res)).toBe(404);
        });

        test('without an institute in the token is refused with 403', async () => {
            svc.getStudentReport.mockRejectedValue(new Error('Institute scope is required'));
            const req = mockRequest({
                params: { studentId: 's1', testId: 't1' },
                user: { userId: 'u1', role: 'ADMIN' },
            });
            const res = mockResponse();

            await reportController.getStudentReport(req, res);

            expect(statusCode(res)).toBe(403);
        });
    });
});

describe('report.controller export (CSV, scoring engine)', () => {
    const report = {
        testId: 't1',
        cohort: { invitedCount: 1, completedCount: 1, compositeStatistics: null, dimensionAverages: [{ dimensionId: 'd1', dimensionName: 'Openness', averageNormalizedScore: 75 }] },
        students: [
            {
                studentId: 's1',
                studentName: 'Ann',
                status: 'COMPLETED',
                compositeScore: 75,
                percentileRank: 50,
                performanceBand: 'AVERAGE',
                dimensions: [{ dimensionId: 'd1', dimensionName: 'Openness', score: 4, normalizedScore: 75 }],
            },
        ],
    };

    test('200 with text/csv, an attachment header, and the CSV body', async () => {
        svc.getTestReport.mockResolvedValue(report as any);
        const req = mockRequest({ params: { testId: 't1' }, query: { format: 'csv' }, user: adminA });
        const res = mockResponse();

        await reportController.exportTestReportCsv(req, res);

        expect(statusCode(res)).toBe(200);
        expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8');
        expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', 'attachment; filename="test-report-t1.csv"');
        const body = (res.send as unknown as jest.Mock).mock.calls[0][0];
        expect(body.split('\r\n')[1]).toBe('s1,Ann,COMPLETED,75,50,AVERAGE,75');
        expect(svc.getTestReport).toHaveBeenCalledWith('t1', 'institute-a');
    });

    test('the scope is the token institute, and a query instituteId is ignored', async () => {
        svc.getTestReport.mockResolvedValue(report as any);
        const req = mockRequest({ params: { testId: 't1' }, query: { format: 'csv', instituteId: spoof }, user: adminA });
        const res = mockResponse();

        await reportController.exportTestReportCsv(req, res);

        expect(svc.getTestReport).toHaveBeenCalledWith('t1', 'institute-a');
    });

    test('400 when format is missing or not csv, with no service call', async () => {
        for (const query of [{}, { format: 'json' }, { format: ['csv', 'csv'] }]) {
            const res = mockResponse();
            await reportController.exportTestReportCsv(mockRequest({ params: { testId: 't1' }, query, user: adminA }), res);
            expect(statusCode(res)).toBe(400);
        }
        expect(svc.getTestReport).not.toHaveBeenCalled();
    });

    test('404 for a foreign or inactive test, with no CSV', async () => {
        svc.getTestReport.mockRejectedValue(new Error('Test not found'));
        const req = mockRequest({ params: { testId: 'foreign' }, query: { format: 'csv' }, user: adminA });
        const res = mockResponse();

        await reportController.exportTestReportCsv(req, res);

        expect(statusCode(res)).toBe(404);
        expect(res.send).not.toHaveBeenCalled();
    });

    test('403 when the token has no institute', async () => {
        svc.getTestReport.mockRejectedValue(new Error('Institute scope is required'));
        const req = mockRequest({ params: { testId: 't1' }, query: { format: 'csv' }, user: { userId: 'u1', role: 'ADMIN', instituteId: '' } });
        const res = mockResponse();

        await reportController.exportTestReportCsv(req, res);

        expect(statusCode(res)).toBe(403);
    });
});
