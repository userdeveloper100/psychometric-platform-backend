/**
 * Notification queue (Redis first, in-process fallback).
 *
 * Redis layout, all keys under `notifications:`:
 *   pending   list    jobs waiting to run. Enqueue pushes left, claim pops right (FIFO).
 *   inflight  list    jobs claimed by a worker. Removed on completion, retry or dead-letter.
 *   delayed   zset    jobs waiting for a retry, scored by the time they are due.
 *   dead      list    jobs that exhausted their attempts, with the reason. Kept for inspection.
 *
 * Only job metadata is stored (see notification.types.ts). The raw invite token lives in the process-local
 * secret vault below and is never written to Redis, to a log or to a snapshot.
 *
 * Without Redis (not connected, or NODE_ENV=test) jobs go to an in-process memory queue. Jobs in memory are lost
 * on restart.
 */

import { randomUUID } from 'crypto';
import { env } from '../../config/env';
import logger from '../../config/logger';
import { getRedisClient, isRedisReady } from '../../config/redis';
import {
    assertNoSecrets,
    buildJobMeta,
    DeadLetter,
    NotificationInput,
    NotificationJobMeta,
    NotificationPayloadError,
    safeLogFields,
} from './notification.types';

export interface ClaimedJob {
    meta: NotificationJobMeta;
    /** Opaque handle for complete, scheduleRetry and deadLetter. */
    handle: string;
}

export interface QueueSnapshot {
    pending: NotificationJobMeta[];
    delayed: NotificationJobMeta[];
    dead: DeadLetter[];
}

export interface NotificationQueue {
    readonly kind: 'memory' | 'redis';
    enqueue(meta: NotificationJobMeta): Promise<void>;
    claim(): Promise<ClaimedJob | null>;
    complete(handle: string): Promise<void>;
    scheduleRetry(handle: string, meta: NotificationJobMeta, runAt: number): Promise<void>;
    deadLetter(handle: string, meta: NotificationJobMeta, reason: string, deadAt: Date): Promise<void>;
    /** Moves delayed jobs whose time has come back to pending. Returns how many moved. */
    promoteDue(now: number): Promise<number>;
    snapshot(): Promise<QueueSnapshot>;
}

// ─── In-process queue ─────────────────────────────────────────────────────────

export class MemoryNotificationQueue implements NotificationQueue {
    readonly kind = 'memory';
    private pending: NotificationJobMeta[] = [];
    private inFlight = new Map<string, NotificationJobMeta>();
    private delayed: { runAt: number; meta: NotificationJobMeta }[] = [];
    private dead: DeadLetter[] = [];

    async enqueue(meta: NotificationJobMeta): Promise<void> {
        this.pending.push(meta);
    }

    async claim(): Promise<ClaimedJob | null> {
        const meta = this.pending.shift();
        if (!meta) return null;
        this.inFlight.set(meta.jobId, meta);
        return { meta, handle: meta.jobId };
    }

    async complete(handle: string): Promise<void> {
        this.inFlight.delete(handle);
    }

    async scheduleRetry(handle: string, meta: NotificationJobMeta, runAt: number): Promise<void> {
        this.inFlight.delete(handle);
        this.delayed.push({ runAt, meta });
    }

    async deadLetter(handle: string, meta: NotificationJobMeta, reason: string, deadAt: Date): Promise<void> {
        this.inFlight.delete(handle);
        this.dead.push({ meta, reason, deadAt: deadAt.toISOString() });
    }

    async promoteDue(now: number): Promise<number> {
        const due = this.delayed.filter((entry) => entry.runAt <= now);
        this.delayed = this.delayed.filter((entry) => entry.runAt > now);
        this.pending.push(...due.map((entry) => entry.meta));
        return due.length;
    }

    async snapshot(): Promise<QueueSnapshot> {
        return {
            pending: [...this.pending],
            delayed: this.delayed.map((entry) => entry.meta),
            dead: [...this.dead],
        };
    }

    reset(): void {
        this.pending = [];
        this.inFlight.clear();
        this.delayed = [];
        this.dead = [];
    }
}

// ─── Redis queue ──────────────────────────────────────────────────────────────

const KEYS = {
    pending: 'notifications:pending',
    inflight: 'notifications:inflight',
    delayed: 'notifications:delayed',
    dead: 'notifications:dead',
} as const;

type RedisClient = NonNullable<ReturnType<typeof getRedisClient>>;

export class RedisNotificationQueue implements NotificationQueue {
    readonly kind = 'redis';

    constructor(private readonly connection: () => RedisClient | null) {}

    private client(): RedisClient {
        const client = this.connection();
        if (!client) throw new Error('redis_unavailable');
        return client;
    }

    async enqueue(meta: NotificationJobMeta): Promise<void> {
        await this.client().lPush(KEYS.pending, JSON.stringify(meta));
    }

    async claim(): Promise<ClaimedJob | null> {
        // LMOVE is atomic, so two workers never claim the same job.
        const raw = await this.client().lMove(KEYS.pending, KEYS.inflight, 'RIGHT', 'LEFT');
        if (!raw) return null;
        return { meta: JSON.parse(raw) as NotificationJobMeta, handle: raw };
    }

    async complete(handle: string): Promise<void> {
        await this.client().lRem(KEYS.inflight, 1, handle);
    }

    async scheduleRetry(handle: string, meta: NotificationJobMeta, runAt: number): Promise<void> {
        await this.client()
            .multi()
            .lRem(KEYS.inflight, 1, handle)
            .zAdd(KEYS.delayed, { score: runAt, value: JSON.stringify(meta) })
            .exec();
    }

    async deadLetter(handle: string, meta: NotificationJobMeta, reason: string, deadAt: Date): Promise<void> {
        const record: DeadLetter = { meta, reason, deadAt: deadAt.toISOString() };
        await this.client()
            .multi()
            .lRem(KEYS.inflight, 1, handle)
            .lPush(KEYS.dead, JSON.stringify(record))
            .exec();
    }

    async promoteDue(now: number): Promise<number> {
        const client = this.client();
        const due = await client.zRangeByScore(KEYS.delayed, '-inf', now);
        let moved = 0;
        for (const raw of due) {
            // ZREM returns 1 only for the worker that removed the entry, so a job is promoted once.
            const removed = await client.zRem(KEYS.delayed, raw);
            if (removed === 1) {
                await client.lPush(KEYS.pending, raw);
                moved += 1;
            }
        }
        return moved;
    }

    async snapshot(): Promise<QueueSnapshot> {
        const client = this.client();
        const [pending, delayed, dead] = await Promise.all([
            client.lRange(KEYS.pending, 0, -1),
            client.zRangeByScore(KEYS.delayed, '-inf', '+inf'),
            client.lRange(KEYS.dead, 0, -1),
        ]);
        return {
            pending: pending.map((raw) => JSON.parse(raw) as NotificationJobMeta),
            delayed: delayed.map((raw) => JSON.parse(raw) as NotificationJobMeta),
            dead: dead.map((raw) => JSON.parse(raw) as DeadLetter),
        };
    }
}

// ─── Secret vault ─────────────────────────────────────────────────────────────

/**
 * Raw invite tokens, keyed by jobId, held only in this process's memory. A token is removed when its job completes
 * or dead-letters. A worker in another process has no entry for the job, so that job dead-letters as
 * `secret_unavailable`. Multi-process delivery needs a different secret source; see the limitations in the README.
 */
const secretVault = new Map<string, string>();

export const takeSecret = (jobId: string): string | undefined => secretVault.get(jobId);

export const releaseSecret = (jobId: string): void => {
    secretVault.delete(jobId);
};

export const hasSecret = (jobId: string): boolean => secretVault.has(jobId);

// ─── Queue selection ──────────────────────────────────────────────────────────

const memoryQueue = new MemoryNotificationQueue();
const redisQueue = new RedisNotificationQueue(() => getRedisClient());

const usesRedis = (): boolean => env.NODE_ENV !== 'test' && isRedisReady();

/**
 * Queues the worker drains. The memory queue is always included, so a job that fell back to memory while Redis
 * was down still runs.
 */
export const activeQueues = (): NotificationQueue[] => (usesRedis() ? [redisQueue, memoryQueue] : [memoryQueue]);

/** Redis when it is ready, memory otherwise. A Redis enqueue failure falls back to memory for that job. */
const enqueueJob = async (meta: NotificationJobMeta): Promise<void> => {
    if (usesRedis()) {
        try {
            await redisQueue.enqueue(meta);
            return;
        } catch {
            logger.warn('notification_queue_fallback', { jobId: meta.jobId });
        }
    }
    await memoryQueue.enqueue(meta);
};

// ─── Dispatch ─────────────────────────────────────────────────────────────────

/**
 * Queues one invite notification. Call it after the invite's transaction has committed.
 *
 * Never throws. A queue or validation failure is logged with a short code, and the caller's HTTP response is
 * unchanged. Returns the job metadata when it was queued, or null.
 */
export const dispatchInviteNotification = async (input: NotificationInput): Promise<NotificationJobMeta | null> => {
    const jobId = randomUUID();
    try {
        const meta = buildJobMeta(input, jobId, new Date());
        assertNoSecrets(meta, input.inviteToken);
        secretVault.set(jobId, input.inviteToken);
        await enqueueJob(meta);
        logger.info('notification_enqueued', safeLogFields(meta));
        return meta;
    } catch (error) {
        releaseSecret(jobId);
        logger.error('notification_enqueue_failed', {
            type: input.type,
            inviteId: input.inviteId,
            instituteId: input.instituteId,
            reason: error instanceof NotificationPayloadError ? error.code : 'enqueue_failed',
        });
        return null;
    }
};

// ─── Test helpers ─────────────────────────────────────────────────────────────

/** Snapshot of the in-process queue. Tests use it to inspect queued jobs without Redis. */
export const memoryQueueSnapshot = (): Promise<QueueSnapshot> => memoryQueue.snapshot();

/** Clears the in-process queue and the secret vault. */
export const resetNotificationQueue = (): void => {
    memoryQueue.reset();
    secretVault.clear();
};
