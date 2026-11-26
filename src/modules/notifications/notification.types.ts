/**
 * Notification job contract for invite emails.
 *
 * A job carries SAFE METADATA ONLY: ids, the type, the recipient address, and attempt counters.
 * The raw invite token never goes into a job, a queue (Redis or memory) or a log line. It is held by the
 * process-local secret vault in notification.queue.ts until the mailer sends it, and only the mailer sees it.
 */

export const NOTIFICATION_JOB_TYPES = ['SEND_TEST_INVITE', 'SEND_USER_INVITE'] as const;
export type NotificationJobType = (typeof NOTIFICATION_JOB_TYPES)[number];

export interface NotificationJobMeta {
    jobId: string;
    type: NotificationJobType;
    inviteId: string;
    instituteId: string;
    recipientEmail: string;
    /** Delivery attempts made so far. A new job starts at 0. */
    attempt: number;
    maxAttempts: number;
    enqueuedAt: string;
}

/** Input to dispatch. The invite token is passed separately, so it can be kept out of the job. */
export interface NotificationInput {
    type: NotificationJobType;
    inviteId: string;
    instituteId: string;
    recipientEmail: string;
    inviteToken: string;
}

/** A job that exhausted its attempts, or could not run. The reason is a short code, never a provider message. */
export interface DeadLetter {
    meta: NotificationJobMeta;
    reason: string;
    deadAt: string;
}

export const DEFAULT_MAX_ATTEMPTS = 3;
export const RETRY_BASE_DELAY_MS = 1000;
export const RETRY_MAX_DELAY_MS = 60_000;

/** Exponential backoff after the given number of failed attempts: 1s, 2s, 4s, capped at 60s. */
export const retryDelayMs = (failedAttempts: number): number =>
    Math.min(RETRY_BASE_DELAY_MS * 2 ** Math.max(failedAttempts - 1, 0), RETRY_MAX_DELAY_MS);

export class NotificationPayloadError extends Error {
    constructor(readonly code: string) {
        super(code);
        this.name = 'NotificationPayloadError';
    }
}

const MAX_EMAIL_LENGTH = 254;
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Key names that must never reach a job. Checked as a guard; the job builder also whitelists its fields.
const SECRET_KEY_PATTERN = /token|password|secret|jwt|authorization|hash/i;

// Shapes of the secrets this service issues: a 256-bit hex token and a compact JWT.
const HEX_TOKEN_SHAPE = /^[a-f0-9]{64}$/i;
const JWT_SHAPE = /^[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}$/;

/**
 * Builds the job metadata from the input. Only whitelisted fields are copied, so a field the caller adds
 * by mistake (such as the token) is dropped. Throws NotificationPayloadError on invalid input.
 */
export const buildJobMeta = (input: NotificationInput, jobId: string, enqueuedAt: Date): NotificationJobMeta => {
    if (!NOTIFICATION_JOB_TYPES.includes(input.type)) throw new NotificationPayloadError('invalid_type');
    if (!input.inviteId || !input.instituteId) throw new NotificationPayloadError('missing_scope');

    const recipientEmail = typeof input.recipientEmail === 'string' ? input.recipientEmail.trim() : '';
    if (recipientEmail.length === 0 || recipientEmail.length > MAX_EMAIL_LENGTH || !EMAIL_SHAPE.test(recipientEmail)) {
        throw new NotificationPayloadError('invalid_recipient');
    }

    return {
        jobId,
        type: input.type,
        inviteId: input.inviteId,
        instituteId: input.instituteId,
        recipientEmail,
        attempt: 0,
        maxAttempts: DEFAULT_MAX_ATTEMPTS,
        enqueuedAt: enqueuedAt.toISOString(),
    };
};

/**
 * Rejects a job that holds a secret. Checks every key name and every string value, and rejects the raw token
 * itself wherever it appears. This is a guard behind buildJobMeta, not a replacement for it.
 */
export const assertNoSecrets = (meta: object, rawToken: string): void => {
    for (const [key, value] of Object.entries(meta)) {
        if (SECRET_KEY_PATTERN.test(key)) throw new NotificationPayloadError('secret_field');
        if (typeof value !== 'string') continue;
        if (rawToken.length > 0 && value.includes(rawToken)) throw new NotificationPayloadError('secret_value');
        if (HEX_TOKEN_SHAPE.test(value) || JWT_SHAPE.test(value)) throw new NotificationPayloadError('secret_value');
    }
};

/** The fields that may appear in a log line. The recipient address is left out. */
export const safeLogFields = (meta: NotificationJobMeta) => ({
    jobId: meta.jobId,
    type: meta.type,
    inviteId: meta.inviteId,
    instituteId: meta.instituteId,
    attempt: meta.attempt,
    maxAttempts: meta.maxAttempts,
});
