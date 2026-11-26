/**
 * DEC-04 regression tests. Every module is served under /api/v1/<resource>, and the duplicated
 * segments (/responses/responses, /reports/reports, /dimensions/dimensions, /questions/questions) are gone.
 * The old unversioned /api/... paths and the duplicated paths are not served: they return 404 and change nothing.
 */
import { api, prisma, seedTwoTenants, TwoTenantFixture } from '../test-utils/integration/harness';

let fx: TwoTenantFixture;

beforeEach(async () => {
    fx = await seedTwoTenants();
});

afterAll(async () => {
    await prisma.$disconnect();
});

describe('DEC-04: standardized /api/v1 endpoints work for every module', () => {
    test('health is served at the root, outside the API version', async () => {
        const res = await api.get('/health');
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ status: 'ok' });
    });

    test('auth: GET /api/v1/auth/users lists the admin own institute (200)', async () => {
        const res = await api.get('/api/v1/auth/users', fx.a.adminToken);
        expect(res.status).toBe(200);
    });

    test('institutes: GET /api/v1/institutes/:id returns the own institute (200)', async () => {
        const res = await api.get(`/api/v1/institutes/${fx.a.institute.id}`, fx.a.adminToken);
        expect(res.status).toBe(200);
    });

    test('tests: GET /api/v1/tests lists the own tests (200)', async () => {
        const res = await api.get('/api/v1/tests', fx.a.adminToken);
        expect(res.status).toBe(200);
    });

    test('dimensions: GET /api/v1/dimensions/tests/:testId/dimensions (200)', async () => {
        const res = await api.get(`/api/v1/dimensions/tests/${fx.a.test.id}/dimensions`, fx.a.adminToken);
        expect(res.status).toBe(200);
    });

    test('questions: GET /api/v1/questions/dimensions/:dimensionId/questions (200)', async () => {
        const res = await api.get(`/api/v1/questions/dimensions/${fx.a.dimension.id}/questions`, fx.a.adminToken);
        expect(res.status).toBe(200);
    });

    test('students: GET /api/v1/students lists the own students (200)', async () => {
        const res = await api.get('/api/v1/students', fx.a.adminToken);
        expect(res.status).toBe(200);
    });

    test('invites: GET /api/v1/invites/tests/:testId/invites (200)', async () => {
        const res = await api.get(`/api/v1/invites/tests/${fx.a.test.id}/invites`, fx.a.adminToken);
        expect(res.status).toBe(200);
    });

    test('responses: GET /api/v1/responses/test/:testId (200), and the list (200)', async () => {
        expect((await api.get(`/api/v1/responses/test/${fx.a.test.id}`, fx.a.adminToken)).status).toBe(200);
        expect((await api.get('/api/v1/responses', fx.a.adminToken)).status).toBe(200);
    });

    test('responses: POST /api/v1/responses/submit still accepts a student submission (201)', async () => {
        const res = await api.post('/api/v1/responses/submit', fx.a.studentToken).send({
            token: fx.a.invite.token,
            studentId: fx.a.student.id,
            responses: [{ questionId: fx.a.question.id, answer: 4 }],
        });
        expect(res.status).toBe(201);
    });

    test('responses: DELETE /api/v1/responses/:id soft deletes an own response (200)', async () => {
        const res = await api.delete(`/api/v1/responses/${fx.a.response.id}`, fx.a.adminToken);
        expect(res.status).toBe(200);
        expect((await prisma.response.findUnique({ where: { id: fx.a.response.id } }))?.isActive).toBe(false);
    });

    test('reports: GET /api/v1/reports/test/:testId and the student report (200)', async () => {
        expect((await api.get(`/api/v1/reports/test/${fx.a.test.id}`, fx.a.adminToken)).status).toBe(200);
        expect(
            (await api.get(`/api/v1/reports/student/${fx.a.student.id}/test/${fx.a.test.id}`, fx.a.adminToken)).status
        ).toBe(200);
    });

    test('the tenant and role rules still apply on the versioned paths (STUDENT 403, foreign test 404)', async () => {
        expect((await api.get('/api/v1/responses', fx.a.studentToken)).status).toBe(403);
        expect((await api.get(`/api/v1/reports/test/${fx.b.test.id}`, fx.a.adminToken)).status).toBe(404);
    });
});

describe('DEC-04: unversioned and duplicated paths are not served (404) and change nothing', () => {
    test('the old unversioned /api/... paths return 404, even with a valid admin token', async () => {
        for (const path of ['/api/tests', '/api/responses', '/api/students', '/api/invites', '/api/reports', '/api/auth/users']) {
            const res = await api.get(path, fx.a.adminToken);
            expect(res.status).toBe(404);
        }
    });

    test('the unversioned health path /api/health returns 404 (health is served at /health)', async () => {
        expect((await api.get('/api/health')).status).toBe(404);
    });

    test('the duplicated responses path is not served, in either the unversioned or the versioned form', async () => {
        const unversioned = await api
            .post('/api/responses/responses/submit', fx.a.studentToken)
            .send({ token: fx.a.invite.token, studentId: fx.a.student.id, responses: [{ questionId: fx.a.question.id, answer: 4 }] });
        const duplicated = await api
            .post('/api/v1/responses/responses/submit', fx.a.studentToken)
            .send({ token: fx.a.invite.token, studentId: fx.a.student.id, responses: [{ questionId: fx.a.question.id, answer: 4 }] });

        expect(unversioned.status).toBe(404);
        expect(duplicated.status).toBe(404);
        expect((await prisma.testInvite.findUnique({ where: { id: fx.a.invite.id } }))?.status).toBe('PENDING');
    });

    test('the duplicated reports paths return 404', async () => {
        expect((await api.get(`/api/v1/reports/reports/test/${fx.a.test.id}`, fx.a.adminToken)).status).toBe(404);
        expect(
            (await api.get(`/api/v1/reports/reports/student/${fx.a.student.id}/test/${fx.a.test.id}`, fx.a.adminToken)).status
        ).toBe(404);
    });

    test('the duplicated dimensions and questions delete paths return 404 and the rows stay active', async () => {
        const dimension = await api.delete(`/api/v1/dimensions/dimensions/${fx.a.dimension.id}`, fx.a.adminToken);
        const question = await api.delete(`/api/v1/questions/questions/${fx.a.question.id}`, fx.a.adminToken);

        expect(dimension.status).toBe(404);
        expect(question.status).toBe(404);
        expect((await prisma.dimension.findUnique({ where: { id: fx.a.dimension.id } }))?.isActive).toBe(true);
        expect((await prisma.question.findUnique({ where: { id: fx.a.question.id } }))?.isActive).toBe(true);
    });

    test('the duplicated response delete path returns 404 and the response stays active', async () => {
        const res = await api.delete(`/api/v1/responses/responses/${fx.a.response.id}`, fx.a.adminToken);
        expect(res.status).toBe(404);
        expect((await prisma.response.findUnique({ where: { id: fx.a.response.id } }))?.isActive).toBe(true);
    });
});
