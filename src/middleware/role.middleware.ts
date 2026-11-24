import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';

/**
 * Reusable role check. Use it after authenticateJWT on any route that needs a role.
 *   - 401 when there is no authenticated user (no valid token was verified).
 *   - 403 when the authenticated user's role is not one of the permitted roles.
 * Role values are the Role enum in prisma/schema.prisma: 'ADMIN' | 'STUDENT'.
 */
export const authorizeRoles = (...roles: string[]) => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({ message: 'No token provided' });
        }
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ message: 'Forbidden: Insufficient role' });
        }
        next();
    };
};
