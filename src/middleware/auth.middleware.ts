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
        const decoded = jwt.verify(token, env.JWT_SECRET) as { userId: string; role: string; instituteId?: string };
        req.user = decoded;
        next();
    } catch (err) {
        // Only the failure kind is logged. The token itself and the jwt error text are never written.
        const reason = err instanceof jwt.TokenExpiredError ? 'expired' : 'invalid';
        logSecurityEvent('auth_failed', { reason });
        return res.status(401).json({ message: 'Invalid token' });
    }
};
