import logger from '../config/logger';

/**
 * Structured security events (Step 12). Each event carries only the fields in SECURITY_FIELDS.
 * Any other key is dropped, so a JWT, an Authorization header, a raw invite token, a password,
 * a password hash or a response payload cannot reach the log, even if a caller passes it in by mistake.
 */

export type SecurityEvent =
    | 'auth_failed'
    | 'authorization_denied'
    | 'invite_validation_failed'
    | 'sensitive_admin_action';

export interface SecurityFields {
    userId?: string;
    instituteId?: string;
    role?: string;
    resourceType?: string;
    resourceId?: string;
    action?: string;
    reason?: string;
}

export interface SecurityLogEntry extends SecurityFields {
    event: SecurityEvent;
    timestamp: string;
}

const SECURITY_FIELDS: (keyof SecurityFields)[] = [
    'userId',
    'instituteId',
    'role',
    'resourceType',
    'resourceId',
    'action',
    'reason',
];

const MAX_VALUE_LENGTH = 128;

// A compact JWT is three base64url segments separated by dots.
const JWT_SHAPE = /^[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}$/;

/** A value is kept only if it is a short, non-empty string that does not look like a JWT. */
const isSafeValue = (value: unknown): value is string =>
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= MAX_VALUE_LENGTH &&
    !JWT_SHAPE.test(value);

/** Builds the entry. Pure, so the redaction rules can be tested without a logger. */
export const buildSecurityEntry = (
    event: SecurityEvent,
    fields: SecurityFields = {},
    now: Date = new Date()
): SecurityLogEntry => {
    const entry: SecurityLogEntry = { event, timestamp: now.toISOString() };
    for (const key of SECURITY_FIELDS) {
        const value = fields[key];
        if (isSafeValue(value)) entry[key] = value;
    }
    return entry;
};

/** Writes one structured security event at warn level. Never throws, and never changes an HTTP response. */
export const logSecurityEvent = (event: SecurityEvent, fields: SecurityFields = {}): void => {
    logger.warn('security_event', buildSecurityEntry(event, fields));
};
