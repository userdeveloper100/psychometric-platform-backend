/**
 * SEC-03 regression tests: response reads and deletes are ADMIN-only and confined to the
 * caller's institute. A response is in scope only when both its student and its test belong
 * to that institute.
 *
 * Promoted from security.pending.integration.spec.ts once SEC-03 was fixed.
 * Student submission (POST /responses/submit) is not in scope here and stays on authenticateJWT.
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

const responseRow = (id: string) => prisma.response.findUnique({ where: { id } });
const ids = (res: { body: { data: { id: string }[] } }) => res.body.data.map((row) => row.id);

describe('SEC-03: role authorization (STUDENT is refused with 403)', () => {
    test('a STUDENT cannot list all responses (403)', async () => {
        const res = await api.get('/api/responses', fx.a.studentToken);
        expect(res.status).toBe(403);
    });

    test('a STUDENT cannot read the responses of their own student record (403)', async () => {
        const res = await api.get(`/api/responses/responses/student/${fx.a.student.id}`, fx.a.studentToken);
        expect(res.status).toBe(403);
    });

    test('a STUDENT cannot read another student responses (403)', async () => {
        const res = await api.get(`/api/responses/responses/student/${fx.b.student.id}`, fx.a.studentToken);
        expect(res.status).toBe(403);
    });

    test('a STUDENT cannot read the responses of a test (403)', async () => {
        const res = await api.get(`/api/responses/responses/test/${fx.a.test.id}`, fx.a.studentToken);
        expect(res.status).toBe(403);
    });

    test('a STUDENT cannot delete their own response (403) and it stays active', async () => {
        const res = await api.delete(`/api/responses/responses/${fx.a.response.id}`, fx.a.studentToken);
        expect(res.status).toBe(403);
        expect((await responseRow(fx.a.response.id))?.isActive).toBe(true);
    });
});

describe('SEC-03: tenant boundary (ADMIN of A is confined to institute A)', () => {
    test('admin of A lists only institute A responses', async () => {
        const res = await api.get('/api/responses', fx.a.adminToken);
        expect(res.status).toBe(200);
        expect(ids(res)).toEqual([fx.a.response.id]);
        expect(res.body.meta.pagination.total).toBe(1);
        expect(bodyText(res)).not.toContain(fx.b.response.id);
    });

    test('admin of A reads the responses of an own student (200)', async () => {
        const res = await api.get(`/api/responses/responses/student/${fx.a.student.id}`, fx.a.adminToken);
        expect(res.status).toBe(200);
        expect(ids(res)).toEqual([fx.a.response.id]);
    });

    test('admin of A reading a student of institute B gets 404, and B responses are not returned', async () => {
        const res = await api.get(`/api/responses/responses/student/${fx.b.student.id}`, fx.a.adminToken);
        expect(res.status).toBe(404);
        expect(bodyText(res)).not.toContain(fx.b.response.id);
    });

    test('admin of A reads the responses of an own test (200)', async () => {
        const res = await api.get(`/api/responses/responses/test/${fx.a.test.id}`, fx.a.adminToken);
        expect(res.status).toBe(200);
        expect(ids(res)).toEqual([fx.a.response.id]);
    });

    test('admin of A cannot read the responses of institute B test (404), and no B data is returned', async () => {
        const res = await api.get(`/api/responses/responses/test/${fx.b.test.id}`, fx.a.adminToken);
        expect(DENIED_STATUSES).toContain(res.status);
        expect(res.status).toBe(404);
        expect(bodyText(res)).not.toContain(fx.b.response.id);
        expect(bodyText(res)).not.toContain(fx.b.question.text);
    });

    test('admin of A cannot delete a response that belongs to institute B (404) and B is unchanged', async () => {
        const res = await api.delete(`/api/responses/responses/${fx.b.response.id}`, fx.a.adminToken);
        expect(res.status).toBe(404);
        expect((await responseRow(fx.b.response.id))?.isActive).toBe(true);
    });

    test('admin of A can delete an own response (200) and it is soft deleted', async () => {
        const res = await api.delete(`/api/responses/responses/${fx.a.response.id}`, fx.a.adminToken);
        expect(res.status).toBe(200);
        expect((await responseRow(fx.a.response.id))?.isActive).toBe(false);
    });

    test('a foreign response and a non-existent response get the same response (no existence leak)', async () => {
        const foreign = await api.delete(`/api/responses/responses/${fx.b.response.id}`, fx.a.adminToken);
        const missing = await api.delete(`/api/responses/responses/${randomUUID()}`, fx.a.adminToken);
        expect(foreign.status).toBe(missing.status);
        expect(foreign.body.message).toBe(missing.body.message);
    });
});

describe('SEC-03: spoofed instituteId cannot override req.user.instituteId', () => {
    test('a query instituteId on the list does not widen the scope beyond institute A', async () => {
        const res = await api.get(`/api/responses?instituteId=${fx.b.institute.id}`, fx.a.adminToken);
        expect(res.status).toBe(200);
        expect(ids(res)).toEqual([fx.a.response.id]);
    });

    test('a query instituteId on a read of institute B test does not grant access (404)', async () => {
        const res = await api
            .get(`/api/responses/responses/test/${fx.b.test.id}`, fx.a.adminToken)
            .query({ instituteId: fx.a.institute.id });
        expect(res.status).toBe(404);
    });

    test('a body instituteId on a delete of a B response does not grant access (404)', async () => {
        const res = await api
            .delete(`/api/responses/responses/${fx.b.response.id}`, fx.a.adminToken)
            .send({ instituteId: fx.b.institute.id });
        expect(res.status).toBe(404);
        expect((await responseRow(fx.b.response.id))?.isActive).toBe(true);
    });
});

describe('SEC-03: a token without an institute fails closed', () => {
    // Built inside each test, because the fixture is only seeded in beforeEach.
    const noInstituteToken = () => generateToken({ userId: fx.a.admin.id, role: 'ADMIN', instituteId: '' });

    test('list is refused with 403 and no response is returned', async () => {
        const res = await api.get('/api/responses', noInstituteToken());
        expect(res.status).toBe(403);
        expect(bodyText(res)).not.toContain(fx.a.response.id);
        expect(bodyText(res)).not.toContain(fx.b.response.id);
    });

    test('student, test and delete lookups are refused and B data is not touched', async () => {
        const student = await api.get(`/api/responses/responses/student/${fx.b.student.id}`, noInstituteToken());
        const test = await api.get(`/api/responses/responses/test/${fx.b.test.id}`, noInstituteToken());
        const remove = await api.delete(`/api/responses/responses/${fx.b.response.id}`, noInstituteToken());
        expect(DENIED_STATUSES).toContain(student.status);
        expect(DENIED_STATUSES).toContain(test.status);
        expect(DENIED_STATUSES).toContain(remove.status);
        expect((await responseRow(fx.b.response.id))?.isActive).toBe(true);
    });
});

describe('SEC-03: unauthenticated requests are refused with 401', () => {
    test('list, student, test and delete without a token all return 401 and nothing is deleted', async () => {
        const responses = [
            await api.get('/api/responses'),
            await api.get(`/api/responses/responses/student/${fx.a.student.id}`),
            await api.get(`/api/responses/responses/test/${fx.a.test.id}`),
            await api.delete(`/api/responses/responses/${fx.a.response.id}`),
        ];
        for (const res of responses) {
            expect(res.status).toBe(401);
        }
        expect((await responseRow(fx.a.response.id))?.isActive).toBe(true);
    });
});

describe('SEC-03: student submission flow is not broken', () => {
    test('a STUDENT can still submit responses for their own invite (201)', async () => {
        const res = await api.post('/api/responses/responses/submit', fx.a.studentToken).send({
            token: fx.a.invite.token,
            studentId: fx.a.student.id,
            responses: [{ questionId: fx.a.question.id, answer: 4 }],
        });
        expect(res.status).toBe(201);
    });
});
