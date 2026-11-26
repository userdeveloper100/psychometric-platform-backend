import { randomBytes } from 'crypto';
import logger from '../../config/logger';
import {
    MailMessage,
    MailTransport,
    MemoryMailTransport,
    setMailTransport,
    UnconfiguredMailTransport,
    getMailTransport,
} from './mailer.service';
import {
    activeQueues,
    dispatchInviteNotification,
    hasSecret,
    memoryQueueSnapshot,
    releaseSecret,
    resetNotificationQueue,
    ClaimedJob,
    NotificationQueue,
} from './notification.queue';
import {
    processDueNotifications,
    startNotificationWorker,
    stopNotificationWorker,
} from './notification.worker';

jest.mock('../../config/redis', () => ({ isRedisReady: jest.fn(() => false), getRedisClient: jest.fn(() => null) }));
jest.mock('../../config/logger', () => ({
    __esModule: true,
    default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const RAW_TOKEN = randomBytes(32).toString('hex');
const RECIPIENT = 'candidate@example.com';
const T0 = 1_800_000_000_000;

const enqueueTestInvite = () =>
    dispatchInviteNotification({
        type: 'SEND_TEST_INVITE',
        inviteId: 'invite-1',
        instituteId: 'institute-a',
        recipientEmail: RECIPIENT,
        inviteToken: RAW_TOKEN,
    });

/** Everything the logger received, serialized. Used to prove that no secret or address was logged. */
const allLogs = (): string =>
    JSON.stringify([
        ...(logger.info as jest.Mock).mock.calls,
        ...(logger.warn as jest.Mock).mock.calls,
        ...(logger.error as jest.Mock).mock.calls,
    ]);

/** A transport that always fails with the given error. */
class ThrowingTransport implements MailTransport {
    readonly name = 'throwing';
    constructor(private readonly error: Error) {}
    async send(): Promise<void> {
        throw this.error;
    }
}

let transport: MemoryMailTransport;

beforeEach(() => {
    resetNotificationQueue();
    transport = new MemoryMailTransport();
    setMailTransport(transport);
});

describe('delivery', () => {
    test('a successful send completes the job and releases the token', async () => {
        const job = await enqueueTestInvite();

        const result = await processDueNotifications({ now: T0, transport });

        expect(result).toEqual({ delivered: 1, retried: 0, deadLettered: 0 });
        expect((await memoryQueueSnapshot()).pending).toHaveLength(0);
        expect(hasSecret(job!.jobId)).toBe(false);
    });

    test('the token reaches the transport in the message body, and to the recipient only', async () => {
        await enqueueTestInvite();

        await processDueNotifications({ now: T0, transport });

        const [message]: MailMessage[] = transport.sent;
        expect(message.to).toBe(RECIPIENT);
        expect(message.text).toContain(RAW_TOKEN);
        expect(message.subject).toMatch(/assessment/i);
    });

    test('logs the delivery with safe fields only: no token and no recipient address', async () => {
        await enqueueTestInvite();

        await processDueNotifications({ now: T0, transport });

        expect(logger.info).toHaveBeenCalledWith('notification_delivered', expect.objectContaining({ attempt: 1 }));
        expect(allLogs()).not.toContain(RAW_TOKEN);
        expect(allLogs()).not.toContain(RECIPIENT);
    });
});

describe('retry with exponential backoff', () => {
    test('a transient failure is retried after one second, then delivered', async () => {
        await enqueueTestInvite();
        transport.failNext(1);

        expect(await processDueNotifications({ now: T0, transport })).toEqual({ delivered: 0, retried: 1, deadLettered: 0 });
        expect((await memoryQueueSnapshot()).delayed.map((m) => m.attempt)).toEqual([1]);
        expect(hasSecret((await memoryQueueSnapshot()).delayed[0].jobId)).toBe(true);

        // Not due yet at 999 ms.
        expect(await processDueNotifications({ now: T0 + 999, transport })).toEqual({ delivered: 0, retried: 0, deadLettered: 0 });

        expect(await processDueNotifications({ now: T0 + 1000, transport })).toEqual({ delivered: 1, retried: 0, deadLettered: 0 });
        expect(transport.sent).toHaveLength(1);
    });

    test('the second retry waits two seconds, and the job dead-letters after the third failed attempt', async () => {
        const job = await enqueueTestInvite();
        transport.failNext(3);

        await processDueNotifications({ now: T0, transport }); // attempt 1 fails, retry at +1s
        await processDueNotifications({ now: T0 + 1000, transport }); // attempt 2 fails, retry at +2s more
        expect((await memoryQueueSnapshot()).delayed[0].attempt).toBe(2);

        // Attempt 2 failed at T0 + 1000, so the next try is due at T0 + 3000. One millisecond early, nothing runs.
        expect(await processDueNotifications({ now: T0 + 2999, transport })).toEqual({ delivered: 0, retried: 0, deadLettered: 0 });

        expect(await processDueNotifications({ now: T0 + 3000, transport })).toEqual({ delivered: 0, retried: 0, deadLettered: 1 });

        const snapshot = await memoryQueueSnapshot();
        expect(snapshot.pending).toHaveLength(0);
        expect(snapshot.delayed).toHaveLength(0);
        expect(snapshot.dead).toEqual([
            expect.objectContaining({
                reason: 'simulated_transport_failure',
                meta: expect.objectContaining({ jobId: job!.jobId, attempt: 3, maxAttempts: 3 }),
            }),
        ]);
        expect(hasSecret(job!.jobId)).toBe(false);
        expect(transport.sent).toHaveLength(0);
    });

    test('a dead-lettered job is logged with a reason code only, never the token or address', async () => {
        await enqueueTestInvite();
        transport.failNext(3);

        await processDueNotifications({ now: T0, transport });
        await processDueNotifications({ now: T0 + 1000, transport });
        await processDueNotifications({ now: T0 + 3000, transport });

        expect(logger.error).toHaveBeenCalledWith('notification_dead_letter', expect.objectContaining({ reason: 'simulated_transport_failure' }));
        expect(allLogs()).not.toContain(RAW_TOKEN);
        expect(allLogs()).not.toContain(RECIPIENT);
    });
});

describe('dead-letter cases', () => {
    test('an unconfigured mail transport dead-letters with a clear reason after the retries', async () => {
        await enqueueTestInvite();
        const unconfigured = new UnconfiguredMailTransport();

        await processDueNotifications({ now: T0, transport: unconfigured });
        await processDueNotifications({ now: T0 + 1000, transport: unconfigured });
        await processDueNotifications({ now: T0 + 3000, transport: unconfigured });

        expect((await memoryQueueSnapshot()).dead[0].reason).toBe('mail_transport_not_configured');
    });

    test('a job whose token is missing from the vault dead-letters as secret_unavailable, without a send', async () => {
        const job = await enqueueTestInvite();
        releaseSecret(job!.jobId);

        const result = await processDueNotifications({ now: T0, transport });

        expect(result.deadLettered).toBe(1);
        expect((await memoryQueueSnapshot()).dead[0].reason).toBe('secret_unavailable');
        expect(transport.sent).toHaveLength(0);
    });

    test('a transport error that echoes the address is recorded as transport_error, and its message is not logged', async () => {
        await enqueueTestInvite();
        const leaky = new ThrowingTransport(new Error(`smtp rejected ${RECIPIENT}`));

        await processDueNotifications({ now: T0, transport: leaky });

        expect(logger.warn).toHaveBeenCalledWith('notification_retry_scheduled', expect.objectContaining({ reason: 'transport_error' }));
        expect(allLogs()).not.toContain(RECIPIENT);
        expect((await memoryQueueSnapshot()).delayed[0].attempt).toBe(1);
    });
});

describe('queue faults', () => {
    test('a queue that cannot be read is logged, and the other queues still run', async () => {
        await enqueueTestInvite();
        const broken: NotificationQueue = {
            kind: 'redis',
            enqueue: jest.fn(),
            claim: jest.fn(),
            complete: jest.fn(),
            scheduleRetry: jest.fn(),
            deadLetter: jest.fn(),
            promoteDue: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
            snapshot: jest.fn(),
        };

        const result = await processDueNotifications({ now: T0, transport, queues: [broken, ...activeQueues()] });

        expect(result.delivered).toBe(1);
        expect(logger.error).toHaveBeenCalledWith('notification_queue_unavailable', { queue: 'redis', reason: 'Error' });
    });

    test('a claim failure stops that queue for this pass only', async () => {
        const failing: NotificationQueue = {
            kind: 'redis',
            enqueue: jest.fn(),
            claim: jest.fn().mockRejectedValue(new Error('timeout')),
            complete: jest.fn(),
            scheduleRetry: jest.fn(),
            deadLetter: jest.fn(),
            promoteDue: jest.fn().mockResolvedValue(0),
            snapshot: jest.fn(),
        };

        const result = await processDueNotifications({ now: T0, transport, queues: [failing] });

        expect(result).toEqual({ delivered: 0, retried: 0, deadLettered: 0 });
        expect(logger.error).toHaveBeenCalledWith('notification_queue_unavailable', { queue: 'redis', reason: 'Error' });
    });

    test('a job whose completion fails is logged and not sent again in the same pass', async () => {
        await enqueueTestInvite();
        const meta = (await memoryQueueSnapshot()).pending[0];
        let handed = false;
        const flaky: NotificationQueue = {
            kind: 'memory',
            enqueue: jest.fn(),
            claim: jest.fn(async (): Promise<ClaimedJob | null> => {
                if (handed) return null;
                handed = true;
                return { meta, handle: meta.jobId };
            }),
            complete: jest.fn().mockRejectedValue(new Error('write failed')),
            scheduleRetry: jest.fn(),
            deadLetter: jest.fn(),
            promoteDue: jest.fn().mockResolvedValue(0),
            snapshot: jest.fn(),
        };

        const result = await processDueNotifications({ now: T0, transport, queues: [flaky] });

        expect(result.delivered).toBe(0);
        expect(transport.sent).toHaveLength(1);
        expect(logger.error).toHaveBeenCalledWith('notification_job_failed', expect.objectContaining({ reason: 'Error' }));
    });
});

describe('polling loop', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        stopNotificationWorker();
        jest.useRealTimers();
    });

    test('the loop delivers queued jobs on each tick, and stops when stopped', async () => {
        setMailTransport(transport);
        startNotificationWorker(1000);
        await enqueueTestInvite();

        await jest.advanceTimersByTimeAsync(1000);
        expect(transport.sent).toHaveLength(1);

        stopNotificationWorker();
        await enqueueTestInvite();
        await jest.advanceTimersByTimeAsync(5000);
        expect(transport.sent).toHaveLength(1);
    });

    test('starting twice does not create a second loop', async () => {
        startNotificationWorker(1000);
        startNotificationWorker(1000);
        await enqueueTestInvite();

        await jest.advanceTimersByTimeAsync(1000);

        expect(transport.sent).toHaveLength(1);
    });
});

describe('mail transport selection', () => {
    test('a test run uses the memory transport by default', () => {
        expect(getMailTransport()).toBeInstanceOf(MemoryMailTransport);
    });
});
