import { randomBytes } from 'crypto';
import { env } from '../../config/env';
import logger from '../../config/logger';
import { getRedisClient, isRedisReady } from '../../config/redis';
import {
    dispatchInviteNotification,
    hasSecret,
    memoryQueueSnapshot,
    MemoryNotificationQueue,
    RedisNotificationQueue,
    resetNotificationQueue,
    takeSecret,
} from './notification.queue';
import { buildJobMeta, NotificationJobMeta } from './notification.types';

// The env object is the one the queue module reads. Tests switch NODE_ENV to exercise the Redis path.
jest.mock('../../config/env', () => ({ env: { NODE_ENV: 'test' } }));
jest.mock('../../config/redis', () => ({ isRedisReady: jest.fn(), getRedisClient: jest.fn() }));
jest.mock('../../config/logger', () => ({
    __esModule: true,
    default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const RAW_TOKEN = randomBytes(32).toString('hex');
const ENQUEUED_AT = new Date('2026-11-26T10:00:00.000Z');

const metaFor = (jobId: string): NotificationJobMeta => buildJobMeta(
    { type: 'SEND_USER_INVITE', inviteId: `invite-${jobId}`, instituteId: 'institute-a', recipientEmail: `${jobId}@example.com`, inviteToken: RAW_TOKEN },
    jobId,
    ENQUEUED_AT
);

/** Minimal in-memory stand-in for the node-redis commands the queue uses. Lists keep the head at index 0. */
class FakeRedis {
    lists = new Map<string, string[]>();
    zsets = new Map<string, { score: number; value: string }[]>();
    lPushCalls = 0;
    failLPush = false;

    private list(key: string): string[] {
        if (!this.lists.has(key)) this.lists.set(key, []);
        return this.lists.get(key)!;
    }

    private zset(key: string) {
        if (!this.zsets.has(key)) this.zsets.set(key, []);
        return this.zsets.get(key)!;
    }

    async lPush(key: string, value: string): Promise<number> {
        this.lPushCalls += 1;
        if (this.failLPush) throw new Error('connection reset');
        this.list(key).unshift(value);
        return this.list(key).length;
    }

    async lMove(source: string, destination: string, sourceSide: 'LEFT' | 'RIGHT', destinationSide: 'LEFT' | 'RIGHT') {
        const from = this.list(source);
        if (from.length === 0) return null;
        const value = sourceSide === 'RIGHT' ? from.pop()! : from.shift()!;
        if (destinationSide === 'LEFT') this.list(destination).unshift(value);
        else this.list(destination).push(value);
        return value;
    }

    async lRem(key: string, _count: number, value: string): Promise<number> {
        const items = this.list(key);
        const index = items.indexOf(value);
        if (index < 0) return 0;
        items.splice(index, 1);
        return 1;
    }

    async lRange(key: string): Promise<string[]> {
        return [...this.list(key)];
    }

    async zAdd(key: string, member: { score: number; value: string }): Promise<number> {
        this.zset(key).push(member);
        return 1;
    }

    async zRem(key: string, value: string): Promise<number> {
        const items = this.zset(key);
        const index = items.findIndex((item) => item.value === value);
        if (index < 0) return 0;
        items.splice(index, 1);
        return 1;
    }

    async zRangeByScore(key: string, min: string | number, max: string | number): Promise<string[]> {
        const low = min === '-inf' ? -Infinity : Number(min);
        const high = max === '+inf' ? Infinity : Number(max);
        return this.zset(key)
            .filter((item) => item.score >= low && item.score <= high)
            .sort((a, b) => a.score - b.score)
            .map((item) => item.value);
    }

    multi() {
        const ops: (() => Promise<unknown>)[] = [];
        const chain = {
            lRem: (key: string, count: number, value: string) => {
                ops.push(() => this.lRem(key, count, value));
                return chain;
            },
            zAdd: (key: string, member: { score: number; value: string }) => {
                ops.push(() => this.zAdd(key, member));
                return chain;
            },
            lPush: (key: string, value: string) => {
                ops.push(() => this.lPush(key, value));
                return chain;
            },
            exec: async () => {
                const results: unknown[] = [];
                for (const op of ops) results.push(await op());
                return results;
            },
        };
        return chain;
    }

    /** Every stored payload, serialized. Used to prove that no token reached Redis. */
    allStoredText(): string {
        return JSON.stringify({ lists: [...this.lists.entries()], zsets: [...this.zsets.entries()] });
    }
}

const setRedis = (ready: boolean, fake: FakeRedis | null) => {
    (isRedisReady as jest.Mock).mockReturnValue(ready);
    (getRedisClient as jest.Mock).mockReturnValue(fake);
};

beforeEach(() => {
    (env as { NODE_ENV: string }).NODE_ENV = 'test';
    resetNotificationQueue();
    setRedis(false, null);
});

describe('MemoryNotificationQueue', () => {
    test('claims jobs in FIFO order and removes a completed job from the snapshot', async () => {
        const queue = new MemoryNotificationQueue();
        await queue.enqueue(metaFor('j1'));
        await queue.enqueue(metaFor('j2'));

        const first = await queue.claim();
        expect(first?.meta.jobId).toBe('j1');
        await queue.complete(first!.handle);

        expect((await queue.snapshot()).pending.map((m) => m.jobId)).toEqual(['j2']);
        expect((await queue.claim())?.meta.jobId).toBe('j2');
        expect(await queue.claim()).toBeNull();
    });

    test('a scheduled retry waits until its time, then returns to pending', async () => {
        const queue = new MemoryNotificationQueue();
        await queue.enqueue(metaFor('j1'));
        const claimed = await queue.claim();
        await queue.scheduleRetry(claimed!.handle, claimed!.meta, 5000);

        expect(await queue.promoteDue(4999)).toBe(0);
        expect((await queue.snapshot()).delayed).toHaveLength(1);

        expect(await queue.promoteDue(5000)).toBe(1);
        const snapshot = await queue.snapshot();
        expect(snapshot.delayed).toHaveLength(0);
        expect(snapshot.pending.map((m) => m.jobId)).toEqual(['j1']);
    });

    test('a dead-lettered job keeps its reason and time, and leaves the queue', async () => {
        const queue = new MemoryNotificationQueue();
        await queue.enqueue(metaFor('j1'));
        const claimed = await queue.claim();
        await queue.deadLetter(claimed!.handle, claimed!.meta, 'mail_transport_not_configured', ENQUEUED_AT);

        const snapshot = await queue.snapshot();
        expect(snapshot.pending).toHaveLength(0);
        expect(snapshot.dead).toEqual([
            { meta: claimed!.meta, reason: 'mail_transport_not_configured', deadAt: '2026-11-26T10:00:00.000Z' },
        ]);
    });
});

describe('RedisNotificationQueue (fake client)', () => {
    test('enqueue then claim is FIFO, and the claimed job is recorded as inflight until completed', async () => {
        const fake = new FakeRedis();
        const queue = new RedisNotificationQueue(() => fake as never);
        await queue.enqueue(metaFor('j1'));
        await queue.enqueue(metaFor('j2'));

        const claimed = await queue.claim();
        expect(claimed?.meta.jobId).toBe('j1');
        expect(fake.lists.get('notifications:inflight')).toHaveLength(1);

        await queue.complete(claimed!.handle);
        expect(fake.lists.get('notifications:inflight')).toHaveLength(0);
        expect((await queue.snapshot()).pending.map((m) => m.jobId)).toEqual(['j2']);
    });

    test('a retry moves the job to the delayed set with its updated attempt count', async () => {
        const fake = new FakeRedis();
        const queue = new RedisNotificationQueue(() => fake as never);
        await queue.enqueue(metaFor('j1'));
        const claimed = await queue.claim();

        const retried = { ...claimed!.meta, attempt: 1 };
        await queue.scheduleRetry(claimed!.handle, retried, 1000);

        expect(fake.lists.get('notifications:inflight')).toHaveLength(0);
        expect(await queue.promoteDue(999)).toBe(0);
        expect(await queue.promoteDue(1000)).toBe(1);
        const [promoted] = (await queue.snapshot()).pending;
        expect(promoted.attempt).toBe(1);
    });

    test('a due job is promoted exactly once, even when promoteDue runs again', async () => {
        const fake = new FakeRedis();
        const queue = new RedisNotificationQueue(() => fake as never);
        await queue.enqueue(metaFor('j1'));
        const claimed = await queue.claim();
        await queue.scheduleRetry(claimed!.handle, claimed!.meta, 10);

        expect(await queue.promoteDue(100)).toBe(1);
        expect(await queue.promoteDue(100)).toBe(0);
        expect((await queue.snapshot()).pending).toHaveLength(1);
    });

    test('a dead-lettered job is recorded with its reason and leaves inflight', async () => {
        const fake = new FakeRedis();
        const queue = new RedisNotificationQueue(() => fake as never);
        await queue.enqueue(metaFor('j1'));
        const claimed = await queue.claim();
        await queue.deadLetter(claimed!.handle, claimed!.meta, 'simulated_transport_failure', ENQUEUED_AT);

        const snapshot = await queue.snapshot();
        expect(fake.lists.get('notifications:inflight')).toHaveLength(0);
        expect(snapshot.dead).toEqual([
            expect.objectContaining({ reason: 'simulated_transport_failure', meta: expect.objectContaining({ jobId: 'j1' }) }),
        ]);
    });

    test('a command failure rejects, so the caller can fall back or log', async () => {
        const fake = new FakeRedis();
        fake.failLPush = true;
        const queue = new RedisNotificationQueue(() => fake as never);

        await expect(queue.enqueue(metaFor('j1'))).rejects.toThrow('connection reset');
    });

    test('without a connection, every operation rejects', async () => {
        const queue = new RedisNotificationQueue(() => null);

        await expect(queue.claim()).rejects.toThrow('redis_unavailable');
    });
});

describe('dispatchInviteNotification', () => {
    test('enqueues a SEND_TEST_INVITE job with safe metadata, and keeps the token only in the vault', async () => {
        const job = await dispatchInviteNotification({
            type: 'SEND_TEST_INVITE',
            inviteId: 'invite-1',
            instituteId: 'institute-a',
            recipientEmail: 'candidate@example.com',
            inviteToken: RAW_TOKEN,
        });

        expect(job).toMatchObject({ type: 'SEND_TEST_INVITE', inviteId: 'invite-1', instituteId: 'institute-a', attempt: 0 });
        const snapshot = await memoryQueueSnapshot();
        expect(snapshot.pending.map((m) => m.jobId)).toEqual([job!.jobId]);
        expect(JSON.stringify(snapshot)).not.toContain(RAW_TOKEN);
        expect(takeSecret(job!.jobId)).toBe(RAW_TOKEN);
    });

    test('enqueues a SEND_USER_INVITE job the same way', async () => {
        const job = await dispatchInviteNotification({
            type: 'SEND_USER_INVITE',
            inviteId: 'user-invite-1',
            instituteId: 'institute-a',
            recipientEmail: 'staff@example.com',
            inviteToken: RAW_TOKEN,
        });

        expect(job?.type).toBe('SEND_USER_INVITE');
        expect(hasSecret(job!.jobId)).toBe(true);
        expect(JSON.stringify(await memoryQueueSnapshot())).not.toContain(RAW_TOKEN);
    });

    test('logs the enqueue with safe fields only: no token and no recipient address', async () => {
        await dispatchInviteNotification({
            type: 'SEND_TEST_INVITE',
            inviteId: 'invite-1',
            instituteId: 'institute-a',
            recipientEmail: 'candidate@example.com',
            inviteToken: RAW_TOKEN,
        });

        const logged = JSON.stringify((logger.info as jest.Mock).mock.calls);
        expect(logged).toContain('notification_enqueued');
        expect(logged).not.toContain(RAW_TOKEN);
        expect(logged).not.toContain('candidate@example.com');
    });

    test('an invalid recipient returns null, queues nothing, and logs only a reason code', async () => {
        const job = await dispatchInviteNotification({
            type: 'SEND_USER_INVITE',
            inviteId: 'user-invite-1',
            instituteId: 'institute-a',
            recipientEmail: 'not-an-email',
            inviteToken: RAW_TOKEN,
        });

        expect(job).toBeNull();
        expect((await memoryQueueSnapshot()).pending).toHaveLength(0);
        expect(logger.error).toHaveBeenCalledWith('notification_enqueue_failed', expect.objectContaining({ reason: 'invalid_recipient' }));
        expect(JSON.stringify((logger.error as jest.Mock).mock.calls)).not.toContain(RAW_TOKEN);
    });

    test('a token-shaped field in the job would be rejected, and no secret is left in the vault', async () => {
        // A token that appears in an id is caught by the guard, so it is never queued.
        const job = await dispatchInviteNotification({
            type: 'SEND_TEST_INVITE',
            inviteId: RAW_TOKEN,
            instituteId: 'institute-a',
            recipientEmail: 'candidate@example.com',
            inviteToken: RAW_TOKEN,
        });

        expect(job).toBeNull();
        expect((await memoryQueueSnapshot()).pending).toHaveLength(0);
        expect(logger.error).toHaveBeenCalledWith('notification_enqueue_failed', expect.objectContaining({ reason: 'secret_value' }));
    });
});

describe('Redis selection and graceful fallback', () => {
    test('uses Redis when it is ready outside tests: the job is stored in Redis, not in memory', async () => {
        (env as { NODE_ENV: string }).NODE_ENV = 'production';
        const fake = new FakeRedis();
        setRedis(true, fake);

        const job = await dispatchInviteNotification({
            type: 'SEND_TEST_INVITE',
            inviteId: 'invite-1',
            instituteId: 'institute-a',
            recipientEmail: 'candidate@example.com',
            inviteToken: RAW_TOKEN,
        });

        expect(job).not.toBeNull();
        expect(fake.lists.get('notifications:pending')).toHaveLength(1);
        expect((await memoryQueueSnapshot()).pending).toHaveLength(0);
        expect(fake.allStoredText()).not.toContain(RAW_TOKEN);
        expect(hasSecret(job!.jobId)).toBe(true);
    });

    test('falls back to memory when Redis fails the enqueue, and the job is still queued', async () => {
        (env as { NODE_ENV: string }).NODE_ENV = 'production';
        const fake = new FakeRedis();
        fake.failLPush = true;
        setRedis(true, fake);

        const job = await dispatchInviteNotification({
            type: 'SEND_USER_INVITE',
            inviteId: 'user-invite-1',
            instituteId: 'institute-a',
            recipientEmail: 'staff@example.com',
            inviteToken: RAW_TOKEN,
        });

        expect(job).not.toBeNull();
        expect((await memoryQueueSnapshot()).pending.map((m) => m.jobId)).toEqual([job!.jobId]);
        expect(logger.warn).toHaveBeenCalledWith('notification_queue_fallback', { jobId: job!.jobId });
    });

    test('uses memory without touching Redis when Redis is not connected', async () => {
        (env as { NODE_ENV: string }).NODE_ENV = 'production';
        const fake = new FakeRedis();
        setRedis(false, fake);

        const job = await dispatchInviteNotification({
            type: 'SEND_TEST_INVITE',
            inviteId: 'invite-1',
            instituteId: 'institute-a',
            recipientEmail: 'candidate@example.com',
            inviteToken: RAW_TOKEN,
        });

        expect(job).not.toBeNull();
        expect(fake.lPushCalls).toBe(0);
        expect((await memoryQueueSnapshot()).pending).toHaveLength(1);
    });
});
