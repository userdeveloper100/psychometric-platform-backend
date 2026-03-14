import jwt from 'jsonwebtoken';

export interface AppJwtPayload {
    userId: string;
    role: string;
    instituteId?: string | null;
}

const JWT_SECRET: jwt.Secret = process.env.JWT_SECRET || 'dev-secret';

const JWT_EXPIRES_IN: jwt.SignOptions['expiresIn'] =
    (process.env.JWT_EXPIRES_IN || '1d') as jwt.SignOptions['expiresIn'];

export const generateToken = (payload: AppJwtPayload): string => {
    return jwt.sign(payload, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN,
    });
};

export const verifyToken = (token: string): AppJwtPayload => {
    return jwt.verify(token, JWT_SECRET) as AppJwtPayload;
};