/**
 * SEC-10 regression tests: report routes read the parameter the route defines, are ADMIN-only,
 * and report only on active records of the caller's institute.
 *
 * Promoted from security.pending.integration.spec.ts (SEC-10 and the report-parameter functional defect)
 * once fixed. Student self-service reports are not offered: DEC-03 (student identity) is still open,
 * so there is no safe way to tie a STUDENT token to a student record. Every report route is ADMIN-only.
 */
import { randomUUID } from 'crypto';
import { api, bodyText, prisma, seedTwoTenants, TwoTenantFixture } from '../test-utils/integration/harness';
import { generateToken } from '../utils/jwt';

let fx: TwoTenantFixture;

beforeEach(async () => {
    fx = await seedTwoTenants();
});

afterAll(async () => {
    await prisma.$disconnect();
});

const testReport = (testId: string, token?: string) => api.get(`/api/reports/reports/test/${testId}`, token);
const studentReport = (studentId: string, testId: string, token?: string) =>
    api.get(`/api/reports/reports/student/${studentId}/test/${testId}`, token);
const studentIds = (res: { body: { data: { students: { studentId: string }[] } } }) =>
    res.body.data.students.map((s) => s.studentId);

describe('SEC-10: role authorization (STUDENT is refused with 403, no token is refused with 401)', () => {
    test('a STUDENT cannot list reports, read a test report or read a student report (403)', async () => {
        const responses = [
            await api.get('/api/reports', fx.a.studentToken),
            await testReport(fx.a.test.id, fx.a.studentToken),
            await studentReport(fx.a.student.id, fx.a.test.id, fx.a.studentToken),
        ];
        for (const res of responses) {
            expect(res.status).toBe(403);
        }
    });

    test('no token gets 401 on the list, the test report and the student report', async () => {
        const responses = [
            await api.get('/api/reports'),
            await testReport(fx.a.test.id),
            await studentReport(fx.a.student.id, fx.a.test.id),
        ];
        for (const res of responses) {
            expect(res.status).toBe(401);
        }
    });
});

describe('SEC-10: functional fix (the handler reads the route parameter)', () => {
    test('admin gets the test report for their own institute test (200)', async () => {
        const res = await testReport(fx.a.test.id, fx.a.adminToken);
        expect(res.status).toBe(200);
        expect(res.body.data.testId).toBe(fx.a.test.id);
    });

    test('the student report route returns one student, not the whole test (200)', async () => {
        const res = await studentReport(fx.a.student.id, fx.a.test.id, fx.a.adminToken);
        expect(res.status).toBe(200);
        expect(res.body.data.studentId).toBe(fx.a.student.id);
        expect(res.body.data.testId).toBe(fx.a.test.id);
        expect(res.body.data).not.toHaveProperty('students');
    });
});

describe('SEC-10: accurate, scoped report data for own institute', () => {
    test('the test report includes the own student and the score from active responses', async () => {
        const res = await testReport(fx.a.test.id, fx.a.adminToken);
        expect(studentIds(res)).toEqual([fx.a.student.id]);
        expect(res.body.data.students[0].dimensions).toEqual([
            { dimensionId: fx.a.dimension.id, dimensionName: fx.a.dimension.name, score: 3 },
        ]);
    });

    test('the student report scores the same student (answer 3 gives score 3)', async () => {
        const res = await studentReport(fx.a.student.id, fx.a.test.id, fx.a.adminToken);
        expect(res.body.data.dimensions[0].score).toBe(3);
    });

    test('the list of reports contains only institute A tests', async () => {
        const res = await api.get('/api/reports', fx.a.adminToken);
        expect(res.status).toBe(200);
        expect(res.body.data.map((row: { id: string }) => row.id)).toEqual([fx.a.test.id]);
        expect(bodyText(res)).not.toContain(fx.b.test.id);
    });
});

describe('SEC-10: admin of A cannot read institute B reports (404, same as missing)', () => {
    test('the test report of a B test is 404 and no B student is returned', async () => {
        const res = await testReport(fx.b.test.id, fx.a.adminToken);
        expect(res.status).toBe(404);
        expect(bodyText(res)).not.toContain(fx.b.student.id);
    });

    test('the student report of a B student is 404 and no B data is returned', async () => {
        const res = await studentReport(fx.b.student.id, fx.b.test.id, fx.a.adminToken);
        expect(res.status).toBe(404);
        expect(bodyText(res)).not.toContain(fx.b.test.id);
    });

    test('an own student with a B test is 404', async () => {
        const res = await studentReport(fx.a.student.id, fx.b.test.id, fx.a.adminToken);
        expect(res.status).toBe(404);
    });

    test('a B student with an own test is 404', async () => {
        const res = await studentReport(fx.b.student.id, fx.a.test.id, fx.a.adminToken);
        expect(res.status).toBe(404);
    });

    test('a foreign test and a non-existent test get the same response (no existence leak)', async () => {
        const foreign = await testReport(fx.b.test.id, fx.a.adminToken);
        const missing = await testReport(randomUUID(), fx.a.adminToken);
        expect(foreign.status).toBe(missing.status);
        expect(foreign.body.message).toBe(missing.body.message);
    });
});

describe('SEC-10: inactive records never leak into reports', () => {
    test('an inactive student gets 404 on the student report and is left out of the test report', async () => {
        await prisma.student.update({ where: { id: fx.a.student.id }, data: { isActive: false } });

        const single = await studentReport(fx.a.student.id, fx.a.test.id, fx.a.adminToken);
        expect(single.status).toBe(404);

        const test = await testReport(fx.a.test.id, fx.a.adminToken);
        expect(test.status).toBe(200);
        expect(studentIds(test)).toEqual([]);
    });

    test('an inactive test gets 404 on both reports and is left out of the list', async () => {
        await prisma.psychometricTest.update({ where: { id: fx.a.test.id }, data: { isActive: false } });

        expect((await testReport(fx.a.test.id, fx.a.adminToken)).status).toBe(404);
        expect((await studentReport(fx.a.student.id, fx.a.test.id, fx.a.adminToken)).status).toBe(404);

        const list = await api.get('/api/reports', fx.a.adminToken);
        expect(list.body.data).toEqual([]);
    });

    test('a soft-deleted response does not count toward the score', async () => {
        await prisma.response.update({ where: { id: fx.a.response.id }, data: { isActive: false } });
        const res = await studentReport(fx.a.student.id, fx.a.test.id, fx.a.adminToken);
        expect(res.status).toBe(200);
        expect(res.body.data.dimensions[0].score).toBe(0);
    });

    test('an inactive question does not count toward the score', async () => {
        await prisma.question.update({ where: { id: fx.a.question.id }, data: { isActive: false } });
        const res = await studentReport(fx.a.student.id, fx.a.test.id, fx.a.adminToken);
        expect(res.body.data.dimensions[0].score).toBe(0);
    });

    test('an inactive dimension is left out of the report', async () => {
        await prisma.dimension.update({ where: { id: fx.a.dimension.id }, data: { isActive: false } });
        const res = await studentReport(fx.a.student.id, fx.a.test.id, fx.a.adminToken);
        expect(res.body.data.dimensions).toEqual([]);
    });
});

describe('SEC-10: spoofed instituteId cannot override req.user.instituteId', () => {
    test('a query instituteId on a B test report does not grant access (404)', async () => {
        const res = await api
            .get(`/api/reports/reports/test/${fx.b.test.id}?instituteId=${fx.a.institute.id}`, fx.a.adminToken);
        expect(res.status).toBe(404);
    });

    test('a body instituteId on a B student report does not grant access (404)', async () => {
        const res = await api
            .get(`/api/reports/reports/student/${fx.b.student.id}/test/${fx.b.test.id}`, fx.a.adminToken)
            .send({ instituteId: fx.a.institute.id });
        expect(res.status).toBe(404);
    });

    test('a query instituteId on the list does not widen the scope beyond institute A', async () => {
        const res = await api.get(`/api/reports?instituteId=${fx.b.institute.id}`, fx.a.adminToken);
        expect(res.body.data.map((row: { id: string }) => row.id)).toEqual([fx.a.test.id]);
    });
});

describe('SEC-10: a token without an institute fails closed', () => {
    // Built inside each test, because the fixture is only seeded in beforeEach.
    const noInstituteToken = () => generateToken({ userId: fx.a.admin.id, role: 'ADMIN', instituteId: '' });

    test('the list, the test report and the student report are refused with 403', async () => {
        const list = await api.get('/api/reports', noInstituteToken());
        const test = await testReport(fx.b.test.id, noInstituteToken());
        const student = await studentReport(fx.b.student.id, fx.b.test.id, noInstituteToken());
        expect(list.status).toBe(403);
        expect(test.status).toBe(403);
        expect(student.status).toBe(403);
        expect(bodyText(test)).not.toContain(fx.b.student.id);
    });
});
