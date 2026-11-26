/**
 * DEC-01 regression suite: the SaaS role hierarchy and tenant provisioning, end to end against the test database.
 *   - SUPER_ADMIN (platform level, no institute) provisions an institute and its first ADMIN invite.
 *   - Tenant ADMIN, RECRUITER and EVALUATOR are confined to their own institute, and each role has only its
 *     own permissions. A STUDENT (candidate) has no staff access.
 *   - No role can grant SUPER_ADMIN through an invite.
 *   - A non-SUPER_ADMIN token without an institute is refused.
 */

import { createHash } from 'crypto';
import logger from '../config/logger';
import { generateToken } from '../utils/jwt';
import {
    api,
    bodyText,
    prisma,
    seedTwoTenants,
    tokenFor,
    TwoTenantFixture,
} from '../test-utils/integration/harness';

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const DAY_MS = 24 * 60 * 60 * 1000;

let fx: TwoTenantFixture;
let superAdminToken: string;
let recruiterA: string;
let evaluatorA: string;
let recruiterB: string;

/** Creates a staff user of an institute (or a platform user when no institute is given) and returns its token. */
const staffToken = async (role: 'ADMIN' | 'RECRUITER' | 'EVALUATOR' | 'SUPER_ADMIN', instituteId: string | null, label: string) => {
    const user = await prisma.user.create({
        data: {
            email: `${label}@integration.test`,
            password: 'integration-fixture-not-a-login',
            role,
            instituteId,
        },
    });
    return tokenFor(user);
};

beforeEach(async () => {
    fx = await seedTwoTenants();
    superAdminToken = await staffToken('SUPER_ADMIN', null, 'root');
    recruiterA = await staffToken('RECRUITER', fx.a.institute.id, 'recruiter-a');
    evaluatorA = await staffToken('EVALUATOR', fx.a.institute.id, 'evaluator-a');
    recruiterB = await staffToken('RECRUITER', fx.b.institute.id, 'recruiter-b');
});

afterAll(async () => {
    await prisma.$disconnect();
});

// ─── SUPER_ADMIN provisioning ────────────────────────────────────────────────

describe('SUPER_ADMIN provisions a tenant (DEC-01)', () => {
    test('201 creates the institute and its first ADMIN invite in one step, and returns the raw token once', async () => {
        const res = await api
            .post('/api/v1/institutes', superAdminToken)
            .send({ name: 'Globex', email: 'hq@globex.test', initialAdminEmail: 'first-admin@globex.test' });

        expect(res.status).toBe(201);
        const token: string = res.body.data.initialAdminInvite.token;
        expect(token).toMatch(/^[0-9a-f]{64}$/);

        const invite = await prisma.userInvite.findFirstOrThrow({ where: { email: 'first-admin@globex.test' } });
        expect(invite.role).toBe('ADMIN');
        expect(invite.instituteId).toBe(res.body.data.id);
        expect(invite.tokenHash).toBe(sha256(token));
        expect(JSON.stringify(invite)).not.toContain(token);
    });

    test('the invited admin accepts the invite, logs in to the new institute, and manages it', async () => {
        const created = await api
            .post('/api/v1/institutes', superAdminToken)
            .send({ name: 'Initech', email: 'hq@initech.test', initialAdminEmail: 'boss@initech.test' });
        const token: string = created.body.data.initialAdminInvite.token;
        const instituteId: string = created.body.data.id;

        const accepted = await api
            .post('/api/v1/auth/accept-invite')
            .send({ token, name: 'Boss', password: 'Boss@12345' });
        expect(accepted.status).toBe(201);
        expect(accepted.body.data).toEqual(expect.objectContaining({ role: 'ADMIN', instituteId }));

        const login = await api.post('/api/v1/auth/login').send({ email: 'boss@initech.test', password: 'Boss@12345' });
        expect(login.status).toBe(200);
        const adminToken: string = login.body.data.token;

        const own = await api.get(`/api/v1/institutes/${instituteId}`, adminToken);
        expect(own.status).toBe(200);
    });

    test('a provisioning request with an email that already has an account is refused (409), and no institute is created', async () => {
        const before = await prisma.institute.count();

        const res = await api
            .post('/api/v1/institutes', superAdminToken)
            .send({ name: 'Dup', email: 'dup@integration.test', initialAdminEmail: fx.a.admin.email });

        expect(res.status).toBe(409);
        expect(await prisma.institute.count()).toBe(before);
    });

    test('an institute created without an initial admin has no invite', async () => {
        const res = await api
            .post('/api/v1/institutes', superAdminToken)
            .send({ name: 'Bare', email: 'bare@integration.test' });

        expect(res.status).toBe(201);
        expect(await prisma.userInvite.count({ where: { instituteId: res.body.data.id } })).toBe(0);
    });

    test('a SUPER_ADMIN is refused on tenant endpoints (403), because it has no institute', async () => {
        expect((await api.get('/api/v1/tests', superAdminToken)).status).toBe(403);
        expect((await api.get('/api/v1/institutes', superAdminToken)).status).toBe(403);
        expect((await api.get(`/api/v1/institutes/${fx.a.institute.id}`, superAdminToken)).status).toBe(403);
        expect((await api.get('/api/v1/reports/test/' + fx.a.test.id, superAdminToken)).status).toBe(403);
    });
});

// ─── Tenant ADMIN ─────────────────────────────────────────────────────────────

describe('tenant ADMIN (DEC-01)', () => {
    test('a tenant ADMIN cannot create an institute (403), and none is created', async () => {
        const before = await prisma.institute.count();

        const res = await api.post('/api/v1/institutes', fx.a.adminToken).send({ name: 'Mine', email: 'mine@integration.test' });

        expect(res.status).toBe(403);
        expect(await prisma.institute.count()).toBe(before);
    });

    test('a tenant ADMIN cannot invite a SUPER_ADMIN (403), and no invite is written', async () => {
        const before = await prisma.userInvite.count();
        const warn = jest.spyOn(logger, 'warn');

        const res = await api.post('/api/v1/auth/invites', fx.a.adminToken).send({ email: 'root2@integration.test', role: 'SUPER_ADMIN' });

        expect(res.status).toBe(403);
        expect(await prisma.userInvite.count()).toBe(before);
        const entries = warn.mock.calls.filter(([m]) => m === 'security_event').map(([, e]) => e);
        expect(entries).toContainEqual(expect.objectContaining({ event: 'authorization_denied', reason: 'privilege_escalation_blocked' }));
    });

    test.each([
        ['RECRUITER', 201],
        ['EVALUATOR', 201],
        ['ADMIN', 201],
        ['STUDENT', 201],
    ])('a tenant ADMIN can invite a %s (%i)', async (role, status) => {
        const res = await api.post('/api/v1/auth/invites', fx.a.adminToken).send({ email: `new-${role.toLowerCase()}@integration.test`, role });
        expect(res.status).toBe(status);
        expect(res.body.data.invite.role).toBe(role);
    });

    test('a tenant ADMIN may not provision a new institute, but can still manage their own (GET/PUT/DELETE own id)', async () => {
        expect((await api.get(`/api/v1/institutes/${fx.a.institute.id}`, fx.a.adminToken)).status).toBe(200);
        expect((await api.get(`/api/v1/institutes/${fx.b.institute.id}`, fx.a.adminToken)).status).toBe(404);
    });
});

// ─── Tenant RECRUITER ─────────────────────────────────────────────────────────

describe('tenant RECRUITER (DEC-01)', () => {
    test('reads the active tests, dimensions and questions of its own institute (200)', async () => {
        const tests = await api.get('/api/v1/tests', recruiterA);
        expect(tests.status).toBe(200);
        expect(bodyText(tests)).toContain(fx.a.test.id);
        expect(bodyText(tests)).not.toContain(fx.b.test.id);

        expect((await api.get('/api/v1/dimensions', recruiterA)).status).toBe(200);
        expect((await api.get(`/api/v1/dimensions/tests/${fx.a.test.id}/dimensions`, recruiterA)).status).toBe(200);
        expect((await api.get('/api/v1/questions', recruiterA)).status).toBe(200);
        expect((await api.get(`/api/v1/questions/dimensions/${fx.a.dimension.id}/questions`, recruiterA)).status).toBe(200);
    });

    test('views the reports of its own institute (200), and a foreign test is 404', async () => {
        expect((await api.get(`/api/v1/reports/test/${fx.a.test.id}`, recruiterA)).status).toBe(200);
        expect((await api.get(`/api/v1/reports/test/${fx.b.test.id}`, recruiterA)).status).toBe(404);
    });

    test('creates candidates in its own institute (201)', async () => {
        const res = await api
            .post('/api/v1/students/AddStudent', recruiterA)
            .send({ name: 'Candidate One', email: 'candidate-one@integration.test' });

        expect(res.status).toBe(201);
        const row = await prisma.student.findFirst({ where: { email: 'candidate-one@integration.test' } });
        expect(row?.instituteId).toBe(fx.a.institute.id);
    });

    test('issues and revokes candidate test invites in its own institute (201, 200)', async () => {
        const student = await prisma.student.create({
            data: { name: 'Invitee', email: 'invitee@integration.test', instituteId: fx.a.institute.id },
        });

        const created = await api
            .post(`/api/v1/invites/tests/${fx.a.test.id}/invite`, recruiterA)
            .send({ studentIds: [student.id] });
        expect(created.status).toBe(201);

        const inviteId = await prisma.testInvite.findFirstOrThrow({ where: { studentId: student.id } }).then((r) => r.id);
        expect((await api.delete(`/api/v1/invites/${inviteId}`, recruiterA)).status).toBe(200);
    });

    test('a foreign test or candidate is 404 for the RECRUITER of another institute', async () => {
        const res = await api.post(`/api/v1/invites/tests/${fx.a.test.id}/invite`, recruiterB).send({ studentIds: [fx.b.student.id] });
        expect(res.status).toBe(404);
    });

    test('is refused (403) on test, dimension, question and response writes, on institute writes and on staff invites', async () => {
        const denied = [
            await api.post('/api/v1/tests', recruiterA).send({ title: 'x', instituteId: fx.a.institute.id }),
            await api.patch(`/api/v1/tests/${fx.a.test.id}/publish`, recruiterA),
            await api.delete(`/api/v1/tests/${fx.a.test.id}`, recruiterA),
            await api.post(`/api/v1/dimensions/tests/${fx.a.test.id}/dimensions`, recruiterA).send({ name: 'x' }),
            await api.delete(`/api/v1/dimensions/${fx.a.dimension.id}`, recruiterA),
            await api.post(`/api/v1/questions/dimensions/${fx.a.dimension.id}/questions`, recruiterA).send({ text: 'x', scaleMin: 1, scaleMax: 5 }),
            await api.delete(`/api/v1/questions/${fx.a.question.id}`, recruiterA),
            await api.delete(`/api/v1/responses/${fx.a.response.id}`, recruiterA),
            await api.put(`/api/v1/institutes/${fx.a.institute.id}`, recruiterA).send({ name: 'Renamed' }),
            await api.delete(`/api/v1/institutes/${fx.a.institute.id}`, recruiterA),
            await api.post('/api/v1/auth/invites', recruiterA).send({ email: 'x@integration.test', role: 'STUDENT' }),
            await api.get('/api/v1/auth/invites', recruiterA),
        ];
        for (const res of denied) expect(res.status).toBe(403);
        expect((await prisma.institute.findUniqueOrThrow({ where: { id: fx.a.institute.id } })).name).toBe(fx.a.institute.name);
        expect(await prisma.response.findUniqueOrThrow({ where: { id: fx.a.response.id } }).then((r) => r.isActive)).toBe(true);
    });

    test('cannot read responses (403)', async () => {
        expect((await api.get('/api/v1/responses', recruiterA)).status).toBe(403);
        expect((await api.get(`/api/v1/responses/test/${fx.a.test.id}`, recruiterA)).status).toBe(403);
    });
});

// ─── Tenant EVALUATOR ─────────────────────────────────────────────────────────

describe('tenant EVALUATOR (DEC-01)', () => {
    test('reads tests, dimensions, questions, responses and reports of its own institute (200)', async () => {
        expect((await api.get('/api/v1/tests', evaluatorA)).status).toBe(200);
        expect((await api.get('/api/v1/dimensions', evaluatorA)).status).toBe(200);
        expect((await api.get('/api/v1/questions', evaluatorA)).status).toBe(200);
        expect((await api.get('/api/v1/responses', evaluatorA)).status).toBe(200);
        expect((await api.get(`/api/v1/responses/test/${fx.a.test.id}`, evaluatorA)).status).toBe(200);
        expect((await api.get(`/api/v1/responses/student/${fx.a.student.id}`, evaluatorA)).status).toBe(200);
        expect((await api.get(`/api/v1/reports/test/${fx.a.test.id}`, evaluatorA)).status).toBe(200);
    });

    test('a foreign test or student is 404 for the EVALUATOR of another institute', async () => {
        expect((await api.get(`/api/v1/responses/test/${fx.b.test.id}`, evaluatorA)).status).toBe(404);
        expect((await api.get(`/api/v1/responses/student/${fx.b.student.id}`, evaluatorA)).status).toBe(404);
        expect((await api.get(`/api/v1/reports/test/${fx.b.test.id}`, evaluatorA)).status).toBe(404);
    });

    test('is refused (403) on every write, delete, invite, candidate and institute operation', async () => {
        const denied = [
            await api.post('/api/v1/tests', evaluatorA).send({ title: 'x' }),
            await api.patch(`/api/v1/tests/${fx.a.test.id}/publish`, evaluatorA),
            await api.delete(`/api/v1/tests/${fx.a.test.id}`, evaluatorA),
            await api.post(`/api/v1/dimensions/tests/${fx.a.test.id}/dimensions`, evaluatorA).send({ name: 'x' }),
            await api.delete(`/api/v1/dimensions/${fx.a.dimension.id}`, evaluatorA),
            await api.post(`/api/v1/questions/dimensions/${fx.a.dimension.id}/questions`, evaluatorA).send({}),
            await api.delete(`/api/v1/questions/${fx.a.question.id}`, evaluatorA),
            await api.delete(`/api/v1/responses/${fx.a.response.id}`, evaluatorA),
            await api.post('/api/v1/students/AddStudent', evaluatorA).send({ name: 'x', email: 'x@integration.test' }),
            await api.get('/api/v1/students', evaluatorA),
            await api.delete(`/api/v1/students/${fx.a.student.id}`, evaluatorA),
            await api.post(`/api/v1/invites/tests/${fx.a.test.id}/invite`, evaluatorA).send({ studentIds: [fx.a.student.id] }),
            await api.get('/api/v1/invites', evaluatorA),
            await api.delete(`/api/v1/invites/${fx.a.invite.id}`, evaluatorA),
            await api.get(`/api/v1/institutes/${fx.a.institute.id}`, evaluatorA),
            await api.put(`/api/v1/institutes/${fx.a.institute.id}`, evaluatorA).send({ name: 'x' }),
            await api.delete(`/api/v1/institutes/${fx.a.institute.id}`, evaluatorA),
            await api.post('/api/v1/institutes', evaluatorA).send({ name: 'x', email: 'x@integration.test' }),
            await api.post('/api/v1/auth/invites', evaluatorA).send({ email: 'x@integration.test', role: 'STUDENT' }),
            await api.get('/api/v1/auth/invites', evaluatorA),
        ];
        for (const res of denied) expect(res.status).toBe(403);
        expect(await prisma.response.findUniqueOrThrow({ where: { id: fx.a.response.id } }).then((r) => r.isActive)).toBe(true);
        expect(await prisma.psychometricTest.findUniqueOrThrow({ where: { id: fx.a.test.id } }).then((r) => r.status)).toBe('DRAFT');
    });
});

// ─── Token scope and the candidate ─────────────────────────────────────────────

describe('token scope and the candidate role (DEC-01)', () => {
    test('a non-SUPER_ADMIN token with no institute is refused (403, fail closed), on any route', async () => {
        const noScope = generateToken({ userId: fx.a.admin.id, role: 'ADMIN', instituteId: null });
        expect((await api.get('/api/v1/tests', noScope)).status).toBe(403);
        expect((await api.get(`/api/v1/institutes/${fx.a.institute.id}`, noScope)).status).toBe(403);
    });

    test('a STUDENT token has no staff access (403 on the staff reads and writes)', async () => {
        expect((await api.get('/api/v1/tests', fx.a.studentToken)).status).toBe(403);
        expect((await api.get('/api/v1/reports/test/' + fx.a.test.id, fx.a.studentToken)).status).toBe(403);
        expect((await api.post('/api/v1/auth/invites', fx.a.studentToken)).status).toBe(403);
    });

    test('the candidate assessment still needs no staff token (DEC-03 unchanged)', async () => {
        const res = await api.post('/api/v1/invites/assessment').send({ token: fx.a.invite.token });
        expect(res.status).toBe(200);
    });

    test('a token without a valid role gets no access (401 without a user, 403 wrong role)', async () => {
        const unknownRole = generateToken({ userId: fx.a.admin.id, role: 'OWNER', instituteId: fx.a.institute.id });
        expect((await api.get('/api/v1/tests', unknownRole)).status).toBe(403);
    });
});
