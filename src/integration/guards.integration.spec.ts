/**
 * Regression guards: behaviour that is CORRECT today and must keep working.
 * These tests pass against the current code. Passing here does not mean an audit
 * finding is fixed. The vulnerable cases for the same endpoints are in
 * security.pending.integration.spec.ts.
 */
import {
    DENIED_STATUSES,
    api,
    bodyText,
    prisma,
    seedTwoTenants,
    TwoTenantFixture,
} from '../test-utils/integration/harness';

let fx: TwoTenantFixture;

beforeEach(async () => {
    fx = await seedTwoTenants();
});

afterAll(async () => {
    await prisma.$disconnect();
});

describe('harness: authentication with the application configuration', () => {
    test('a token issued by the app is accepted by a protected route', async () => {
        const res = await api.get('/api/students', fx.a.adminToken);
        expect(res.status).toBe(200);
    });

    test('a request without a token is rejected with 401', async () => {
        const res = await api.get('/api/students');
        expect(res.status).toBe(401);
    });
});

describe('students list is tenant-scoped (guards SEC-09 area)', () => {
    test('admin of A sees A students only', async () => {
        const res = await api.get('/api/students', fx.a.adminToken);
        expect(res.status).toBe(200);
        expect(bodyText(res)).toContain(fx.a.student.email);
        expect(bodyText(res)).not.toContain(fx.b.student.email);
    });
});

describe('test publish and delete: correct cases (guards SEC-01 area)', () => {
    test('admin publishes their own institute test without a body instituteId', async () => {
        const res = await api.patch(`/api/tests/${fx.a.test.id}/publish`, fx.a.adminToken).send({});
        expect(res.status).toBe(200);
        const row = await prisma.psychometricTest.findUnique({ where: { id: fx.a.test.id } });
        expect(row?.status).toBe('PUBLISHED');
    });

    test('admin publishing another institute test without a body instituteId is refused with 403', async () => {
        const res = await api.patch(`/api/tests/${fx.b.test.id}/publish`, fx.a.adminToken).send({});
        expect(res.status).toBe(403);
        const row = await prisma.psychometricTest.findUnique({ where: { id: fx.b.test.id } });
        expect(row?.status).toBe('DRAFT');
    });

    test('a STUDENT cannot publish a test (role check in service)', async () => {
        const res = await api.patch(`/api/tests/${fx.a.test.id}/publish`, fx.a.studentToken).send({});
        expect(res.status).toBe(403);
    });
});

describe('institute endpoints: correct cases (guards SEC-02 area)', () => {
    test('unauthenticated institute list is rejected with 401', async () => {
        const res = await api.get('/api/institutes');
        expect(res.status).toBe(401);
    });

    test('admin can read their own institute', async () => {
        const res = await api.get(`/api/institutes/${fx.a.institute.id}`, fx.a.adminToken);
        expect(res.status).toBe(200);
    });
});

describe('response reads: correct cases (guards SEC-03 area)', () => {
    test('unauthenticated test response read is rejected with 401', async () => {
        const res = await api.get(`/api/responses/responses/test/${fx.a.test.id}`);
        expect(res.status).toBe(401);
    });
});

describe('invite listing: correct cases (guards SEC-05 area)', () => {
    test('admin sees the tokens of invites in their own test', async () => {
        const res = await api.get(`/api/invites/tests/${fx.a.test.id}/invites`, fx.a.adminToken);
        expect(res.status).toBe(200);
        expect(bodyText(res)).toContain(fx.a.invite.token);
    });

    test('admin asking for another institute test invites is denied, and no B token is returned', async () => {
        const res = await api.get(`/api/invites/tests/${fx.b.test.id}/invites`, fx.a.adminToken);
        expect(DENIED_STATUSES).toContain(res.status);
        expect(bodyText(res)).not.toContain(fx.b.invite.token);
    });
});

describe('dimension creation: correct cases (guards SEC-06 area)', () => {
    test('admin can add a dimension to their own institute test', async () => {
        const res = await api
            .post(`/api/dimensions/tests/${fx.a.test.id}/dimensions`, fx.a.adminToken)
            .send({ name: 'Openness', description: 'Trait dimension' });
        expect(res.status).toBe(201);
    });

    test('a STUDENT cannot add a dimension (route role check)', async () => {
        const res = await api
            .post(`/api/dimensions/tests/${fx.a.test.id}/dimensions`, fx.a.studentToken)
            .send({ name: 'Openness', description: 'Trait dimension' });
        expect(res.status).toBe(403);
    });
});

describe('reports: correct cases (guards SEC-10 area)', () => {
    // Note: the report handler currently returns 400 for every valid request because the
    // route param is :testId but the controller reads req.params.id. That functional defect
    // is pending in security.pending.integration.spec.ts, so this guard only covers the
    // role check, which runs before the handler.
    test('a STUDENT cannot read a test report (route role check)', async () => {
        const res = await api.get(`/api/reports/reports/test/${fx.a.test.id}`, fx.a.studentToken);
        expect(res.status).toBe(403);
    });
});
