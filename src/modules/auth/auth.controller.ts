import { Request, Response } from 'express';
import * as authService from './auth.service';
import { AuthRequest } from '../../middleware/auth.middleware';
import prisma from '../../config/prisma';
import {
    successResponse,
    createdResponse,
    badRequestResponse,
    unauthorizedResponse,
    forbiddenResponse,
    conflictResponse,
    errorResponse,
    paginatedResponse,
    calculatePagination,
    calculateSkip,
    validatePagination,
    handlePrismaError,
    serverErrorResponse
} from '../../utils/response-helpers';
import { ErrorCode } from '../../types/api-response.types';

export const register = async (req: Request, res: Response): Promise<Response> => {
    try {
        const { instituteName, email, password } = req.body;

        // Validate required fields
        if (!instituteName || !email || !password) {
            return badRequestResponse(
                res,
                'instituteName, email and password are required',
                { required: ['instituteName', 'email', 'password'] }
            );
        }

        // Extract user context for createdBy (if authenticated)
        const authReq = req as AuthRequest;
        const createdBy = authReq.user?.userId;

        // Call registerInstituteAdmin from auth service
        const result = await authService.registerInstituteAdmin({
            instituteName,
            email,
            password,
            createdBy
        });

        // Return token and user info
        createdResponse(res, { token: result.token, user: result.user }, 'Institute admin registered successfully');
    } catch (error: any) {
        // Handle Prisma errors
        if (error.code?.startsWith('P')) {
            const { code, message } = handlePrismaError(error);
            return errorResponse(res, code, message);
        }

        // Handle duplicate email error
        if (error.message === 'Email already registered') {
            return conflictResponse(res, error.message);
        }

        serverErrorResponse(res, error.message || 'Failed to register institute admin');
    }
};

export const login = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        // Validate required fields
        if (!email || !password) {
            return badRequestResponse(res, 'email and password are required');
        }

        const result = await authService.login({ email, password });
        successResponse(res, result, 'Login successful');
    } catch (error: any) {
        // Handle invalid credentials
        if (error.message === 'Invalid credentials') {
            return unauthorizedResponse(res, error.message);
        }

        serverErrorResponse(res, error.message || 'Login failed');
    }
};

export const getAllUsers = async (req: Request, res: Response): Promise<Response> => {
    try {
        // Check if user is admin
        const authReq = req as AuthRequest;
        if (!authReq.user || authReq.user.role !== 'ADMIN') {
            return forbiddenResponse(res, 'Access denied. Admin role required.');
        }

        const page = (req.query.page as string) || '1';
        const limit = (req.query.limit as string) || '10';

        // Validate pagination params
        const validation = validatePagination(page, limit);
        if (!validation.valid) {
            return badRequestResponse(res, validation.error);
        }

        const skip = calculateSkip(page, limit);
        const users = await authService.getAllUsers({ page: Number(page), limit: Number(limit) });

        // Calculate total for pagination metadata
        const total = await prisma.user.count({ where: { isActive: true } });
        const pagination = calculatePagination(page, limit, total);

        return paginatedResponse(res, users, pagination, 'Users fetched successfully');
    } catch (error: any) {
        serverErrorResponse(res, error.message || 'Failed to fetch users');
    }
};
