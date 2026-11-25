/**
 * DB-02 regression tests: a student can be invited again to the same test after their earlier invite
 * was revoked, expired, or their student record was soft deleted and re-created.
 *
 * The table allows one invite row per (testId, studentId). A re-invite therefore reuses that row with a
 * new token instead of inserting a second one. The old token stops working because it is replaced.
 * A completed invite is never reissued. A duplicate active invite is skipped.
 */
import { randomUUID } from 'crypto';
import { api, bodyText, prisma, seedTwoTenants, TwoTenantFixture } from '../test-utils/integration/harness';

let fx: TwoTenantFixture;

beforeEach(async () => {
    fx = await seedTwoTenants();
});

afterAll(async () => {
    await prisma.$disconnect();
});

const HEX_64 = /^[0-9a-f]{64}$/;

const inviteStudent = (testId: string, studentId: string, token = fx.a.adminToken) =>
    api.post(`/api/invites/tests/${testId}/invite`, token).send({ studentIds: [studentId] });

const submitWith = (token: string, studentId: string, studentToken = fx.a.studentToken) =>
    api.post('/api/responses/responses/submit', studentToken).send({
        token,
        studentId,
        responses: [{ questionId: fx.a.question.id, answer: 2 }],
    });

const inviteRows = (testId: string, studentId: string) =>
    prisma.testInvite.findMany({ where: { testId, studentId } });

describe('DB-02: re-invite after the invite was revoked', () => {
    test('revoke, then re-invite: 201 with a new token, and the new row is the only one for the pair', async () => {
        const oldToken = fx.a.invite.token;
        expect((await api.delete(`/api/invites/${fx.a.invite.id}`, fx.a.adminToken)).status).toBe(200);

        const res = await inviteStudent(fx.a.test.id, fx.a.student.id);
        expect(res.status).toBe(201);
        expect(res.body.data.created).toBe(1);

        const issued = res.body.data.invites[0];
        expect(issued.token).toMatch(HEX_64);
        expect(issued.token).not.toBe(oldToken);

        const rows = await inviteRows(fx.a.test.id, fx.a.student.id);
        expect(rows).toHaveLength(1);
        expect(rows[0].isActive).toBe(true);
        expect(rows[0].status).toBe('PENDING');
    });

    test('the new token submits (201) and the old, revoked token is refused (400)', async () => {
        const oldToken = fx.a.invite.token;
        await api.delete(`/api/invites/${fx.a.invite.id}`, fx.a.adminToken);
        const issued = (await inviteStudent(fx.a.test.id, fx.a.student.id)).body.data.invites[0];

        const oldSubmit = await submitWith(oldToken, fx.a.student.id);
        expect(oldSubmit.status).toBe(400);
        expect(oldSubmit.body.message).toBe('Invalid or inactive invite token');
        expect(bodyText(oldSubmit)).not.toContain(oldToken);

        const newSubmit = await submitWith(issued.token, fx.a.student.id);
        expect(newSubmit.status).toBe(201);
    });

    test('the re-issued token is never returned by a later list or read', async () => {
        await api.delete(`/api/invites/${fx.a.invite.id}`, fx.a.adminToken);
        const issued = (await inviteStudent(fx.a.test.id, fx.a.student.id)).body.data.invites[0];

        const list = await api.get(`/api/invites/tests/${fx.a.test.id}/invites`, fx.a.adminToken);
        expect(list.status).toBe(200);
        expect(bodyText(list)).not.toContain(issued.token);
    });
});

describe('DB-02: re-invite after the invite expired', () => {
    test('expired invite: re-invite gives a new token, the expired token is refused, and the new one submits', async () => {
        const expiredToken = fx.a.invite.token;
        await prisma.testInvite.update({
            where: { id: fx.a.invite.id },
            data: { expiresAt: new Date(Date.now() - 60_000) },
        });

        const res = await inviteStudent(fx.a.test.id, fx.a.student.id);
        expect(res.status).toBe(201);
        expect(res.body.data.created).toBe(1);
        const issued = res.body.data.invites[0];
        expect(issued.token).not.toBe(expiredToken);

        const oldSubmit = await submitWith(expiredToken, fx.a.student.id);
        expect(oldSubmit.status).toBe(400);
        expect(bodyText(oldSubmit)).not.toContain(expiredToken);

        const newSubmit = await submitWith(issued.token, fx.a.student.id);
        expect(newSubmit.status).toBe(201);
    });
});

describe('DB-02: rules that must not reissue', () => {
    test('a duplicate active, unexpired invite is skipped and its token does not change', async () => {
        const before = fx.a.invite.token;
        const res = await inviteStudent(fx.a.test.id, fx.a.student.id);
        expect(res.status).toBe(201);
        expect(res.body.data.created).toBe(0);
        expect(res.body.data.skipped).toBe(1);

        const row = await prisma.testInvite.findUnique({ where: { id: fx.a.invite.id } });
        expect(row?.token).toBe(before);
        expect((await submitWith(before, fx.a.student.id)).status).toBe(201);
    });

    test('a completed invite is not reissued, even after it was revoked', async () => {
        await prisma.testInvite.update({ where: { id: fx.a.invite.id }, data: { status: 'COMPLETED', isActive: false } });
        const res = await inviteStudent(fx.a.test.id, fx.a.student.id);
        expect(res.status).toBe(201);
        expect(res.body.data.created).toBe(0);

        const row = await prisma.testInvite.findUnique({ where: { id: fx.a.invite.id } });
        expect(row?.isActive).toBe(false);
        expect(row?.status).toBe('COMPLETED');
    });

    test('an active completed invite is not reissued', async () => {
        await prisma.testInvite.update({ where: { id: fx.a.invite.id }, data: { status: 'COMPLETED' } });
        const before = fx.a.invite.token;
        const res = await inviteStudent(fx.a.test.id, fx.a.student.id);
        expect(res.body.data.created).toBe(0);
        expect((await prisma.testInvite.findUnique({ where: { id: fx.a.invite.id } }))?.token).toBe(before);
    });
});

describe('DB-02: soft-deleted student and re-creation', () => {
    test('a soft-deleted student cannot be invited by the old id (404), and their invites stay inactive', async () => {
        expect((await api.delete(`/api/students/${fx.a.student.id}`, fx.a.adminToken)).status).toBe(200);
        const res = await inviteStudent(fx.a.test.id, fx.a.student.id);
        expect(res.status).toBe(404);
        expect((await prisma.testInvite.findUnique({ where: { id: fx.a.invite.id } }))?.isActive).toBe(false);
    });

    test('delete the student, re-create them with the same email, and invite the new record (201, submits)', async () => {
        const oldToken = fx.a.invite.token;
        expect((await api.delete(`/api/students/${fx.a.student.id}`, fx.a.adminToken)).status).toBe(200);

        const created = await api.post('/api/students/AddStudent', fx.a.adminToken).send({
            name: 'Returning student',
            email: fx.a.student.email,
        });
        expect(created.status).toBe(201);
        const newStudentId = created.body.data.id;
        expect(newStudentId).not.toBe(fx.a.student.id);

        const res = await inviteStudent(fx.a.test.id, newStudentId);
        expect(res.status).toBe(201);
        expect(res.body.data.created).toBe(1);
        const issued = res.body.data.invites[0];

        expect((await submitWith(issued.token, newStudentId)).status).toBe(201);
        expect((await submitWith(oldToken, fx.a.student.id)).status).toBe(400);
    });
});

describe('DB-02: tenant isolation is preserved on re-invite', () => {
    test('admin of A cannot re-invite a student of institute B to an own test (404), and no row changes', async () => {
        const before = await prisma.testInvite.count();
        const res = await inviteStudent(fx.a.test.id, fx.b.student.id);
        expect(res.status).toBe(404);
        expect(await prisma.testInvite.count()).toBe(before);
    });

    test('admin of A cannot re-invite an own student to a test of institute B (404)', async () => {
        const before = await prisma.testInvite.count();
        const res = await inviteStudent(fx.b.test.id, fx.a.student.id);
        expect(res.status).toBe(404);
        expect(await prisma.testInvite.count()).toBe(before);
    });

    test('a revoked B invite is not reissued by admin of A (404), and B stays revoked', async () => {
        await api.delete(`/api/invites/${fx.b.invite.id}`, fx.b.adminToken);
        const res = await inviteStudent(fx.a.test.id, fx.b.student.id);
        expect(res.status).toBe(404);
        expect((await prisma.testInvite.findUnique({ where: { id: fx.b.invite.id } }))?.isActive).toBe(false);
    });

    test('a non-existent student gets the same response as a foreign one (no existence leak)', async () => {
        const foreign = await inviteStudent(fx.a.test.id, fx.b.student.id);
        const missing = await inviteStudent(fx.a.test.id, randomUUID());
        expect(foreign.status).toBe(missing.status);
        expect(foreign.body.message).toBe(missing.body.message);
    });
});
