import { Request, Response } from 'express';
import * as inviteService from './invite.service';
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
    serverErrorResponse
} from '../../utils/response-helpers';
import { logSecurityEvent } from '../../utils/security-logger';
import { INVITE_REFUSALS } from './invite-validation';

// ─── Invite Students ──────────────────────────────────────────────────────────

export const inviteStudents = async (
    req: Request,
    res: Response
): Promise<Response> => {
    try {
        const { testId } = req.params;
        const { studentIds } = req.body;
        const user = (req as any).user;
        const userId: string = user?.userId;
        const instituteId: string = user?.instituteId;

        if (!testId) {
            return badRequestResponse(res, 'testId is required');
        }

        if (!Array.isArray(studentIds) || !studentIds.length) {
            return badRequestResponse(res, 'studentIds must be a non-empty array');
        }

        if (!userId || !instituteId) {
            return unauthorizedResponse(res, 'Unauthorized');
        }

        const result = await inviteService.inviteStudents(
            testId,
            studentIds,
            userId,
            instituteId
        );

        logSecurityEvent('sensitive_admin_action', {
            userId,
            instituteId,
            role: user?.role,
            action: 'create_invites',
            resourceType: 'test',
            resourceId: testId,
        });

        return createdResponse(
            res,
            result,
            `${result.created} student(s) invited, ${result.skipped} skipped`
        );
    } catch (error: any) {
        if (error.message.includes('not found')) {
            logSecurityEvent('authorization_denied', {
                userId: (req as any).user?.userId,
                instituteId: (req as any).user?.instituteId,
                role: (req as any).user?.role,
                action: 'create_invites',
                resourceType: 'test',
                resourceId: req.params.testId,
                reason: 'not_found_in_scope',
            });
            return notFoundResponse(res, error.message);
        }
        if (error.message.includes('access denied')) {
            return forbiddenResponse(res, error.message);
        }
        return badRequestResponse(res, error.message || 'Failed to invite students');
    }
};

// ─── Get Invites for a Test ───────────────────────────────────────────────────

export const getTestInvites = async (
    req: Request,
    res: Response
): Promise<Response> => {
    try {
        const { testId } = req.params;
        const user = (req as any).user;
        const instituteId: string = user?.instituteId;

        if (!testId) {
            return badRequestResponse(res, 'testId is required');
        }

        if (!instituteId) {
            return unauthorizedResponse(res, 'Unauthorized');
        }

        const invites = await inviteService.getTestInvites(testId, instituteId);

        return successResponse(res, invites, 'Test invites fetched successfully');
    } catch (error: any) {
        if (error.message.includes('not found')) {
            return notFoundResponse(res, error.message);
        }
        if (error.message.includes('access denied')) {
            return forbiddenResponse(res, error.message);
        }
        return serverErrorResponse(res, error.message || 'Failed to fetch test invites');
    }
};

// ─── Get Invites for a Student ────────────────────────────────────────────────

export const getStudentInvites = async (
    req: Request,
    res: Response
): Promise<Response> => {
    try {
        const { studentId } = req.params;
        const user = (req as any).user;
        const instituteId: string = user?.instituteId;

        if (!studentId) {
            return badRequestResponse(res, 'studentId is required');
        }

        if (!instituteId) {
            return unauthorizedResponse(res, 'Unauthorized');
        }

        const invites = await inviteService.getStudentInvites(
            studentId,
            instituteId
        );

        return successResponse(res, invites, 'Student invites fetched successfully');
    } catch (error: any) {
        if (error.message.includes('not found')) {
            return notFoundResponse(res, error.message);
        }
        if (error.message.includes('access denied')) {
            return forbiddenResponse(res, error.message);
        }
        return serverErrorResponse(res, error.message || 'Failed to fetch student invites');
    }
};

export const getAllInvites = async (
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

        // SEC-05: the tenant comes only from the verified JWT. Query values are never read as the scope.
        const instituteId: string = (req as any).user?.instituteId || '';

        const data = await inviteService.getAllInvites({
            page: Number(page),
            limit: Number(limit),
            instituteId
        });

        const total = await inviteService.countInvites(instituteId);
        const pagination = calculatePagination(page, limit, total);

        return paginatedResponse(res, data, pagination, 'Invites fetched successfully');
    } catch (error: any) {
        if (error.message === 'Institute scope is required') {
            return forbiddenResponse(res, 'Forbidden: Institute scope is required');
        }
        return serverErrorResponse(res, error.message || 'Failed to fetch invites');
    }
};

// ─── Soft Delete Invite ───────────────────────────────────────────────────────

export const deleteInvite = async (
    req: Request,
    res: Response
): Promise<Response> => {
    try {
        const { id } = req.params;
        const user = (req as any).user;
        const userId: string = user?.userId;
        const instituteId: string = user?.instituteId;

        if (!id) {
            return badRequestResponse(res, 'Invite ID is required');
        }

        if (!userId || !instituteId) {
            return unauthorizedResponse(res, 'Unauthorized');
        }

        const deleted = await inviteService.deleteInvite(id, userId, instituteId);

        logSecurityEvent('sensitive_admin_action', {
            userId,
            instituteId,
            role: user?.role,
            action: 'revoke_invite',
            resourceType: 'invite',
            resourceId: id,
        });

        return successResponse(res, deleted, 'Invite deleted successfully');
    } catch (error: any) {
        if (error.message.includes('not found')) {
            logSecurityEvent('authorization_denied', {
                userId: (req as any).user?.userId,
                instituteId: (req as any).user?.instituteId,
                role: (req as any).user?.role,
                action: 'revoke_invite',
                resourceType: 'invite',
                resourceId: req.params.id,
                reason: 'not_found_in_scope',
            });
            return notFoundResponse(res, error.message);
        }
        if (error.message.includes('access denied')) {
            return forbiddenResponse(res, error.message);
        }
        if (error.message.includes('completed')) {
            return conflictResponse(res, error.message);
        }
        return badRequestResponse(res, error.message || 'Failed to delete invite');
    }
};

// ─── Candidate Assessment (DEC-03) ────────────────────────────────────────────

/**
 * DEC-03: no JWT is read here. Every refusal (unknown, expired, revoked, completed, or an inactive parent)
 * returns the same 404, so a caller cannot tell the cases apart. The token is never logged, only the fixed reason.
 */
export const getCandidateAssessment = async (req: Request, res: Response) => {
    try {
        const { token } = req.body;

        if (!token || typeof token !== 'string') {
            return badRequestResponse(res, 'token is required');
        }

        const data = await inviteService.getCandidateAssessment(token);
        return successResponse(res, data, 'Assessment fetched successfully');
    } catch (error: any) {
        if (INVITE_REFUSALS.includes(error.message)) {
            logSecurityEvent('invite_validation_failed', {
                action: 'load_assessment',
                resourceType: 'invite',
                reason: error.message,
            });
            return notFoundResponse(res, 'Assessment is not available for this invite');
        }
        return serverErrorResponse(res, error.message || 'Failed to load assessment');
    }
};
