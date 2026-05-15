import { Request, Response } from 'express';
import * as testService from './test.service';
import { TestStatus } from './test.service';
import prisma from '../../config/prisma';
import {
    successResponse,
    createdResponse,
    badRequestResponse,
    unauthorizedResponse,
    forbiddenResponse,
    conflictResponse,
    notFoundResponse,
    paginatedResponse,
    validatePagination,
    calculatePagination,
    calculateSkip,
    serverErrorResponse
} from '../../utils/response-helpers';

export const createTest = async (req: Request, res: Response): Promise<Response> => {
    try {
        const { title, description, instituteId } = req.body;
        const user = (req as any).user;

        if (!title || !description || !instituteId) {
            return badRequestResponse(res, 'title, description and instituteId are required', {
                required: ['title', 'description', 'instituteId']
            });
        }

        if (!user?.role || !user?.instituteId) {
            return unauthorizedResponse(res, 'Unauthorized');
        }

        const test = await testService.createTest({
            title,
            description,
            instituteId,
            requestedBy: {
                role: user.role,
                instituteId: user.instituteId
            }
        });

        return createdResponse(res, test, 'Test created successfully');
    } catch (error: any) {
        if (error.message.includes('Only ADMIN') || error.message.includes('own institute')) {
            return forbiddenResponse(res, error.message);
        }
        if (error.message === 'Institute not found') {
            return notFoundResponse(res, error.message);
        }
        return serverErrorResponse(res, error.message || 'Failed to create test');
    }
};

export const getInstituteTests = async (
    req: Request,
    res: Response
): Promise<Response> => {
    try {
        const instituteId =
            (req.query.instituteId as string) ||
            (req.params.instituteId as string);

        const page = (req.query.page as string) || '1';
        const limit = (req.query.limit as string) || '10';
        const search = (req.query.search as string) || '';
        const statusRaw = (req.query.status as string | undefined)?.toUpperCase();

        if (!instituteId) {
            return badRequestResponse(res, 'instituteId is required');
        }

        const validation = validatePagination(page, limit);
        if (!validation.valid) {
            return badRequestResponse(res, validation.error);
        }

        let status: TestStatus | undefined;
        if (statusRaw) {
            if (statusRaw !== TestStatus.DRAFT && statusRaw !== TestStatus.PUBLISHED) {
                return badRequestResponse(res, 'status must be DRAFT or PUBLISHED');
            }
            status = statusRaw as TestStatus;
        }

        const safeLimit = Math.min(Number(limit), 100);
        const result = await testService.getInstituteTests({
            instituteId,
            page: Number(page),
            limit: safeLimit,
            search,
            status
        });

        const pagination = {
            page: Number(page),
            limit: safeLimit,
            total: result.meta.total,
            totalPages: result.meta.totalPages,
            hasNextPage: result.meta.hasNextPage,
            hasPreviousPage: result.meta.hasPreviousPage
        };

        return paginatedResponse(res, result.data, pagination, 'Tests fetched successfully');
    } catch (error: any) {
        return serverErrorResponse(res, error.message || 'Failed to fetch tests');
    }
};

export const getAllTests = async (
    req: Request,
    res: Response
): Promise<Response> => {
    try {
        const page = (req.query.page as string) || '1';
        const limit = (req.query.limit as string) || '10';

        const validation = validatePagination(page, limit);
        if (!validation.valid) {
            return badRequestResponse(res, validation.error);
        }

        const skip = calculateSkip(page, limit);
        const data = await testService.getAllTests({ page: Number(page), limit: Number(limit) });

        const total = await prisma.psychometricTest.count({ where: { isActive: true } });
        const pagination = calculatePagination(page, limit, total);

        return paginatedResponse(res, data, pagination, 'Tests fetched successfully');
    } catch (error: any) {
        return serverErrorResponse(res, error.message || 'Failed to fetch tests');
    }
};

export const publishTest = async (req: Request, res: Response): Promise<Response> => {
    try {
        const testId = req.params.id;
        const instituteId =
            (req.body.instituteId as string) ||
            ((req as any).user?.instituteId as string);
        const user = (req as any).user;

        if (!testId) {
            return badRequestResponse(res, 'Test ID is required');
        }

        if (!user?.role || !user?.instituteId || !instituteId) {
            return unauthorizedResponse(res, 'Unauthorized');
        }

        const test = await testService.publishTest({
            testId,
            instituteId,
            requestedBy: {
                role: user.role,
                instituteId: user.instituteId
            }
        });

        return successResponse(res, test, 'Test published successfully');
    } catch (error: any) {
        if (error.message.includes('Only ADMIN') || error.message.includes('own institute')) {
            return forbiddenResponse(res, error.message);
        }
        if (error.message === 'Test not found') {
            return notFoundResponse(res, error.message);
        }
        if (error.message === 'Test is already published') {
            return conflictResponse(res, error.message);
        }
        return serverErrorResponse(res, error.message || 'Failed to publish test');
    }
};

export const deleteTest = async (req: Request, res: Response): Promise<Response> => {
    try {
        const testId = req.params.id;
        const instituteId =
            (req.body.instituteId as string) ||
            ((req as any).user?.instituteId as string);
        const user = (req as any).user;

        if (!testId) {
            return badRequestResponse(res, 'Test ID is required');
        }

        if (!user?.role || !user?.instituteId || !instituteId) {
            return unauthorizedResponse(res, 'Unauthorized');
        }

        const test = await testService.deleteTest({
            testId,
            instituteId,
            requestedBy: {
                role: user.role,
                instituteId: user.instituteId
            }
        });

        return successResponse(res, test, 'Test deleted successfully');
    } catch (error: any) {
        if (error.message.includes('Only ADMIN') || error.message.includes('own institute')) {
            return forbiddenResponse(res, error.message);
        }
        if (error.message === 'Test not found') {
            return notFoundResponse(res, error.message);
        }
        return serverErrorResponse(res, error.message || 'Failed to delete test');
    }
};
