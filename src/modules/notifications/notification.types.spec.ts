import {
    assertNoSecrets,
    buildJobMeta,
    DEFAULT_MAX_ATTEMPTS,
    NotificationInput,
    NotificationPayloadError,
    retryDelayMs,
    safeLogFields,
} from './notification.types';

const RAW_TOKEN = 'a'.repeat(64);
const ENQUEUED_AT = new Date('2026-11-26T10:00:00.000Z');

const input = (overrides: Partial<NotificationInput> = {}): NotificationInput => ({
    type: 'SEND_TEST_INVITE',
    inviteId: 'invite-1',
    instituteId: 'institute-a',
    recipientEmail: 'candidate@example.com',
    inviteToken: RAW_TOKEN,
    ...overrides,
});

describe('buildJobMeta', () => {
    test('builds the safe metadata for a valid input, with a fresh attempt counter', () => {
        const meta = buildJobMeta(input(), 'job-1', ENQUEUED_AT);

        expect(meta).toEqual({
            jobId: 'job-1',
            type: 'SEND_TEST_INVITE',
            inviteId: 'invite-1',
            instituteId: 'institute-a',
            recipientEmail: 'candidate@example.com',
            attempt: 0,
            maxAttempts: DEFAULT_MAX_ATTEMPTS,
            enqueuedAt: '2026-11-26T10:00:00.000Z',
        });
    });

    test('never copies the raw token, even when the caller passes extra fields', () => {
        const sneaky = { ...input(), token: RAW_TOKEN, password: 'hunter2' } as NotificationInput;
        const meta = buildJobMeta(sneaky, 'job-1', ENQUEUED_AT);

        expect(JSON.stringify(meta)).not.toContain(RAW_TOKEN);
        expect(JSON.stringify(meta)).not.toContain('hunter2');
        expect(Object.keys(meta).sort()).toEqual(
            ['attempt', 'enqueuedAt', 'inviteId', 'instituteId', 'jobId', 'maxAttempts', 'recipientEmail', 'type'].sort()
        );
    });

    test('trims the recipient address', () => {
        expect(buildJobMeta(input({ recipientEmail: '  staff@example.com ' }), 'j', ENQUEUED_AT).recipientEmail).toBe(
            'staff@example.com'
        );
    });

    test.each([
        ['an unknown type', { type: 'SEND_SMS' as never }, 'invalid_type'],
        ['a missing invite id', { inviteId: '' }, 'missing_scope'],
        ['a missing institute id', { instituteId: '' }, 'missing_scope'],
        ['an empty recipient', { recipientEmail: '   ' }, 'invalid_recipient'],
        ['a recipient without a domain', { recipientEmail: 'nobody@localhost' }, 'invalid_recipient'],
        ['a recipient with spaces', { recipientEmail: 'a b@example.com' }, 'invalid_recipient'],
    ])('rejects %s', (_label, overrides, code) => {
        expect(() => buildJobMeta(input(overrides), 'j', ENQUEUED_AT)).toThrow(NotificationPayloadError);
        expect(() => buildJobMeta(input(overrides), 'j', ENQUEUED_AT)).toThrow(code);
    });
});

describe('assertNoSecrets', () => {
    const meta = buildJobMeta(input(), 'job-1', ENQUEUED_AT);

    test('passes for safe metadata', () => {
        expect(() => assertNoSecrets(meta, RAW_TOKEN)).not.toThrow();
    });

    test('rejects a job that contains the raw token itself', () => {
        expect(() => assertNoSecrets({ ...meta, inviteId: `x-${RAW_TOKEN}` }, RAW_TOKEN)).toThrow('secret_value');
    });

    test('rejects a value shaped like a 256-bit hex token, even when it is not this token', () => {
        expect(() => assertNoSecrets({ ...meta, inviteId: 'b'.repeat(64) }, RAW_TOKEN)).toThrow('secret_value');
    });

    test('rejects a value shaped like a JWT', () => {
        const jwt = 'eyJhbGciOi.eyJ1c2VySWQi.c2lnbmF0dXJl';
        expect(() => assertNoSecrets({ ...meta, inviteId: jwt }, RAW_TOKEN)).toThrow('secret_value');
    });

    test.each(['token', 'password', 'jwtSecret', 'authorization', 'tokenHash'])('rejects a secret-named key (%s)', (key) => {
        expect(() => assertNoSecrets({ ...meta, [key]: 'anything' }, RAW_TOKEN)).toThrow('secret_field');
    });
});

describe('retryDelayMs', () => {
    test('doubles from one second and is capped at sixty seconds', () => {
        expect([1, 2, 3].map(retryDelayMs)).toEqual([1000, 2000, 4000]);
        expect(retryDelayMs(10)).toBe(60_000);
    });

    test('treats a zero or negative count as the first delay', () => {
        expect(retryDelayMs(0)).toBe(1000);
    });
});

describe('safeLogFields', () => {
    test('keeps the ids and counters, and leaves out the recipient address', () => {
        const fields = safeLogFields(buildJobMeta(input(), 'job-1', ENQUEUED_AT));

        expect(fields).toEqual({
            jobId: 'job-1',
            type: 'SEND_TEST_INVITE',
            inviteId: 'invite-1',
            instituteId: 'institute-a',
            attempt: 0,
            maxAttempts: DEFAULT_MAX_ATTEMPTS,
        });
        expect(JSON.stringify(fields)).not.toContain('candidate@example.com');
    });
});
