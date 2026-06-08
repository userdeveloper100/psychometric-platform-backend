import { Request, Response } from 'express';
import * as questionService from './question.service';
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

export const createQuestion = async (
    req: Request,
    res: Response
): Promise<Response> => {
    try {
        const { dimensionId } = req.params;
        const { text, scaleMin, scaleMax } = req.body;

        if (!dimensionId) {
            return badRequestResponse(res, 'dimensionId is required');
        }

        if (!text || typeof text !== 'string') {
            return badRequestResponse(res, 'text is required', { required: ['text'] });
        }

        const question = await questionService.createQuestion(dimensionId, {
            text,
            scaleMin,
            scaleMax
        });

        return createdResponse(res, question, 'Question created successfully');
    } catch (error: any) {
        if (error.message === 'Dimension not found') {
            return notFoundResponse(res, error.message);
        }
        return badRequestResponse(res, error.message || 'Failed to create question');
    }
};

export const getDimensionQuestions = async (
    req: Request,
    res: Response
): Promise<Response> => {
    try {
        const { dimensionId } = req.params;

        if (!dimensionId) {
            return badRequestResponse(res, 'dimensionId is required');
        }

        const questions = await questionService.getDimensionQuestions(dimensionId);

        return successResponse(res, questions, 'Questions fetched successfully');
    } catch (error: any) {
        if (error.message === 'Dimension not found') {
            return notFoundResponse(res, error.message);
        }
        return serverErrorResponse(res, error.message || 'Failed to fetch questions');
    }
};

export const getAllQuestions = async (
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

        const data = await questionService.getAllQuestions({
            page: Number(page),
            limit: Number(limit)
        });

        const total = await prisma.question.count({ where: { isActive: true } });
        const pagination = calculatePagination(page, limit, total);

        return paginatedResponse(res, data, pagination, 'Questions fetched successfully');
    } catch (error: any) {
        return serverErrorResponse(res, error.message || 'Failed to fetch questions');
    }
};

export const deleteQuestion = async (
    req: AuthRequest,
    res: Response
): Promise<Response> => {
    try {
        const { id } = req.params;
        const userId = req.user?.userId;

        if (!id) {
            return badRequestResponse(res, 'question id is required');
        }

        if (!userId) {
            return unauthorizedResponse(res, 'Unauthorized');
        }

        const deleted = await questionService.deleteQuestion(id, userId);

        return successResponse(res, deleted, 'Question deleted successfully');
    } catch (error: any) {
        if (error.message === 'Question not found') {
            return notFoundResponse(res, error.message);
        }
        return badRequestResponse(res, error.message || 'Failed to delete question');
    }
};
