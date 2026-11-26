/**
 * Notification worker: delivers queued invite emails with retry and dead-letter handling.
 *
 * Per job:
 *   1. Claim it (moves it to inflight).
 *   2. Take the raw token from the secret vault. If it is missing, dead-letter the job (`secret_unavailable`).
 *   3. Send through the mail transport.
 *      - Success: complete the job and release the token.
 *      - Failure: count the attempt. Below maxAttempts, schedule a retry with exponential backoff.
 *        At maxAttempts, dead-letter the job and release the token.
 *
 * Logs carry only safe fields (see safeLogFields) and a short failure code. Provider error messages are not logged.
 */

import logger from '../../config/logger';
import { getMailTransport, MailDeliveryError, MailTransport, buildInviteMessage } from './mailer.service';
import { activeQueues, ClaimedJob, NotificationQueue, releaseSecret, takeSecret } from './notification.queue';
import { NotificationJobMeta, retryDelayMs, safeLogFields } from './notification.types';

/** A run never processes more than this many jobs, so one tick cannot hold the loop for long. */
const MAX_JOBS_PER_RUN = 100;
const DEFAULT_POLL_INTERVAL_MS = 1000;

export interface WorkerRunResult {
    delivered: number;
    retried: number;
    deadLettered: number;
}

export interface ProcessOptions {
    /** Current time in epoch milliseconds. Tests pass a fixed value. */
    now?: number;
    queues?: NotificationQueue[];
    transport?: MailTransport;
}

const errorName = (error: unknown): string => (error instanceof Error ? error.name : 'unknown');

/** Runs one pass over every active queue. Never throws, so one failing queue does not stop the others. */
export const processDueNotifications = async (options: ProcessOptions = {}): Promise<WorkerRunResult> => {
    const now = options.now ?? Date.now();
    const transport = options.transport ?? getMailTransport();
    const queues = options.queues ?? activeQueues();
    const result: WorkerRunResult = { delivered: 0, retried: 0, deadLettered: 0 };

    for (const queue of queues) {
        try {
            await queue.promoteDue(now);
        } catch (error) {
            logger.error('notification_queue_unavailable', { queue: queue.kind, reason: errorName(error) });
            continue;
        }

        for (let processed = 0; processed < MAX_JOBS_PER_RUN; processed += 1) {
            let claimed: ClaimedJob | null;
            try {
                claimed = await queue.claim();
            } catch (error) {
                logger.error('notification_queue_unavailable', { queue: queue.kind, reason: errorName(error) });
                break;
            }
            if (!claimed) break;

            try {
                await processJob(queue, claimed.meta, claimed.handle, transport, now, result);
            } catch (error) {
                // The job stays inflight. It is not lost, but it is not retried until the queue state is repaired.
                logger.error('notification_job_failed', { ...safeLogFields(claimed.meta), reason: errorName(error) });
            }
        }
    }

    return result;
};

const processJob = async (
    queue: NotificationQueue,
    meta: NotificationJobMeta,
    handle: string,
    transport: MailTransport,
    now: number,
    result: WorkerRunResult
): Promise<void> => {
    const secret = takeSecret(meta.jobId);
    if (secret === undefined) {
        await queue.deadLetter(handle, meta, 'secret_unavailable', new Date(now));
        releaseSecret(meta.jobId);
        result.deadLettered += 1;
        logger.error('notification_dead_letter', { ...safeLogFields(meta), reason: 'secret_unavailable' });
        return;
    }

    const attemptsMade = meta.attempt + 1;
    const updated: NotificationJobMeta = { ...meta, attempt: attemptsMade };

    try {
        await transport.send(buildInviteMessage(meta, secret));
    } catch (error) {
        const code = error instanceof MailDeliveryError ? error.code : 'transport_error';

        if (attemptsMade >= updated.maxAttempts) {
            await queue.deadLetter(handle, updated, code, new Date(now));
            releaseSecret(meta.jobId);
            result.deadLettered += 1;
            logger.error('notification_dead_letter', { ...safeLogFields(updated), reason: code });
            return;
        }

        const delayMs = retryDelayMs(attemptsMade);
        await queue.scheduleRetry(handle, updated, now + delayMs);
        result.retried += 1;
        logger.warn('notification_retry_scheduled', { ...safeLogFields(updated), reason: code, retryInMs: delayMs });
        return;
    }

    await queue.complete(handle);
    releaseSecret(meta.jobId);
    result.delivered += 1;
    logger.info('notification_delivered', safeLogFields(updated));
};

// ─── Polling loop ─────────────────────────────────────────────────────────────

let timer: NodeJS.Timeout | null = null;
let tickRunning = false;

/** Starts the polling loop. Called once from server.ts. Tests drive processDueNotifications directly. */
export const startNotificationWorker = (intervalMs: number = DEFAULT_POLL_INTERVAL_MS): void => {
    if (timer) return;
    timer = setInterval(() => {
        // A tick that is still running blocks the next one, so passes never overlap.
        if (tickRunning) return;
        tickRunning = true;
        processDueNotifications()
            .catch((error) => logger.error('notification_worker_tick_failed', { reason: errorName(error) }))
            .finally(() => {
                tickRunning = false;
            });
    }, intervalMs);
    timer.unref();
};

export const stopNotificationWorker = (): void => {
    if (timer) clearInterval(timer);
    timer = null;
};
