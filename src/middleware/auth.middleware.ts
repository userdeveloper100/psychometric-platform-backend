import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { logSecurityEvent } from '../utils/security-logger';

export interface AuthRequest extends Request {
    user?: { userId: string; role: string; instituteId?: string };
}

export const authenticateJWT = (
    req: AuthRequest,
    res: Response,
    next: NextFunction
) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        logSecurityEvent('auth_failed', { reason: 'missing' });
        return res.status(401).json({ message: 'No token provided' });
    }
    if (!authHeader.startsWith('Bearer ') || !authHeader.split(' ')[1]) {
        logSecurityEvent('auth_failed', { reason: 'malformed' });
        return res.status(401).json({ message: 'No token provided' });
    }
    const token = authHeader.split(' ')[1];
    try {
        // Same validated secret that utils/jwt.ts signs with.
        const decoded = jwt.verify(token, env.JWT_SECRET) as { userId: string; role: string; instituteId?: string | null };
        // DEC-01: SUPER_ADMIN is the only platform-level role. Every other role must carry an institute. Same fail-closed
        // 403 that the tenant routes return, so the response does not change with the route.
        if (decoded.role !== 'SUPER_ADMIN' && !decoded.instituteId) {
            logSecurityEvent('auth_failed', { reason: 'institute_scope_missing', userId: decoded.userId, role: decoded.role });
            return res.status(403).json({ message: 'Forbidden: Institute scope is required' });
        }
        req.user = { ...decoded, instituteId: decoded.instituteId ?? undefined };
        next();
    } catch (err) {
        // Only the failure kind is logged. The token itself and the jwt error text are never written.
        const reason = err instanceof jwt.TokenExpiredError ? 'expired' : 'invalid';
        logSecurityEvent('auth_failed', { reason });
        return res.status(401).json({ message: 'Invalid token' });
    }
};
