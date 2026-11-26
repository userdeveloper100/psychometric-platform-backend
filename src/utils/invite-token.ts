import { createHash, randomBytes } from 'crypto';

/**
 * DEC-02: a user invite token is 256 random bits. Only its SHA-256 hash is stored, so a database read
 * cannot be turned into a working invite. The raw token leaves the server once, at creation.
 */
export const generateInviteToken = (): string => randomBytes(32).toString('hex');

export const hashInviteToken = (token: string): string =>
    createHash('sha256').update(token).digest('hex');
