/**
 * SEC-05 regression tests: invite listings never expose a token, invite endpoints are ADMIN-only
 * and confined to the caller's institute, and invalid invites are refused without echoing the token.
 *
 * Promoted from security.pending.integration.spec.ts once SEC-05 was fixed.
 * A token is returned once, in the response to the admin who creates the invite. It is never returned by a read.
 */
import { randomUUID } from 'crypto';
import { api, bodyText, DENIED_STATUSES, prisma, seedTwoTenants, TwoTenantFixture } from '../test-utils/integration/harness';
import { generateToken } from '../utils/jwt';

let fx: TwoTenantFixture;

beforeEach(async () => {
    fx = await seedTwoTenants();
});

afterAll(async () => {
    await prisma.$disconnect();
});

const inviteRow = (id: string) => prisma.testInvite.findUnique({ where: { id } });
const ids = (res: { body: { data: { id: string }[] } }) => res.body.data.map((row) => row.id);
const HEX_64 = /^[0-9a-f]{64}$/;

describe('SEC-05: role authorization (STUDENT is refused with 403)', () => {
    test('a STUDENT cannot list invites (403)', async () => {
        const res = await api.get('/api/v1/invites', fx.a.studentToken);
        expect(res.status).toBe(403);
    });

    test('a STUDENT cannot list the invites of a test (403)', async () => {
        const res = await api.get(`/api/v1/invites/tests/${fx.a.test.id}/invites`, fx.a.studentToken);
        expect(res.status).toBe(403);
        expect(bodyText(res)).not.toContain(fx.a.invite.token);
    });

    test('a STUDENT cannot list the invites of a student record (403), and no token is returned', async () => {
        const res = await api.get(`/api/v1/invites/students/${fx.a.student.id}/invites`, fx.a.studentToken);
        expect(res.status).toBe(403);
        expect(bodyText(res)).not.toContain(fx.a.invite.token);
    });

    test('a STUDENT cannot invite students to a test (403) and no invite is created', async () => {
        const before = await prisma.testInvite.count();
        const res = await api
            .post(`/api/v1/invites/tests/${fx.a.test.id}/invite`, fx.a.studentToken)
            .send({ studentIds: [fx.a.student.id] });
        expect(res.status).toBe(403);
        expect(await prisma.testInvite.count()).toBe(before);
    });

    test('a STUDENT cannot revoke an invite (403) and it stays active', async () => {
        const res = await api.delete(`/api/v1/invites/${fx.a.invite.id}`, fx.a.studentToken);
        expect(res.status).toBe(403);
        expect((await inviteRow(fx.a.invite.id))?.isActive).toBe(true);
    });
});

describe('SEC-05: unauthenticated requests are refused with 401', () => {
    test('list, test list, student list, create and revoke without a token all return 401', async () => {
        const responses = [
            await api.get('/api/v1/invites'),
            await api.get(`/api/v1/invites/tests/${fx.a.test.id}/invites`),
            await api.get(`/api/v1/invites/students/${fx.a.student.id}/invites`),
            await api.post(`/api/v1/invites/tests/${fx.a.test.id}/invite`).send({ studentIds: [fx.a.student.id] }),
            await api.delete(`/api/v1/invites/${fx.a.invite.id}`),
        ];
        for (const res of responses) {
            expect(res.status).toBe(401);
        }
        expect((await inviteRow(fx.a.invite.id))?.isActive).toBe(true);
    });
});

describe('SEC-05: listings never expose a token', () => {
    test('admin of A listing invites gets only institute A invites, with no token field and no token value', async () => {
        const res = await api.get('/api/v1/invites', fx.a.adminToken);
        expect(res.status).toBe(200);
        expect(ids(res)).toEqual([fx.a.invite.id]);
        expect(res.body.data.every((row: object) => !('token' in row))).toBe(true);
        expect(bodyText(res)).not.toContain(fx.a.invite.token);
        expect(bodyText(res)).not.toContain(fx.b.invite.token);
    });

    test('admin of A test invite list has no token', async () => {
        const res = await api.get(`/api/v1/invites/tests/${fx.a.test.id}/invites`, fx.a.adminToken);
        expect(res.status).toBe(200);
        expect(bodyText(res)).toContain(fx.a.invite.id);
        expect(bodyText(res)).not.toContain(fx.a.invite.token);
    });

    test('admin of A student invite list has no token', async () => {
        const res = await api.get(`/api/v1/invites/students/${fx.a.student.id}/invites`, fx.a.adminToken);
        expect(res.status).toBe(200);
        expect(bodyText(res)).toContain(fx.a.invite.id);
        expect(bodyText(res)).not.toContain(fx.a.invite.token);
    });

    test('the token is returned once, to the admin who creates the invite, and it is a 256-bit hex value', async () => {
        const student = await prisma.student.create({
            data: { name: 'New student', email: 'new-student@integration.test', instituteId: fx.a.institute.id },
        });
        const res = await api
            .post(`/api/v1/invites/tests/${fx.a.test.id}/invite`, fx.a.adminToken)
            .send({ studentIds: [student.id] });
        expect(res.status).toBe(201);

        const created = res.body.data.invites[0];
        expect(created.token).toMatch(HEX_64);
        expect((await inviteRow(created.id))?.token).toBe(created.token);

        // A later read of the same invite does not return the token again.
        const later = await api.get(`/api/v1/invites/tests/${fx.a.test.id}/invites`, fx.a.adminToken);
        expect(bodyText(later)).not.toContain(created.token);
    });
});

describe('SEC-05: tenant boundary (ADMIN of A is confined to institute A)', () => {
    test('admin of A listing a test of institute B gets 404 and no B invite', async () => {
        const res = await api.get(`/api/v1/invites/tests/${fx.b.test.id}/invites`, fx.a.adminToken);
        expect(res.status).toBe(404);
        expect(bodyText(res)).not.toContain(fx.b.invite.id);
    });

    test('admin of A listing a student of institute B gets 404 and no B invite', async () => {
        const res = await api.get(`/api/v1/invites/students/${fx.b.student.id}/invites`, fx.a.adminToken);
        expect(res.status).toBe(404);
        expect(bodyText(res)).not.toContain(fx.b.invite.id);
    });

    test('admin of A cannot invite students to institute B test (404) and no invite is created', async () => {
        const before = await prisma.testInvite.count({ where: { testId: fx.b.test.id } });
        const res = await api
            .post(`/api/v1/invites/tests/${fx.b.test.id}/invite`, fx.a.adminToken)
            .send({ studentIds: [fx.a.student.id] });
        expect(res.status).toBe(404);
        expect(await prisma.testInvite.count({ where: { testId: fx.b.test.id } })).toBe(before);
    });

    test('admin of A cannot revoke an invite of institute B (404) and it stays active', async () => {
        const res = await api.delete(`/api/v1/invites/${fx.b.invite.id}`, fx.a.adminToken);
        expect(res.status).toBe(404);
        expect((await inviteRow(fx.b.invite.id))?.isActive).toBe(true);
    });

    test('a foreign invite and a non-existent invite get the same response (no existence leak)', async () => {
        const foreign = await api.delete(`/api/v1/invites/${fx.b.invite.id}`, fx.a.adminToken);
        const missing = await api.delete(`/api/v1/invites/${randomUUID()}`, fx.a.adminToken);
        expect(foreign.status).toBe(missing.status);
        expect(foreign.body.message).toBe(missing.body.message);
    });

    test('admin of A can revoke an own invite (200), and the revoked token is then refused', async () => {
        const res = await api.delete(`/api/v1/invites/${fx.a.invite.id}`, fx.a.adminToken);
        expect(res.status).toBe(200);
        expect((await inviteRow(fx.a.invite.id))?.isActive).toBe(false);

        const submit = await api.post('/api/v1/responses/submit', fx.a.studentToken).send({
            token: fx.a.invite.token,
            studentId: fx.a.student.id,
            responses: [{ questionId: fx.a.question.id, answer: 2 }],
        });
        expect(submit.status).toBe(400);
        expect(submit.body.message).toBe('Invalid or inactive invite token');
    });
});

describe('SEC-05: spoofed instituteId cannot override req.user.instituteId', () => {
    test('a query instituteId on the list does not widen the scope beyond institute A', async () => {
        const res = await api.get(`/api/v1/invites?instituteId=${fx.b.institute.id}`, fx.a.adminToken);
        expect(res.status).toBe(200);
        expect(ids(res)).toEqual([fx.a.invite.id]);
    });

    test('a body instituteId on a revoke of a B invite does not grant access (404)', async () => {
        const res = await api
            .delete(`/api/v1/invites/${fx.b.invite.id}`, fx.a.adminToken)
            .send({ instituteId: fx.a.institute.id });
        expect(res.status).toBe(404);
        expect((await inviteRow(fx.b.invite.id))?.isActive).toBe(true);
    });
});

describe('SEC-05: a token without an institute fails closed', () => {
    // Built inside each test, because the fixture is only seeded in beforeEach.
    const noInstituteToken = () => generateToken({ userId: fx.a.admin.id, role: 'ADMIN', instituteId: '' });

    test('list is refused with 403 and no invite or token is returned', async () => {
        const res = await api.get('/api/v1/invites', noInstituteToken());
        expect(res.status).toBe(403);
        expect(bodyText(res)).not.toContain(fx.a.invite.token);
        expect(bodyText(res)).not.toContain(fx.b.invite.token);
    });

    test('test and student lookups and revoke are refused and B data is not touched', async () => {
        const test = await api.get(`/api/v1/invites/tests/${fx.b.test.id}/invites`, noInstituteToken());
        const student = await api.get(`/api/v1/invites/students/${fx.b.student.id}/invites`, noInstituteToken());
        const remove = await api.delete(`/api/v1/invites/${fx.b.invite.id}`, noInstituteToken());
        expect(DENIED_STATUSES).toContain(test.status);
        expect(DENIED_STATUSES).toContain(student.status);
        expect(DENIED_STATUSES).toContain(remove.status);
        expect((await inviteRow(fx.b.invite.id))?.isActive).toBe(true);
    });
});

describe('SEC-05: invalid invites are refused without echoing the token', () => {
    const submit = (token: string, studentToken = fx.a.studentToken, studentId = fx.a.student.id) =>
        api.post('/api/v1/responses/submit', studentToken).send({
            token,
            studentId,
            responses: [{ questionId: fx.a.question.id, answer: 2 }],
        });

    test('an unknown token is refused (400) and the sent value is not echoed', async () => {
        const unknown = `unknown-${randomUUID()}`;
        const res = await submit(unknown);
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('Invalid or inactive invite token');
        expect(bodyText(res)).not.toContain(unknown);
    });

    test('an expired invite is refused (400), nothing is saved, and the token is not echoed', async () => {
        await prisma.testInvite.update({
            where: { id: fx.a.invite.id },
            data: { expiresAt: new Date(Date.now() - 60_000) },
        });
        const res = await submit(fx.a.invite.token);
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('Invite has expired');
        expect(bodyText(res)).not.toContain(fx.a.invite.token);
        expect(await prisma.response.count({ where: { studentId: fx.a.student.id } })).toBe(1);
        expect((await inviteRow(fx.a.invite.id))?.status).toBe('PENDING');
    });

    test('an already used invite is refused (400) and the token is not echoed', async () => {
        await prisma.testInvite.update({ where: { id: fx.a.invite.id }, data: { status: 'COMPLETED' } });
        const res = await submit(fx.a.invite.token);
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('Responses already submitted for this invite');
        expect(bodyText(res)).not.toContain(fx.a.invite.token);
    });

    test('a valid, unexpired invite still submits (201)', async () => {
        await prisma.testInvite.update({
            where: { id: fx.a.invite.id },
            data: { expiresAt: new Date(Date.now() + 60 * 60_000) },
        });
        const res = await submit(fx.a.invite.token);
        expect(res.status).toBe(201);
        expect((await inviteRow(fx.a.invite.id))?.status).toBe('COMPLETED');
    });
});
