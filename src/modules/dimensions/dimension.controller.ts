import { Request, Response } from 'express';
import * as dimensionService from './dimension.service';
import { AuthRequest } from '../../middleware/auth.middleware';
import {
    successResponse,
    createdResponse,
    badRequestResponse,
    unauthorizedResponse,
    forbiddenResponse,
    notFoundResponse,
    paginatedResponse,
    validatePagination,
    calculatePagination,
    serverErrorResponse
} from '../../utils/response-helpers';

/**
 * SEC-06: the tenant comes only from the verified JWT. Query, params and body values are never the scope.
 * Returns '' when the token has no institute, and the service then fails closed.
 */
const getRequesterInstituteId = (req: Request): string => {
    const user = (req as any).user;
    return user?.instituteId || '';
};

/** Maps the scope error to 403. Not-found errors are handled by each caller. */
const isMissingScope = (error: any): boolean => error.message === 'Institute scope is required';

export const createDimension = async (
    req: Request,
    res: Response
): Promise<Response> => {
    try {
        const { testId } = req.params;
        const { name, description } = req.body;

        if (!testId) {
            return badRequestResponse(res, 'testId is required');
        }

        if (!name || !description) {
            return badRequestResponse(res, 'name and description are required', {
                required: ['name', 'description']
            });
        }

        const dimension = await dimensionService.createDimension(
            testId,
            { name, description },
            getRequesterInstituteId(req)
        );

        return createdResponse(res, dimension, 'Dimension created successfully');
    } catch (error: any) {
        if (isMissingScope(error)) {
            return forbiddenResponse(res, 'Forbidden: Institute scope is required');
        }
        if (error.message === 'Test not found') {
            return notFoundResponse(res, error.message);
        }
        return badRequestResponse(res, error.message || 'Failed to create dimension');
    }
};

export const getTestDimensions = async (
    req: Request,
    res: Response
): Promise<Response> => {
    try {
        const { testId } = req.params;

        if (!testId) {
            return badRequestResponse(res, 'testId is required');
        }

        const dimensions = await dimensionService.getTestDimensions(testId, getRequesterInstituteId(req));

        return successResponse(res, dimensions, 'Dimensions fetched successfully');
    } catch (error: any) {
        if (isMissingScope(error)) {
            return forbiddenResponse(res, 'Forbidden: Institute scope is required');
        }
        if (error.message === 'Test not found') {
            return notFoundResponse(res, error.message);
        }
        return serverErrorResponse(res, error.message || 'Failed to fetch dimensions');
    }
};

export const getAllDimensions = async (
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

        const instituteId = getRequesterInstituteId(req);
        const data = await dimensionService.getAllDimensions({
            page: Number(page),
            limit: Number(limit),
            instituteId
        });

        const total = await dimensionService.countDimensions(instituteId);
        const pagination = calculatePagination(page, limit, total);

        return paginatedResponse(res, data, pagination, 'Dimensions fetched successfully');
    } catch (error: any) {
        if (isMissingScope(error)) {
            return forbiddenResponse(res, 'Forbidden: Institute scope is required');
        }
        return serverErrorResponse(res, error.message || 'Failed to fetch dimensions');
    }
};

export const deleteDimension = async (
    req: AuthRequest,
    res: Response
): Promise<Response> => {
    try {
        const { id } = req.params;
        const userId = req.user?.userId;

        if (!id) {
            return badRequestResponse(res, 'dimension id is required');
        }

        if (!userId) {
            return unauthorizedResponse(res, 'Unauthorized');
        }

        const deleted = await dimensionService.deleteDimension(id, userId, getRequesterInstituteId(req));

        return successResponse(res, deleted, 'Dimension deleted successfully');
    } catch (error: any) {
        if (isMissingScope(error)) {
            return forbiddenResponse(res, 'Forbidden: Institute scope is required');
        }
        if (error.message === 'Dimension not found') {
            return notFoundResponse(res, error.message);
        }
        return badRequestResponse(res, error.message || 'Failed to delete dimension');
    }
};
