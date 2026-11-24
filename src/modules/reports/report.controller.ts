import { Request, Response } from 'express';
import * as reportService from './report.service';
import {
    successResponse,
    badRequestResponse,
    forbiddenResponse,
    notFoundResponse,
    paginatedResponse,
    validatePagination,
    calculatePagination,
    calculateSkip,
    serverErrorResponse
} from '../../utils/response-helpers';

/**
 * SEC-10: the tenant comes only from the verified JWT. Query, params and body values are never the scope.
 * Returns '' when the token has no institute, and the service then fails closed.
 */
const getRequesterInstituteId = (req: Request): string => {
    const user = (req as any).user;
    return user?.instituteId || '';
};

/** Maps the scope error to 403 and a missing or foreign parent to 404. Anything else is a server error. */
const handleReportError = (res: Response, error: any, fallback: string): Response => {
    if (error.message === 'Institute scope is required') {
        return forbiddenResponse(res, 'Forbidden: Institute scope is required');
    }
    if (error.message === 'Test not found' || error.message === 'Student not found') {
        return notFoundResponse(res, error.message);
    }
    return serverErrorResponse(res, error.message || fallback);
};

export const getAllReports = async (req: Request, res: Response): Promise<Response> => {
    try {
        const page = (req.query.page as string) || '1';
        const limit = (req.query.limit as string) || '10';

        const validation = validatePagination(page, limit);
        if (!validation.valid) {
            return badRequestResponse(res, validation.error);
        }

        const instituteId = getRequesterInstituteId(req);
        const skip = calculateSkip(page, limit);
        const data = await reportService.getAllReports({
            page: Number(page),
            limit: Number(limit),
            instituteId
        });

        const total = await reportService.countReports(instituteId);
        const pagination = calculatePagination(page, limit, total);

        return paginatedResponse(res, data, pagination, 'Reports fetched successfully');
    } catch (error: any) {
        return handleReportError(res, error, 'Failed to fetch reports');
    }
};

/** GET /reports/test/:testId */
export const getTestReport = async (req: Request, res: Response): Promise<Response> => {
    try {
        const { testId } = req.params;

        if (!testId) {
            return badRequestResponse(res, 'Test ID is required');
        }

        const report = await reportService.getTestReport(testId, getRequesterInstituteId(req));
        return successResponse(res, report, 'Test report generated successfully');
    } catch (error: any) {
        return handleReportError(res, error, 'Failed to generate test report');
    }
};

/** GET /reports/student/:studentId/test/:testId */
export const getStudentReport = async (req: Request, res: Response): Promise<Response> => {
    try {
        const { studentId, testId } = req.params;

        if (!studentId || !testId) {
            return badRequestResponse(res, 'Student ID and Test ID are required');
        }

        const report = await reportService.getStudentReport(studentId, testId, getRequesterInstituteId(req));
        return successResponse(res, report, 'Student report generated successfully');
    } catch (error: any) {
        return handleReportError(res, error, 'Failed to generate student report');
    }
};
