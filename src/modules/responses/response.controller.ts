import { Request, Response } from 'express';
import * as responseService from './response.service';
import {
    successResponse,
    createdResponse,
    badRequestResponse,
    forbiddenResponse,
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

/**
 * SEC-03: the tenant comes only from the verified JWT. Query, params and body values are never read here.
 * Returns '' when the token has no institute, and the service then fails closed.
 */
const getRequesterInstituteId = (req: Request): string => {
    const user = (req as any).user;
    return user?.instituteId || '';
};

/** Maps the service's scope and not-found errors to HTTP. Anything else is a server error. */
const handleScopedError = (res: Response, error: any, fallback: string): Response => {
    if (error.message === 'Institute scope is required') {
        return forbiddenResponse(res, 'Forbidden: Institute scope is required');
    }
    if (error.message === 'Student not found' || error.message === 'Test not found' || error.message === 'Response not found') {
        return notFoundResponse(res, error.message);
    }
    return serverErrorResponse(res, error.message || fallback);
};

/**
 * DB-03: a refused submission (bad invite, wrong student, foreign or inactive question, duplicate or
 * out-of-range answer) is a client error, so it maps to 400. Only unexpected failures reach 500.
 * Messages never include the invite token.
 */
const SUBMISSION_REFUSALS: readonly string[] = [
    'Token is required',
    'Student ID is required',
    'Responses are required',
    'Each response needs a questionId and an integer answer',
    'Duplicate question answers are not allowed',
    'Invalid or inactive invite token',
    'Responses already submitted for this invite',
    'Invite has expired',
    'Student does not match invite',
    'One or more questions are invalid or inactive',
];

const isSubmissionRefusal = (message: string): boolean =>
    SUBMISSION_REFUSALS.includes(message) || /^Answer for question .+ must be between /.test(message);

export const submitResponses = async (req: Request, res: Response): Promise<Response> => {
    try {
        const { token, studentId, responses } = req.body;
        const userId = getUserId(req);

        if (!token || !studentId || !Array.isArray(responses) || responses.length === 0) {
            return badRequestResponse(res, 'token, studentId, and responses are required');
        }

        const result = await responseService.submitResponses(
            { token, studentId, responses },
            userId
        );

        return createdResponse(res, result, 'Responses submitted successfully');
    } catch (error: any) {
        if (isSubmissionRefusal(error.message)) {
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

        const data = await responseService.getStudentResponses(studentId, getRequesterInstituteId(req));
        return successResponse(res, data, 'Student responses fetched successfully');
    } catch (error: any) {
        return handleScopedError(res, error, 'Failed to fetch student responses');
    }
};

export const getTestResponses = async (req: Request, res: Response): Promise<Response> => {
    try {
        const { testId } = req.params;

        if (!testId) {
            return badRequestResponse(res, 'Test ID is required');
        }

        const data = await responseService.getTestResponses(testId, getRequesterInstituteId(req));
        return successResponse(res, data, 'Test responses fetched successfully');
    } catch (error: any) {
        return handleScopedError(res, error, 'Failed to fetch test responses');
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

        const instituteId = getRequesterInstituteId(req);
        const skip = calculateSkip(page, limit);
        const data = await responseService.getAllResponses({
            page: Number(page),
            limit: Number(limit),
            instituteId
        });

        const total = await responseService.countResponses(instituteId);
        const pagination = calculatePagination(page, limit, total);

        return paginatedResponse(res, data, pagination, 'Responses fetched successfully');
    } catch (error: any) {
        return handleScopedError(res, error, 'Failed to fetch responses');
    }
};

export const deleteResponse = async (req: Request, res: Response): Promise<Response> => {
    try {
        const { id } = req.params;
        const userId = getUserId(req);

        if (!id) {
            return badRequestResponse(res, 'Response ID is required');
        }

        const result = await responseService.deleteResponse(id, userId, getRequesterInstituteId(req));
        return successResponse(res, result, 'Response deleted successfully');
    } catch (error: any) {
        return handleScopedError(res, error, 'Failed to delete response');
    }
};
