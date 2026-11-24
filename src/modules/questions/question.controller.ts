import { Request, Response } from 'express';
import * as questionService from './question.service';
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

        const question = await questionService.createQuestion(
            dimensionId,
            { text, scaleMin, scaleMax },
            getRequesterInstituteId(req)
        );

        return createdResponse(res, question, 'Question created successfully');
    } catch (error: any) {
        if (isMissingScope(error)) {
            return forbiddenResponse(res, 'Forbidden: Institute scope is required');
        }
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

        const questions = await questionService.getDimensionQuestions(dimensionId, getRequesterInstituteId(req));

        return successResponse(res, questions, 'Questions fetched successfully');
    } catch (error: any) {
        if (isMissingScope(error)) {
            return forbiddenResponse(res, 'Forbidden: Institute scope is required');
        }
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

        const instituteId = getRequesterInstituteId(req);
        const data = await questionService.getAllQuestions({
            page: Number(page),
            limit: Number(limit),
            instituteId
        });

        const total = await questionService.countQuestions(instituteId);
        const pagination = calculatePagination(page, limit, total);

        return paginatedResponse(res, data, pagination, 'Questions fetched successfully');
    } catch (error: any) {
        if (isMissingScope(error)) {
            return forbiddenResponse(res, 'Forbidden: Institute scope is required');
        }
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

        const deleted = await questionService.deleteQuestion(id, userId, getRequesterInstituteId(req));

        return successResponse(res, deleted, 'Question deleted successfully');
    } catch (error: any) {
        if (isMissingScope(error)) {
            return forbiddenResponse(res, 'Forbidden: Institute scope is required');
        }
        if (error.message === 'Question not found') {
            return notFoundResponse(res, error.message);
        }
        return badRequestResponse(res, error.message || 'Failed to delete question');
    }
};
