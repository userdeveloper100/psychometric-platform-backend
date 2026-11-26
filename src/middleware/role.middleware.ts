import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import { logSecurityEvent } from '../utils/security-logger';

/** The route template, such as "DELETE /api/v1/tests/:id". No ids, no query string, no body. A root route has no trailing slash. */
const routeAction = (req: Request): string => {
    const path = req.route?.path ?? '';
    return `${req.method} ${req.baseUrl}${path === '/' ? '' : path}`;
};

/**
 * Reusable role check. Use it after authenticateJWT on any route that needs a role.
 *   - 401 when there is no authenticated user (no valid token was verified).
 *   - 403 when the authenticated user's role is not one of the permitted roles.
 * Role values are the Role enum in prisma/schema.prisma: 'ADMIN' | 'STUDENT'.
 */
export const authorizeRoles = (...roles: string[]) => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.user) {
            logSecurityEvent('auth_failed', { reason: 'no_authenticated_user', action: routeAction(req) });
            return res.status(401).json({ message: 'No token provided' });
        }
        if (!roles.includes(req.user.role)) {
            logSecurityEvent('authorization_denied', {
                userId: req.user.userId,
                instituteId: req.user.instituteId,
                role: req.user.role,
                action: routeAction(req),
                reason: 'role_not_permitted',
            });
            return res.status(403).json({ message: 'Forbidden: Insufficient role' });
        }
        next();
    };
};
