import { Request, Response } from 'express';
import * as reportService from './report.service';
import prisma from '../../config/prisma';
import {
    successResponse,
    badRequestResponse,
    notFoundResponse,
    paginatedResponse,
    validatePagination,
    calculatePagination,
    calculateSkip,
    serverErrorResponse
} from '../../utils/response-helpers';

export const getAllReports = async (req: Request, res: Response): Promise<Response> => {
    try {
        const page = (req.query.page as string) || '1';
        const limit = (req.query.limit as string) || '10';

        const validation = validatePagination(page, limit);
        if (!validation.valid) {
            return badRequestResponse(res, validation.error);
        }

        const skip = calculateSkip(page, limit);
        const data = await reportService.getAllReports({ page: Number(page), limit: Number(limit) });

        const total = await prisma.psychometricTest.count({ where: { isActive: true } });
        const pagination = calculatePagination(page, limit, total);

        return paginatedResponse(res, data, pagination, 'Reports fetched successfully');
    } catch (error: any) {
        return serverErrorResponse(res, error.message || 'Failed to fetch reports');
    }
};

export const getTestReport = async (req: Request, res: Response): Promise<Response> => {
    try {
        const { id: testId } = req.params;

        if (!testId) {
            return badRequestResponse(res, 'Test ID is required');
        }

        const report = await reportService.getTestReport(testId);
        return successResponse(res, report, 'Test report generated successfully');
    } catch (error: any) {
        if (error.message === 'Test not found' || error.message === 'testId is required') {
            return notFoundResponse(res, error.message);
        }
        return serverErrorResponse(res, error.message || 'Failed to generate test report');
    }
};
