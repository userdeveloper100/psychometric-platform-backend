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
import { logSecurityEvent } from '../../utils/security-logger';

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ─── Create Institute ─────────────────────────────────────────────────────────

export const createInstitute = async (
    req: Request,
    res: Response
): Promise<Response> => {
    try {
        const { name, email, initialAdminEmail } = req.body;

        if (!name || !email) {
            return badRequestResponse(res, 'name and email are required', {
                required: ['name', 'email']
            });
        }
        if (initialAdminEmail !== undefined && (typeof initialAdminEmail !== 'string' || !EMAIL_SHAPE.test(initialAdminEmail.trim()))) {
            return badRequestResponse(res, 'initialAdminEmail must be a valid email');
        }

        // DEC-01: the route allows SUPER_ADMIN only. The actor comes from the verified token.
        const actor = (req as any).user;
        const institute = await instituteService.createInstitute({
            name,
            email,
            initialAdminEmail: initialAdminEmail?.trim(),
            createdBy: actor.userId
        });

        logSecurityEvent('sensitive_admin_action', {
            userId: actor.userId,
            role: actor.role,
            action: 'create_institute',
            resourceType: 'institute',
            resourceId: institute.id,
        });

        return createdResponse(res, institute, 'Institute created successfully');
    } catch (error: any) {
        if (error.message === 'Institute with this email already exists' || error.message === 'Email already registered') {
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

        const instituteId = getRequesterInstituteId(req);
        const skip = calculateSkip(page, limit);
        const data = await instituteService.getAllInstitutes({
            page: Number(page),
            limit: Number(limit),
            instituteId
        });

        const total = await prisma.institute.count({ where: { isActive: true, id: instituteId || '' } });
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

        const institute = await instituteService.getInstituteById(id, getRequesterInstituteId(req));

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

// SEC-02: the tenant scope always comes from the authenticated user. Query, params and body
// instituteId values are never used. Missing scope yields '' and the service fails closed.
const getRequesterInstituteId = (req: Request): string => {
    const user = (req as any).user;
    return user?.instituteId || '';
};

export const updateInstitute = async (req: Request, res: Response): Promise<Response> => {
    try {
        const { id } = req.params;
        const userId = getUserId(req);

        // Only the name is taken from the body. Any other body field, including instituteId, is ignored.
        const institute = await instituteService.updateInstitute(
            id,
            { name: req.body?.name },
            userId,
            getRequesterInstituteId(req)
        );

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

        const requesterInstituteId = getRequesterInstituteId(req);
        const result = await instituteService.deleteInstitute(id, userId, requesterInstituteId);

        logSecurityEvent('sensitive_admin_action', {
            userId,
            instituteId: requesterInstituteId,
            role: (req as any).user?.role,
            action: 'delete_institute',
            resourceType: 'institute',
            resourceId: id,
        });

        return successResponse(res, result, 'Institute deleted successfully');
    } catch (error: any) {
        if (error.message === 'Institute not found') {
            logSecurityEvent('authorization_denied', {
                userId: getUserId(req),
                instituteId: getRequesterInstituteId(req),
                role: (req as any).user?.role,
                action: 'delete_institute',
                resourceType: 'institute',
                resourceId: req.params.id,
                reason: 'not_found_in_scope',
            });
            return notFoundResponse(res, error.message);
        }
        return serverErrorResponse(res, error.message || 'Failed to delete institute');
    }
};
