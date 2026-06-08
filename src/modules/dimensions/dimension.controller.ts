import { Request, Response } from 'express';
import * as dimensionService from './dimension.service';
import { AuthRequest } from '../../middleware/auth.middleware';
import prisma from '../../config/prisma';
import {
    successResponse,
    createdResponse,
    badRequestResponse,
    unauthorizedResponse,
    notFoundResponse,
    paginatedResponse,
    validatePagination,
    calculatePagination,
    serverErrorResponse
} from '../../utils/response-helpers';

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

        const dimension = await dimensionService.createDimension(testId, {
            name,
            description
        });

        return createdResponse(res, dimension, 'Dimension created successfully');
    } catch (error: any) {
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

        const dimensions = await dimensionService.getTestDimensions(testId);

        return successResponse(res, dimensions, 'Dimensions fetched successfully');
    } catch (error: any) {
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

        const data = await dimensionService.getAllDimensions({
            page: Number(page),
            limit: Number(limit)
        });

        const total = await prisma.dimension.count({ where: { isActive: true } });
        const pagination = calculatePagination(page, limit, total);

        return paginatedResponse(res, data, pagination, 'Dimensions fetched successfully');
    } catch (error: any) {
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

        const deleted = await dimensionService.deleteDimension(id, userId);

        return successResponse(res, deleted, 'Dimension deleted successfully');
    } catch (error: any) {
        if (error.message === 'Dimension not found') {
            return notFoundResponse(res, error.message);
        }
        return badRequestResponse(res, error.message || 'Failed to delete dimension');
    }
};
