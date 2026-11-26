/**
 * Async notification queue, end to end against the test database.
 *   - Creating or re-issuing a candidate TestInvite, issuing a staff UserInvite, and provisioning an institute with
 *     initialAdminEmail each enqueue one tenant-scoped job. The job record never holds the raw token.
 *   - A revoked or refused invite enqueues nothing.
 *   - The worker delivers the token to the recipient's address through the test transport.
 *   - No log line carries a raw token.
 */

import { randomUUID } from 'crypto';
import logger from '../config/logger';
import { getMailTransport, MemoryMailTransport } from '../modules/notifications/mailer.service';
import { memoryQueueSnapshot, resetNotificationQueue } from '../modules/notifications/notification.queue';
import { processDueNotifications } from '../modules/notifications/notification.worker';
import { api, prisma, seedTwoTenants, tokenFor, TwoTenantFixture } from '../test-utils/integration/harness';

let fx: TwoTenantFixture;
let superAdminToken: string;

const transport = (): MemoryMailTransport => getMailTransport() as MemoryMailTransport;

const LOG_LEVELS = ['info', 'warn', 'error', 'debug'] as const;

/** Every log call made since the test started, serialized. The spies are installed in beforeEach. */
const allLogs = (): string => JSON.stringify(LOG_LEVELS.map((level) => jest.spyOn(logger, level).mock.calls));

const newStudent = (name: string, instituteId: string) =>
    prisma.student.create({ data: { name, email: `${randomUUID()}@integration.test`, instituteId } });

beforeEach(async () => {
    fx = await seedTwoTenants();
    resetNotificationQueue();
    transport().reset();
    // Recorded for the assertions below, and kept off the console.
    LOG_LEVELS.forEach((level) => jest.spyOn(logger, level).mockImplementation(() => undefined));

    const root = await prisma.user.create({
        data: { email: `root-${randomUUID()}@integration.test`, password: 'integration-fixture-not-a-login', role: 'SUPER_ADMIN' },
    });
    superAdminToken = tokenFor(root);
});

afterAll(async () => {
    await prisma.$disconnect();
});

describe('candidate TestInvite notifications', () => {
    test('creating an invite enqueues one tenant-scoped SEND_TEST_INVITE job, with no token in the job or the logs', async () => {
        const student = await newStudent('New Nina', fx.a.institute.id);

        const res = await api.post(`/api/v1/invites/tests/${fx.a.test.id}/invite`, fx.a.adminToken).send({ studentIds: [student.id] });

        expect(res.status).toBe(201);
        const { id: inviteId, token } = res.body.data.invites[0];
        const { pending } = await memoryQueueSnapshot();
        expect(pending).toHaveLength(1);
        expect(pending[0]).toMatchObject({
            type: 'SEND_TEST_INVITE',
            inviteId,
            instituteId: fx.a.institute.id,
            recipientEmail: student.email,
            attempt: 0,
            maxAttempts: 3,
        });
        expect(JSON.stringify(await memoryQueueSnapshot())).not.toContain(token);
        expect(allLogs()).not.toContain(token);
    });

    test('re-issuing a revoked invite enqueues a fresh job, for the same invite row, with the new token', async () => {
        expect((await api.delete(`/api/v1/invites/${fx.a.invite.id}`, fx.a.adminToken)).status).toBe(200);
        resetNotificationQueue();

        const res = await api.post(`/api/v1/invites/tests/${fx.a.test.id}/invite`, fx.a.adminToken).send({ studentIds: [fx.a.student.id] });

        expect(res.status).toBe(201);
        const { id, token } = res.body.data.invites[0];
        expect(id).toBe(fx.a.invite.id);
        const { pending } = await memoryQueueSnapshot();
        expect(pending.map((job) => [job.type, job.inviteId, job.recipientEmail])).toEqual([
            ['SEND_TEST_INVITE', fx.a.invite.id, fx.a.student.email],
        ]);
        expect(JSON.stringify(await memoryQueueSnapshot())).not.toContain(token);
    });

    test('the worker delivers the token to the candidate address, and the job leaves the queue', async () => {
        const student = await newStudent('Delivered Dan', fx.a.institute.id);
        const res = await api.post(`/api/v1/invites/tests/${fx.a.test.id}/invite`, fx.a.adminToken).send({ studentIds: [student.id] });
        const { token } = res.body.data.invites[0];

        const result = await processDueNotifications();

        expect(result.delivered).toBe(1);
        expect(transport().sent).toHaveLength(1);
        expect(transport().sent[0].to).toBe(student.email);
        expect(transport().sent[0].text).toContain(token);
        expect((await memoryQueueSnapshot()).pending).toHaveLength(0);
    });

    test('a student of another institute is refused, and nothing is enqueued', async () => {
        const res = await api.post(`/api/v1/invites/tests/${fx.a.test.id}/invite`, fx.b.adminToken).send({ studentIds: [fx.a.student.id] });

        expect(res.status).toBe(404);
        expect((await memoryQueueSnapshot()).pending).toHaveLength(0);
    });

    test('an invite request that fails validation enqueues nothing', async () => {
        expect((await api.post(`/api/v1/invites/tests/${fx.a.test.id}/invite`, fx.a.adminToken).send({ studentIds: [] })).status).toBe(400);
        expect((await api.post(`/api/v1/invites/tests/${fx.a.test.id}/invite`, fx.a.adminToken).send({ studentIds: [randomUUID()] })).status).toBe(404);

        expect((await memoryQueueSnapshot()).pending).toHaveLength(0);
    });

    test('a revoked invite token is refused at the assessment, and no job is queued', async () => {
        await api.delete(`/api/v1/invites/${fx.a.invite.id}`, fx.a.adminToken);
        resetNotificationQueue();

        const res = await api.post('/api/v1/invites/assessment').send({ token: fx.a.invite.token });

        expect(res.status).toBeGreaterThanOrEqual(400);
        expect((await memoryQueueSnapshot()).pending).toHaveLength(0);
    });
});

describe('staff UserInvite notifications', () => {
    test('an ADMIN issuing a staff invite enqueues one SEND_USER_INVITE job for the admin institute, without the token', async () => {
        const res = await api.post('/api/v1/auth/invites', fx.a.adminToken).send({ email: 'new.staff@integration.test', role: 'RECRUITER' });

        expect(res.status).toBe(201);
        const { token, invite } = res.body.data;
        const { pending } = await memoryQueueSnapshot();
        expect(pending).toHaveLength(1);
        expect(pending[0]).toMatchObject({
            type: 'SEND_USER_INVITE',
            inviteId: invite.id,
            instituteId: fx.a.institute.id,
            recipientEmail: 'new.staff@integration.test',
        });
        expect(JSON.stringify(await memoryQueueSnapshot())).not.toContain(token);
        expect(allLogs()).not.toContain(token);
    });

    test('the worker sends the staff invite to its own address, with the token in the body', async () => {
        const res = await api.post('/api/v1/auth/invites', fx.a.adminToken).send({ email: 'staff-two@integration.test', role: 'EVALUATOR' });

        await processDueNotifications();

        expect(transport().sent).toHaveLength(1);
        expect(transport().sent[0].to).toBe('staff-two@integration.test');
        expect(transport().sent[0].text).toContain(res.body.data.token);
    });

    test('revoking a staff invite does not enqueue anything', async () => {
        const created = await api.post('/api/v1/auth/invites', fx.a.adminToken).send({ email: 'revoke.me@integration.test', role: 'RECRUITER' });
        resetNotificationQueue();

        const res = await api.delete(`/api/v1/auth/invites/${created.body.data.invite.id}`, fx.a.adminToken);

        expect(res.status).toBe(200);
        expect((await memoryQueueSnapshot()).pending).toHaveLength(0);
    });

    test('a refused staff invite (a recruiter caller) enqueues nothing', async () => {
        const recruiter = await prisma.user.create({
            data: { email: `rec-${randomUUID()}@integration.test`, password: 'integration-fixture-not-a-login', role: 'RECRUITER', instituteId: fx.a.institute.id },
        });

        const res = await api.post('/api/v1/auth/invites', tokenFor(recruiter)).send({ email: 'blocked@integration.test', role: 'STUDENT' });

        expect(res.status).toBe(403);
        expect((await memoryQueueSnapshot()).pending).toHaveLength(0);
    });
});

describe('institute provisioning notifications', () => {
    test('provisioning with initialAdminEmail enqueues one job for the new institute, without the token', async () => {
        const res = await api
            .post('/api/v1/institutes', superAdminToken)
            .send({ name: 'Notify Co', email: 'notify@integration.test', initialAdminEmail: 'founder@integration.test' });

        expect(res.status).toBe(201);
        const { id: instituteId, initialAdminInvite } = res.body.data;
        const { pending } = await memoryQueueSnapshot();
        expect(pending).toHaveLength(1);
        expect(pending[0]).toMatchObject({
            type: 'SEND_USER_INVITE',
            inviteId: initialAdminInvite.invite.id,
            instituteId,
            recipientEmail: 'founder@integration.test',
        });
        expect(JSON.stringify(await memoryQueueSnapshot())).not.toContain(initialAdminInvite.token);
        expect(allLogs()).not.toContain(initialAdminInvite.token);
    });

    test('provisioning without initialAdminEmail enqueues nothing', async () => {
        const res = await api.post('/api/v1/institutes', superAdminToken).send({ name: 'Quiet Co', email: 'quiet@integration.test' });

        expect(res.status).toBe(201);
        expect((await memoryQueueSnapshot()).pending).toHaveLength(0);
    });

    test('a refused provisioning (an ADMIN caller) enqueues nothing', async () => {
        const res = await api.post('/api/v1/institutes', fx.a.adminToken).send({ name: 'Denied', email: 'denied@integration.test', initialAdminEmail: 'x@integration.test' });

        expect(res.status).toBe(403);
        expect((await memoryQueueSnapshot()).pending).toHaveLength(0);
    });
});
