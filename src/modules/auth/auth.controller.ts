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
    notFoundResponse,
    paginatedResponse,
    calculatePagination,
    validatePagination,
    serverErrorResponse
} from '../../utils/response-helpers';
import { logSecurityEvent } from '../../utils/security-logger';
import { USER_INVITE_REFUSAL } from './auth.service';

// DEC-01: staff and candidate roles an ADMIN may invite. SUPER_ADMIN is never invitable (checked first, below).
const INVITE_ROLES: readonly string[] = ['ADMIN', 'RECRUITER', 'EVALUATOR', 'STUDENT'];
const DEFAULT_INVITE_DAYS = 7;
const MAX_INVITE_DAYS = 30;
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * DEC-02: public registration is closed. An account is created only from an ADMIN's invite
 * (POST /api/v1/auth/invites), accepted with POST /api/v1/auth/accept-invite. The body is not read.
 */
export const register = async (req: Request, res: Response): Promise<Response> => {
    const user = (req as AuthRequest).user;
    logSecurityEvent('authorization_denied', {
        userId: user?.userId,
        instituteId: user?.instituteId,
        role: user?.role,
        action: 'POST /api/v1/auth/register',
        reason: 'public_registration_disabled',
    });
    return forbiddenResponse(res, 'Public registration is disabled. An invitation is required.');
};

export const login = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        // Validate required fields
        if (!email || !password) {
            return badRequestResponse(res, 'email and password are required');
        }

        const result = await authService.login({ email, password });
        return successResponse(res, result, 'Login successful');
    } catch (error: any) {
        // Handle invalid credentials
        if (error.message === 'Invalid credentials') {
            return unauthorizedResponse(res, error.message);
        }

        return serverErrorResponse(res, error.message || 'Login failed');
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

        // Release gate (Step 12): the tenant comes only from the verified token. The count uses the same scope.
        const instituteId = authReq.user.instituteId;
        if (!instituteId) {
            return forbiddenResponse(res, 'Forbidden: Institute scope is required');
        }

        const users = await authService.getAllUsers({ page: Number(page), limit: Number(limit), instituteId });

        // Calculate total for pagination metadata
        const total = await prisma.user.count({ where: { isActive: true, instituteId } });
        const pagination = calculatePagination(page, limit, total);

        return paginatedResponse(res, users, pagination, 'Users fetched successfully');
    } catch (error: any) {
        return serverErrorResponse(res, error.message || 'Failed to fetch users');
    }
};

/**
 * DEC-02: the expiry must be a valid date in the future, at most MAX_INVITE_DAYS ahead. Omitted, it defaults to
 * DEFAULT_INVITE_DAYS. Returns null when the value is not acceptable.
 */
const resolveInviteExpiry = (value: unknown, now: Date): Date | null => {
    if (value === undefined || value === null || value === '') {
        return new Date(now.getTime() + DEFAULT_INVITE_DAYS * DAY_MS);
    }
    if (typeof value !== 'string') return null;
    const expiresAt = new Date(value);
    if (Number.isNaN(expiresAt.getTime())) return null;
    if (expiresAt.getTime() <= now.getTime()) return null;
    if (expiresAt.getTime() > now.getTime() + MAX_INVITE_DAYS * DAY_MS) return null;
    return expiresAt;
};

/**
 * DEC-02: ADMIN issues a user invite in the caller's institute. The institute comes only from the verified token,
 * so an instituteId in the body is ignored. The raw token is shown once, in this response, and never again.
 */
export const createUserInvite = async (req: Request, res: Response): Promise<Response> => {
    try {
        const authReq = req as AuthRequest;
        const instituteId = authReq.user?.instituteId;
        if (!instituteId) {
            return forbiddenResponse(res, 'Forbidden: Institute scope is required');
        }

        const { email, role, expiresAt } = req.body ?? {};

        if (typeof email !== 'string' || !EMAIL_SHAPE.test(email.trim())) {
            return badRequestResponse(res, 'A valid email is required');
        }
        // DEC-01: privilege escalation is refused before any other check. Only SUPER_ADMIN provisioning creates that role.
        if (role === 'SUPER_ADMIN') {
            logSecurityEvent('authorization_denied', {
                userId: authReq.user?.userId,
                instituteId,
                role: authReq.user?.role,
                action: 'POST /api/v1/auth/invites',
                reason: 'privilege_escalation_blocked',
            });
            return forbiddenResponse(res, 'SUPER_ADMIN accounts cannot be invited');
        }
        if (typeof role !== 'string' || !INVITE_ROLES.includes(role)) {
            return badRequestResponse(res, 'role must be ADMIN, RECRUITER, EVALUATOR or STUDENT');
        }
        const expiry = resolveInviteExpiry(expiresAt, new Date());
        if (!expiry) {
            return badRequestResponse(res, `expiresAt must be a future date within ${MAX_INVITE_DAYS} days`);
        }

        const { invite, token } = await authService.createUserInvite({
            email: email.trim(),
            role: role as 'ADMIN' | 'RECRUITER' | 'EVALUATOR' | 'STUDENT',
            expiresAt: expiry,
            instituteId,
            createdBy: authReq.user!.userId,
        });

        logSecurityEvent('sensitive_admin_action', {
            userId: authReq.user!.userId,
            instituteId,
            role: authReq.user!.role,
            action: 'create_user_invite',
            resourceType: 'user_invite',
            resourceId: invite.id,
        });

        return createdResponse(res, { invite, token }, 'User invite created. The token is shown once.');
    } catch (error: any) {
        return serverErrorResponse(res, error.message || 'Failed to create user invite');
    }
};

/** DEC-02: ADMIN lists the user invites of the caller's institute. Token hashes and raw tokens are never returned. */
export const listUserInvites = async (req: Request, res: Response): Promise<Response> => {
    try {
        const page = (req.query.page as string) || '1';
        const limit = (req.query.limit as string) || '10';

        const validation = validatePagination(page, limit);
        if (!validation.valid) {
            return badRequestResponse(res, validation.error);
        }

        const instituteId = (req as AuthRequest).user?.instituteId;
        if (!instituteId) {
            return forbiddenResponse(res, 'Forbidden: Institute scope is required');
        }

        const data = await authService.listUserInvites({ page: Number(page), limit: Number(limit), instituteId });
        const total = await authService.countUserInvites(instituteId);
        const pagination = calculatePagination(page, limit, total);

        return paginatedResponse(res, data, pagination, 'User invites fetched successfully');
    } catch (error: any) {
        return serverErrorResponse(res, error.message || 'Failed to fetch user invites');
    }
};

/** DEC-02: ADMIN revokes a pending invite of the caller's institute. A foreign invite is reported as not found. */
export const revokeUserInvite = async (req: Request, res: Response): Promise<Response> => {
    try {
        const authReq = req as AuthRequest;
        const { id } = req.params;
        if (!id) {
            return badRequestResponse(res, 'Invite ID is required');
        }

        const instituteId = authReq.user?.instituteId;
        if (!instituteId) {
            return forbiddenResponse(res, 'Forbidden: Institute scope is required');
        }

        const data = await authService.revokeUserInvite({
            id,
            adminId: authReq.user!.userId,
            instituteId,
        });

        logSecurityEvent('sensitive_admin_action', {
            userId: authReq.user!.userId,
            instituteId,
            role: authReq.user!.role,
            action: 'revoke_user_invite',
            resourceType: 'user_invite',
            resourceId: id,
        });

        return successResponse(res, data, 'User invite revoked successfully');
    } catch (error: any) {
        if (error.message === 'Invite not found') {
            return notFoundResponse(res, 'Invite not found');
        }
        return serverErrorResponse(res, error.message || 'Failed to revoke user invite');
    }
};

/**
 * DEC-02: public, token-bound. The token, name and password are read from the body only, never the URL.
 * Every refusal returns one generic 400 and logs invite_validation_failed without the token.
 */
export const acceptUserInvite = async (req: Request, res: Response): Promise<Response> => {
    try {
        const { token, name, password } = req.body ?? {};

        if (typeof token !== 'string' || !token || typeof name !== 'string' || !name.trim()
            || typeof password !== 'string' || !password) {
            return badRequestResponse(res, 'token, name and password are required');
        }

        const user = await authService.acceptUserInvite({ token, password });
        return createdResponse(res, user, 'Account created successfully');
    } catch (error: any) {
        if (error.message === USER_INVITE_REFUSAL) {
            logSecurityEvent('invite_validation_failed', {
                action: 'accept_user_invite',
                resourceType: 'user_invite',
                reason: error.message,
            });
            return badRequestResponse(res, USER_INVITE_REFUSAL);
        }
        return serverErrorResponse(res, error.message || 'Failed to accept invite');
    }
};
