import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export interface AppJwtPayload {
    userId: string;
    role: string;
    instituteId?: string | null;
}

// Signing and verification both use the validated secret from src/config/env.ts.
const JWT_SECRET: jwt.Secret = env.JWT_SECRET;

const JWT_EXPIRES_IN: jwt.SignOptions['expiresIn'] = env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'];

export const generateToken = (payload: AppJwtPayload): string => {
    return jwt.sign(payload, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN,
    });
};

export const verifyToken = (token: string): AppJwtPayload => {
    return jwt.verify(token, JWT_SECRET) as AppJwtPayload;
};
