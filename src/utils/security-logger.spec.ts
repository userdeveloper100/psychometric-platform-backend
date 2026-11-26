import logger from '../config/logger';
import { buildSecurityEntry, logSecurityEvent } from './security-logger';

jest.mock('../config/logger', () => ({
    __esModule: true,
    default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const NOW = new Date('2026-11-25T10:00:00.000Z');
const ALLOWED_KEYS = ['event', 'timestamp', 'userId', 'instituteId', 'role', 'resourceType', 'resourceId', 'action', 'reason'];
// A JWT-shaped value with a real-looking signature segment.
const JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiJ1MSJ9.c2lnbmF0dXJlLXNlZ21lbnQ';

describe('security-logger: structured fields', () => {
    test('emits the event, timestamp and the safe metadata fields', () => {
        const entry = buildSecurityEntry(
            'authorization_denied',
            { userId: 'u1', instituteId: 'i1', role: 'STUDENT', action: 'POST /api/v1/tests', reason: 'role_not_permitted' },
            NOW
        );

        expect(entry).toEqual({
            event: 'authorization_denied',
            timestamp: '2026-11-25T10:00:00.000Z',
            userId: 'u1',
            instituteId: 'i1',
            role: 'STUDENT',
            action: 'POST /api/v1/tests',
            reason: 'role_not_permitted',
        });
    });

    test('logSecurityEvent writes one warn entry named security_event with the structured object', () => {
        logSecurityEvent('auth_failed', { reason: 'expired' });

        expect(logger.warn).toHaveBeenCalledTimes(1);
        const [message, meta] = (logger.warn as jest.Mock).mock.calls[0];
        expect(message).toBe('security_event');
        expect(meta).toEqual(expect.objectContaining({ event: 'auth_failed', reason: 'expired' }));
        expect(typeof meta.timestamp).toBe('string');
    });

    test('an omitted or empty field is left out, not written as an empty string', () => {
        const entry = buildSecurityEntry('auth_failed', { reason: 'missing', userId: '' });
        expect(entry).not.toHaveProperty('userId');
        expect(entry).not.toHaveProperty('role');
    });

    test('a value longer than 128 characters is dropped', () => {
        const entry = buildSecurityEntry('auth_failed', { reason: 'x'.repeat(200) });
        expect(entry).not.toHaveProperty('reason');
    });
});

describe('security-logger: redaction (never log secrets)', () => {
    test('a field that is not on the allowlist is dropped, even when a caller passes it', () => {
        const dirty = {
            userId: 'u1',
            token: 'raw-invite-token',
            password: 'correct horse',
            passwordHash: '$2b$10$abcdefghijklmnopqrstuv',
            authorization: 'Bearer abc',
            responses: [{ questionId: 'q1', answer: 5 }],
        } as unknown as Parameters<typeof buildSecurityEntry>[1];

        const entry = buildSecurityEntry('invite_validation_failed', dirty, NOW);

        expect(Object.keys(entry).sort()).toEqual(['event', 'timestamp', 'userId']);
        expect(JSON.stringify(entry)).not.toMatch(/raw-invite-token|correct horse|\$2b\$|Bearer|questionId/);
    });

    test('a JWT-shaped value in an allowed field is replaced by omission, never logged', () => {
        const entry = buildSecurityEntry('auth_failed', { reason: JWT, userId: JWT });
        expect(entry).not.toHaveProperty('reason');
        expect(entry).not.toHaveProperty('userId');
        expect(JSON.stringify(entry)).not.toContain(JWT);
    });

    test('the logged object only ever has allowlisted keys', () => {
        logSecurityEvent('sensitive_admin_action', {
            userId: 'u1',
            instituteId: 'i1',
            action: 'publish',
            resourceType: 'test',
            resourceId: 'test-1',
            token: 'leak',
        } as never);

        const [, meta] = (logger.warn as jest.Mock).mock.calls[0];
        for (const key of Object.keys(meta)) {
            expect(ALLOWED_KEYS).toContain(key);
        }
        expect(JSON.stringify(meta)).not.toContain('leak');
    });
});
