import { Request, Response } from 'express';
import * as instituteService from './institute.service';
import prisma from '../../config/prisma';
import {
    successResponse,
    createdResponse,
    badRequestResponse,
    conflictResponse,
    notFoundResponse,
    paginatedResponse,
    validatePagination,
    calculatePagination,
    calculateSkip,
    serverErrorResponse
} from '../../utils/response-helpers';
import { ErrorCode } from '../../types/api-response.types';

// ─── Create Institute ─────────────────────────────────────────────────────────

export const createInstitute = async (
    req: Request,
    res: Response
): Promise<Response> => {
    try {
        const { name, email } = req.body;

        if (!name || !email) {
            return badRequestResponse(res, 'name and email are required', {
                required: ['name', 'email']
            });
        }

        const institute = await instituteService.createInstitute({ name, email });

        return createdResponse(res, institute, 'Institute created successfully');
    } catch (error: any) {
        if (error.message === 'Institute with this email already exists') {
            return conflictResponse(res, error.message);
        }
        return serverErrorResponse(res, error.message || 'Failed to create institute');
    }
};

// ─── Get All Institutes (Paginated) ──────────────────────────────────────────

export const getInstitutes = async (
    req: Request,
    res: Response
): Promise<Response> => {
    try {
        const page = (req.query.page as string) || '1';
        const limit = (req.query.limit as string) || '10';
        const search = (req.query.search as string) || '';

        const validation = validatePagination(page, limit);
        if (!validation.valid) {
            return badRequestResponse(res, validation.error);
        }

        const safeLimitCap = Math.min(Number(limit), 100);

        const result = await instituteService.getInstitutes({
            page: Number(page),
            limit: safeLimitCap,
            search
        });

        const pagination = {
            page: Number(page),
            limit: safeLimitCap,
            total: result.meta.total,
            totalPages: result.meta.totalPages,
            hasNextPage: result.meta.hasNextPage,
            hasPreviousPage: result.meta.hasPreviousPage
        };

        return paginatedResponse(res, result.data, pagination, 'Institutes fetched successfully');
    } catch (error: any) {
        return serverErrorResponse(res, error.message || 'Failed to fetch institutes');
    }
};

export const getAllInstitutes = async (
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
        const data = await instituteService.getAllInstitutes({ page: Number(page), limit: Number(limit) });

        const total = await prisma.institute.count({ where: { isActive: true } });
        const pagination = calculatePagination(page, limit, total);

        return paginatedResponse(res, data, pagination, 'Institutes fetched successfully');
    } catch (error: any) {
        return serverErrorResponse(res, error.message || 'Failed to fetch institutes');
    }
};

// ─── Get Institute By ID ──────────────────────────────────────────────────────

export const getInstituteById = async (
    req: Request,
    res: Response
): Promise<Response> => {
    try {
        const { id } = req.params;

        if (!id) {
            return badRequestResponse(res, 'Institute ID is required');
        }

        const institute = await instituteService.getInstituteById(id);

        return successResponse(res, institute, 'Institute fetched successfully');
    } catch (error: any) {
        if (error.message === 'Institute not found') {
            return notFoundResponse(res, error.message);
        }
        return serverErrorResponse(res, error.message || 'Failed to fetch institute');
    }
};

const getUserId = (req: Request): string => {
    const user = (req as any).user;
    return user?.id || user?.userId || 'system';
};

export const updateInstitute = async (req: Request, res: Response): Promise<Response> => {
    try {
        const { id } = req.params;
        const userId = getUserId(req);

        const institute = await instituteService.updateInstitute(id, req.body, userId);

        return successResponse(res, institute, 'Institute updated successfully');
    } catch (error: any) {
        if (error.message === 'Institute not found') {
            return notFoundResponse(res, error.message);
        }
        return serverErrorResponse(res, error.message || 'Failed to update institute');
    }
};

export const deleteInstitute = async (req: Request, res: Response): Promise<Response> => {
    try {
        const { id } = req.params;
        const userId = getUserId(req);

        const result = await instituteService.deleteInstitute(id, userId);

        return successResponse(res, result, 'Institute deleted successfully');
    } catch (error: any) {
        if (error.message === 'Institute not found') {
            return notFoundResponse(res, error.message);
        }
        return serverErrorResponse(res, error.message || 'Failed to delete institute');
    }
};
