import { Request, Response } from 'express';
import * as responseService from './response.service';
import prisma from '../../config/prisma';
import {
    successResponse,
    createdResponse,
    badRequestResponse,
    notFoundResponse,
    paginatedResponse,
    validatePagination,
    calculatePagination,
    calculateSkip,
    serverErrorResponse
} from '../../utils/response-helpers';

const getUserId = (req: Request): string => {
    const user = (req as any).user;
    return user?.id || user?.userId || 'system';
};

export const submitResponses = async (req: Request, res: Response): Promise<Response> => {
    try {
        const { token, studentId, responses } = req.body;
        const userId = getUserId(req);

        if (!token || !studentId || !responses || responses.length === 0) {
            return badRequestResponse(res, 'token, studentId, and responses are required');
        }

        const result = await responseService.submitResponses(
            { token, studentId, responses },
            userId
        );

        return createdResponse(res, result, 'Responses submitted successfully');
    } catch (error: any) {
        if (error.message === 'Invalid or inactive invite token' || 
            error.message === 'Responses already submitted for this invite' ||
            error.message === 'Student does not match invite') {
            return badRequestResponse(res, error.message);
        }
        return serverErrorResponse(res, error.message || 'Failed to submit responses');
    }
};

export const getStudentResponses = async (req: Request, res: Response): Promise<Response> => {
    try {
        const { studentId } = req.params;

        if (!studentId) {
            return badRequestResponse(res, 'Student ID is required');
        }

        const data = await responseService.getStudentResponses(studentId);
        return successResponse(res, data, 'Student responses fetched successfully');
    } catch (error: any) {
        return serverErrorResponse(res, error.message || 'Failed to fetch student responses');
    }
};

export const getTestResponses = async (req: Request, res: Response): Promise<Response> => {
    try {
        const { testId } = req.params;

        if (!testId) {
            return badRequestResponse(res, 'Test ID is required');
        }

        const data = await responseService.getTestResponses(testId);
        return successResponse(res, data, 'Test responses fetched successfully');
    } catch (error: any) {
        return serverErrorResponse(res, error.message || 'Failed to fetch test responses');
    }
};

export const getAllResponses = async (req: Request, res: Response): Promise<Response> => {
    try {
        const page = (req.query.page as string) || '1';
        const limit = (req.query.limit as string) || '10';

        const validation = validatePagination(page, limit);
        if (!validation.valid) {
            return badRequestResponse(res, validation.error);
        }

        const skip = calculateSkip(page, limit);
        const data = await responseService.getAllResponses({ page: Number(page), limit: Number(limit) });

        const total = await prisma.response.count({ where: { isActive: true } });
        const pagination = calculatePagination(page, limit, total);

        return paginatedResponse(res, data, pagination, 'Responses fetched successfully');
    } catch (error: any) {
        return serverErrorResponse(res, error.message || 'Failed to fetch responses');
    }
};

export const deleteResponse = async (req: Request, res: Response): Promise<Response> => {
    try {
        const { id } = req.params;
        const userId = getUserId(req);

        if (!id) {
            return badRequestResponse(res, 'Response ID is required');
        }

        const result = await responseService.deleteResponse(id, userId);
        return successResponse(res, result, 'Response deleted successfully');
    } catch (error: any) {
        if (error.message === 'Response not found') {
            return notFoundResponse(res, error.message);
        }
        return serverErrorResponse(res, error.message || 'Failed to delete response');
    }
};
