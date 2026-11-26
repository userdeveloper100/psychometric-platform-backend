/**
 * Regression guards: behaviour that is CORRECT today and must keep working.
 * These tests pass against the current code. Passing here does not mean an audit
 * finding is fixed. The vulnerable cases for the same endpoints are in
 * security.pending.integration.spec.ts.
 */
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { env } from '../config/env';
import {
    DENIED_STATUSES,
    api,
    app,
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
        const res = await api.get('/api/v1/students', fx.a.adminToken);
        expect(res.status).toBe(200);
    });

    test('a request without a token is rejected with 401', async () => {
        const res = await api.get('/api/v1/students');
        expect(res.status).toBe(401);
    });
});

describe('students list is tenant-scoped (guards SEC-09 area)', () => {
    test('admin of A sees A students only', async () => {
        const res = await api.get('/api/v1/students', fx.a.adminToken);
        expect(res.status).toBe(200);
        expect(bodyText(res)).toContain(fx.a.student.email);
        expect(bodyText(res)).not.toContain(fx.b.student.email);
    });
});

describe('test publish and delete: correct cases (guards SEC-01 area)', () => {
    test('admin publishes their own institute test without a body instituteId', async () => {
        const res = await api.patch(`/api/v1/tests/${fx.a.test.id}/publish`, fx.a.adminToken).send({});
        expect(res.status).toBe(200);
        const row = await prisma.psychometricTest.findUnique({ where: { id: fx.a.test.id } });
        expect(row?.status).toBe('PUBLISHED');
    });

    test('admin publishing another institute test is refused with 404 (no existence leak)', async () => {
        const res = await api.patch(`/api/v1/tests/${fx.b.test.id}/publish`, fx.a.adminToken).send({});
        expect(res.status).toBe(404);
        const row = await prisma.psychometricTest.findUnique({ where: { id: fx.b.test.id } });
        expect(row?.status).toBe('DRAFT');
    });

    test('a STUDENT cannot publish a test (role check in service)', async () => {
        const res = await api.patch(`/api/v1/tests/${fx.a.test.id}/publish`, fx.a.studentToken).send({});
        expect(res.status).toBe(403);
    });
});

describe('institute endpoints: correct cases (guards SEC-02 area)', () => {
    test('unauthenticated institute list is rejected with 401', async () => {
        const res = await api.get('/api/v1/institutes');
        expect(res.status).toBe(401);
    });

    test('admin can read their own institute', async () => {
        const res = await api.get(`/api/v1/institutes/${fx.a.institute.id}`, fx.a.adminToken);
        expect(res.status).toBe(200);
    });
});

describe('response reads: correct cases (guards SEC-03 area)', () => {
    test('unauthenticated test response read is rejected with 401', async () => {
        const res = await api.get(`/api/v1/responses/test/${fx.a.test.id}`);
        expect(res.status).toBe(401);
    });
});

describe('invite listing: correct cases (guards SEC-05 area)', () => {
    test('admin sees the invites of their own test, and no token is returned (SEC-05)', async () => {
        const res = await api.get(`/api/v1/invites/tests/${fx.a.test.id}/invites`, fx.a.adminToken);
        expect(res.status).toBe(200);
        expect(bodyText(res)).toContain(fx.a.invite.id);
        expect(bodyText(res)).not.toContain(fx.a.invite.token);
    });

    test('admin asking for another institute test invites is denied, and no B token is returned', async () => {
        const res = await api.get(`/api/v1/invites/tests/${fx.b.test.id}/invites`, fx.a.adminToken);
        expect(DENIED_STATUSES).toContain(res.status);
        expect(bodyText(res)).not.toContain(fx.b.invite.token);
    });
});

describe('dimension creation: correct cases (guards SEC-06 area)', () => {
    test('admin can add a dimension to their own institute test', async () => {
        const res = await api
            .post(`/api/v1/dimensions/tests/${fx.a.test.id}/dimensions`, fx.a.adminToken)
            .send({ name: 'Openness', description: 'Trait dimension' });
        expect(res.status).toBe(201);
    });

    test('a STUDENT cannot add a dimension (route role check)', async () => {
        const res = await api
            .post(`/api/v1/dimensions/tests/${fx.a.test.id}/dimensions`, fx.a.studentToken)
            .send({ name: 'Openness', description: 'Trait dimension' });
        expect(res.status).toBe(403);
    });
});

describe('reports: correct cases (guards SEC-10 area)', () => {
    // This guard covers the role check, which runs before the handler. Full SEC-10 coverage,
    // including tenant scoping and inactive records, is in report-security.integration.spec.ts.
    test('a STUDENT cannot read a test report (route role check)', async () => {
        const res = await api.get(`/api/v1/reports/test/${fx.a.test.id}`, fx.a.studentToken);
        expect(res.status).toBe(403);
    });
});

describe('JWT verification on protected endpoints (SEC-07)', () => {
    const PROTECTED = '/api/v1/students';
    const claims = { userId: 'forged-user', role: 'ADMIN', instituteId: 'forged-institute' };

    test('a valid token from the app configuration is accepted (control)', async () => {
        const token = jwt.sign({ ...claims, userId: fx.a.admin.id, instituteId: fx.a.institute.id }, env.JWT_SECRET);
        const res = await request(app).get(PROTECTED).set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
    });

    test('missing Authorization header returns 401', async () => {
        const res = await request(app).get(PROTECTED);
        expect(res.status).toBe(401);
    });

    test('malformed scheme returns 401', async () => {
        const token = jwt.sign(claims, env.JWT_SECRET);
        const res = await request(app).get(PROTECTED).set('Authorization', `Basic ${token}`);
        expect(res.status).toBe(401);
    });

    test('Bearer with a non-JWT value returns 401', async () => {
        const res = await request(app).get(PROTECTED).set('Authorization', 'Bearer not-a-jwt');
        expect(res.status).toBe(401);
    });

    test('expired token returns 401', async () => {
        const expired = jwt.sign({ ...claims, exp: Math.floor(Date.now() / 1000) - 60 }, env.JWT_SECRET);
        const res = await request(app).get(PROTECTED).set('Authorization', `Bearer ${expired}`);
        expect(res.status).toBe(401);
    });

    test('token signed with a different secret returns 401', async () => {
        const wrong = jwt.sign(claims, 'y'.repeat(40));
        const res = await request(app).get(PROTECTED).set('Authorization', `Bearer ${wrong}`);
        expect(res.status).toBe(401);
    });

    test('tampered payload with the original signature returns 401', async () => {
        const token = jwt.sign({ ...claims, userId: fx.a.admin.id, instituteId: fx.a.institute.id }, env.JWT_SECRET);
        const [header, , signature] = token.split('.');
        const tamperedPayload = Buffer.from(JSON.stringify({ ...claims, role: 'SUPER' })).toString('base64url');
        const res = await request(app)
            .get(PROTECTED)
            .set('Authorization', `Bearer ${header}.${tamperedPayload}.${signature}`);
        expect(res.status).toBe(401);
    });
});
