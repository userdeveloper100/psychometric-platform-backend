/**
 * Step 12 release gate. End-to-end checks for the tenant and role rules that the audit found missing,
 * and for the security event log: the events are written, and no token reaches them.
 */
import { randomUUID } from 'crypto';
import { api, bodyText, prisma, seedTwoTenants, TwoTenantFixture } from '../test-utils/integration/harness';

let fx: TwoTenantFixture;
let warn: jest.SpyInstance;

beforeEach(async () => {
    fx = await seedTwoTenants();
    warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
    warn.mockRestore();
});

afterAll(async () => {
    await prisma.$disconnect();
});

const ids = (res: { body: { data: { id: string }[] } }) => res.body.data.map((row) => row.id);
const securityEvents = () =>
    warn.mock.calls.filter(([message]) => message === 'security_event').map(([, entry]) => entry as Record<string, unknown>);
const loggedText = () => JSON.stringify(warn.mock.calls);

describe('Gate: GET /api/v1/tests is limited to the requester institute', () => {
    test('an admin of A lists only institute A tests, and no institute B test id or title appears', async () => {
        const res = await api.get('/api/v1/tests', fx.a.adminToken);

        expect(res.status).toBe(200);
        expect(ids(res)).toEqual([fx.a.test.id]);
        expect(bodyText(res)).not.toContain(fx.b.test.id);
        expect(bodyText(res)).not.toContain(fx.b.test.title);
        expect(res.body.meta.pagination.total).toBe(1);
    });

    test('a STUDENT cannot list tests, even of their own institute (403, DEC-03; candidates use the invite token)', async () => {
        const res = await api.get('/api/v1/tests', fx.a.studentToken);
        expect(res.status).toBe(403);
        expect(bodyText(res)).not.toContain(fx.a.test.id);
    });

    test('a query instituteId cannot widen the list to institute B', async () => {
        const res = await api.get(`/api/v1/tests?instituteId=${fx.b.institute.id}`, fx.a.adminToken);
        expect(ids(res)).toEqual([fx.a.test.id]);
    });

    test('a token with no institute is refused (403) and no test is listed', async () => {
        const { generateToken } = await import('../utils/jwt');
        const noInstitute = generateToken({ userId: fx.a.admin.id, role: 'ADMIN', instituteId: '' });
        const res = await api.get('/api/v1/tests', noInstitute);
        expect(res.status).toBe(403);
        expect(bodyText(res)).not.toContain(fx.b.test.id);
    });
});

describe('Gate: test write routes require the ADMIN role at the route', () => {
    test('a STUDENT cannot create a test (403) and nothing is created', async () => {
        const before = await prisma.psychometricTest.count();
        const res = await api.post('/api/v1/tests', fx.a.studentToken).send({
            title: 'x',
            description: 'x',
            instituteId: fx.a.institute.id,
        });
        expect(res.status).toBe(403);
        expect(await prisma.psychometricTest.count()).toBe(before);
    });

    test('a STUDENT cannot publish or delete a test (403) and the test is unchanged', async () => {
        const publish = await api.patch(`/api/v1/tests/${fx.a.test.id}/publish`, fx.a.studentToken);
        const remove = await api.delete(`/api/v1/tests/${fx.a.test.id}`, fx.a.studentToken);
        expect(publish.status).toBe(403);
        expect(remove.status).toBe(403);
        expect((await prisma.psychometricTest.findUnique({ where: { id: fx.a.test.id } }))?.isActive).toBe(true);
    });
});

describe('Gate: GET /api/v1/auth/users is ADMIN-only and limited to the requester institute', () => {
    test('an admin of A lists only institute A users; institute B users are not returned', async () => {
        const res = await api.get('/api/v1/auth/users', fx.a.adminToken);

        expect(res.status).toBe(200);
        const emails = res.body.data.map((u: { email: string }) => u.email);
        expect(emails).toContain(fx.a.admin.email);
        expect(emails).not.toContain(fx.b.admin.email);
        expect(bodyText(res)).not.toContain(fx.b.admin.id);
        expect(res.body.meta.pagination.total).toBe(2);
    });

    test('a STUDENT is refused (403) with no user data', async () => {
        const res = await api.get('/api/v1/auth/users', fx.a.studentToken);
        expect(res.status).toBe(403);
        expect(bodyText(res)).not.toContain(fx.a.admin.email);
    });

    test('no token gets 401', async () => {
        const res = await api.get('/api/v1/auth/users');
        expect(res.status).toBe(401);
    });
});

describe('Gate: the security event log is written, and carries no secret', () => {
    test('an invalid token writes one auth_failed event, and the token is not logged', async () => {
        const fake = 'eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiJ4In0.bm90LWEtcmVhbC1zaWduYXR1cmUtdmFsdWU';
        const res = await api.get('/api/v1/tests', fake);

        expect(res.status).toBe(401);
        expect(securityEvents()).toEqual([expect.objectContaining({ event: 'auth_failed', reason: 'invalid' })]);
        expect(loggedText()).not.toContain(fake);
    });

    test('a STUDENT denied on an ADMIN route writes authorization_denied with the route template, no token', async () => {
        const res = await api.post('/api/v1/tests', fx.a.studentToken).send({ title: 'x', description: 'x', instituteId: fx.a.institute.id });

        expect(res.status).toBe(403);
        expect(securityEvents()).toEqual([
            expect.objectContaining({
                event: 'authorization_denied',
                userId: fx.a.studentUser.id,
                instituteId: fx.a.institute.id,
                role: 'STUDENT',
                action: 'POST /api/v1/tests',
                reason: 'role_not_permitted',
            }),
        ]);
        expect(loggedText()).not.toContain(fx.a.studentToken);
    });

    test('publishing a test writes sensitive_admin_action with the test id and no token', async () => {
        const res = await api.patch(`/api/v1/tests/${fx.a.test.id}/publish`, fx.a.adminToken);

        expect(res.status).toBe(200);
        expect(securityEvents()).toEqual([
            expect.objectContaining({
                event: 'sensitive_admin_action',
                action: 'publish_test',
                resourceType: 'test',
                resourceId: fx.a.test.id,
                userId: fx.a.admin.id,
                instituteId: fx.a.institute.id,
            }),
        ]);
        expect(loggedText()).not.toContain(fx.a.adminToken);
    });

    test('a foreign test id on publish writes authorization_denied (not_found_in_scope) and changes nothing', async () => {
        const res = await api.patch(`/api/v1/tests/${fx.b.test.id}/publish`, fx.a.adminToken);

        expect(res.status).toBe(404);
        expect(securityEvents()).toEqual([
            expect.objectContaining({ event: 'authorization_denied', reason: 'not_found_in_scope', resourceId: fx.b.test.id }),
        ]);
    });

    test('a refused invite on submission writes invite_validation_failed with the reason, and the token is not logged', async () => {
        const unknownToken = `unknown-${randomUUID()}`;
        const res = await api.post('/api/v1/responses/submit', fx.a.studentToken).send({
            token: unknownToken,
            studentId: fx.a.student.id,
            responses: [{ questionId: fx.a.question.id, answer: 3 }],
        });

        expect(res.status).toBe(400);
        expect(securityEvents()).toEqual([
            expect.objectContaining({
                event: 'invite_validation_failed',
                reason: 'Invalid or inactive invite token',
                action: 'submit_responses',
                resourceType: 'invite',
            }),
        ]);
        expect(loggedText()).not.toContain(unknownToken);
    });

    test('a valid invite token is not logged even on a refusal for a different reason', async () => {
        const res = await api.post('/api/v1/responses/submit', fx.a.studentToken).send({
            token: fx.a.invite.token,
            studentId: fx.b.student.id,
            responses: [{ questionId: fx.a.question.id, answer: 3 }],
        });

        expect(res.status).toBe(400);
        expect(res.body.message).toBe('Student does not match invite');
        expect(loggedText()).not.toContain(fx.a.invite.token);
    });
});
