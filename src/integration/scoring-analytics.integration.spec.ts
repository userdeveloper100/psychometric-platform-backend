/**
 * Scoring and analytics regression suite, end to end against the test database.
 *   - Percentile rank, band and cohort statistics for Institute A, computed from its completed candidates only.
 *   - Institute B's candidates, including extreme scores, never move A's percentiles or cohort statistics.
 *   - The CSV export returns the report for staff of the institute, is 403 for a STUDENT, and is 404 for a foreign
 *     or inactive test. Formula-like names are neutralised.
 */

import { randomUUID } from 'crypto';
import { api, bodyText, prisma, seedTwoTenants, tokenFor, TwoTenantFixture } from '../test-utils/integration/harness';

let fx: TwoTenantFixture;
let recruiterA: string;
let evaluatorA: string;

/** A staff user of an institute, with the token the app signs for it. */
const staffToken = async (role: 'RECRUITER' | 'EVALUATOR', instituteId: string, label: string) => {
    const user = await prisma.user.create({
        data: { email: `${label}@integration.test`, password: 'integration-fixture-not-a-login', role, instituteId },
    });
    return tokenFor(user);
};

/**
 * Adds a candidate to a test with one answer on the test's question (scale 1..5) and an invite of the given status.
 * Returns the student id.
 */
const addCandidate = async (
    institute: { id: string },
    test: { id: string },
    question: { id: string },
    name: string,
    answer: number,
    status: 'PENDING' | 'COMPLETED'
) => {
    const student = await prisma.student.create({
        data: { name, email: `${randomUUID()}@integration.test`, instituteId: institute.id },
    });
    await prisma.testInvite.create({
        data: { testId: test.id, studentId: student.id, token: `scoring-${randomUUID()}`, status },
    });
    await prisma.response.create({ data: { questionId: question.id, studentId: student.id, answer } });
    return student.id;
};

beforeEach(async () => {
    fx = await seedTwoTenants();
    recruiterA = await staffToken('RECRUITER', fx.a.institute.id, 'scoring-recruiter-a');
    evaluatorA = await staffToken('EVALUATOR', fx.a.institute.id, 'scoring-evaluator-a');

    // Institute A: the fixture candidate scores 3 (50 on the 1..5 scale) and completes the test.
    await prisma.testInvite.update({ where: { id: fx.a.invite.id }, data: { status: 'COMPLETED' } });
    await addCandidate(fx.a.institute, fx.a.test, fx.a.question, 'Ann Five', 5, 'COMPLETED'); // 100
    await addCandidate(fx.a.institute, fx.a.test, fx.a.question, 'Ben One', 1, 'COMPLETED'); // 0
    await addCandidate(fx.a.institute, fx.a.test, fx.a.question, 'Pending Pat', 5, 'PENDING'); // not in the cohort

    // Institute B: extreme completed candidates. None of them may reach A's numbers.
    await prisma.testInvite.update({ where: { id: fx.b.invite.id }, data: { status: 'COMPLETED' } });
    await addCandidate(fx.b.institute, fx.b.test, fx.b.question, 'B Top', 5, 'COMPLETED');
    await addCandidate(fx.b.institute, fx.b.test, fx.b.question, 'B Bottom', 1, 'COMPLETED');
});

afterAll(async () => {
    await prisma.$disconnect();
});

describe('cohort and percentile for Institute A (completed candidates only)', () => {
    test('the test report has the institute A cohort statistics, unchanged by Institute B', async () => {
        const res = await api.get(`/api/v1/reports/test/${fx.a.test.id}`, fx.a.adminToken);

        expect(res.status).toBe(200);
        // A's completed composites: 50 (fixture), 100, 0. Mean 50, median 50, population sd 40.82.
        expect(res.body.data.cohort).toEqual({
            invitedCount: 4,
            completedCount: 3,
            compositeStatistics: { count: 3, mean: 50, median: 50, stdDev: 40.82, min: 0, max: 100 },
            dimensionAverages: [
                expect.objectContaining({ dimensionId: fx.a.dimension.id, averageNormalizedScore: 50 }),
            ],
        });
    });

    test('each completed candidate has its midrank percentile and band; the pending candidate has none', async () => {
        const res = await api.get(`/api/v1/reports/test/${fx.a.test.id}`, fx.a.adminToken);
        const byName = Object.fromEntries(res.body.data.students.map((s: { studentName: string }) => [s.studentName, s]));

        // (below + 0.5 * equal) / 3: Ann 100 -> 83.33 HIGH; the fixture candidate 50 -> 50 AVERAGE; Ben 0 -> 16.67 LOW.
        expect(byName['Ann Five']).toEqual(expect.objectContaining({ compositeScore: 100, percentileRank: 83.33, performanceBand: 'HIGH' }));
        expect(byName['Ben One']).toEqual(expect.objectContaining({ compositeScore: 0, percentileRank: 16.67, performanceBand: 'LOW' }));
        expect(byName['Pending Pat']).toEqual(expect.objectContaining({ status: 'PENDING', percentileRank: null, performanceBand: null }));
        expect(res.body.data.students.find((s: { studentId: string }) => s.studentId === fx.a.student.id)).toEqual(
            expect.objectContaining({ compositeScore: 50, percentileRank: 50, performanceBand: 'AVERAGE' })
        );
    });

    test('the student report ranks the candidate against the same institute A cohort', async () => {
        const res = await api.get(`/api/v1/reports/student/${fx.a.student.id}/test/${fx.a.test.id}`, fx.a.adminToken);

        expect(res.status).toBe(200);
        expect(res.body.data).toEqual(
            expect.objectContaining({ status: 'COMPLETED', compositeScore: 50, percentileRank: 50, performanceBand: 'AVERAGE' })
        );
        expect(res.body.data.dimensions[0]).toEqual(
            expect.objectContaining({ dimensionId: fx.a.dimension.id, score: 3, normalizedScore: 50 })
        );
    });

    test('Institute B\'s extreme candidates never appear in A\'s report, and B\'s own report sees only B', async () => {
        const aRes = await api.get(`/api/v1/reports/test/${fx.a.test.id}`, fx.a.adminToken);
        expect(aRes.body.data.cohort.completedCount).toBe(3);
        expect(bodyText(aRes)).not.toContain('B Top');
        expect(bodyText(aRes)).not.toContain('B Bottom');

        const bRes = await api.get(`/api/v1/reports/test/${fx.b.test.id}`, fx.b.adminToken);
        expect(bRes.body.data.cohort.completedCount).toBe(3);
        expect(bodyText(bRes)).not.toContain('Ann Five');
    });
});

describe('CSV export (DEC scoring engine)', () => {
    test('ADMIN, RECRUITER and EVALUATOR of Institute A get a valid CSV of their own test', async () => {
        for (const token of [fx.a.adminToken, recruiterA, evaluatorA]) {
            const res = await api.get(`/api/v1/reports/test/${fx.a.test.id}/export?format=csv`, token);

            expect(res.status).toBe(200);
            expect(res.headers['content-type']).toMatch(/^text\/csv/);
            expect(res.headers['content-disposition']).toBe(`attachment; filename="test-report-${fx.a.test.id}.csv"`);

            const lines = res.text.trimEnd().split('\r\n');
            expect(lines[0]).toBe(
                'studentId,studentName,status,compositeScore,percentileRank,performanceBand,' + `${fx.a.dimension.name} (normalized)`
            );
            // Header plus four invited candidates.
            expect(lines).toHaveLength(5);
            expect(res.text).toContain('Ann Five,COMPLETED,100,83.33,HIGH,100');
            expect(res.text).not.toContain('B Top');
        }
    });

    test('a formula-like candidate name is neutralised in the export', async () => {
        await prisma.student.create({
            data: { name: '=cmd|"/c calc"!A0', email: `${randomUUID()}@integration.test`, instituteId: fx.a.institute.id },
        }).then(async (student) => {
            await prisma.testInvite.create({ data: { testId: fx.a.test.id, studentId: student.id, token: `scoring-${randomUUID()}` } });
        });

        const res = await api.get(`/api/v1/reports/test/${fx.a.test.id}/export?format=csv`, fx.a.adminToken);

        expect(res.status).toBe(200);
        expect(res.text).toContain(`"'=cmd|""/c calc""!A0"`);
        expect(res.text).not.toMatch(/(^|\r\n|,)=cmd/);
    });

    test('a STUDENT gets 403, and an unauthenticated request gets 401', async () => {
        expect((await api.get(`/api/v1/reports/test/${fx.a.test.id}/export?format=csv`, fx.a.studentToken)).status).toBe(403);
        expect((await api.get(`/api/v1/reports/test/${fx.a.test.id}/export?format=csv`)).status).toBe(401);
    });

    test('Institute B\'s admin gets 404 for Institute A\'s test, with no CSV and no A names', async () => {
        const res = await api.get(`/api/v1/reports/test/${fx.a.test.id}/export?format=csv`, fx.b.adminToken);

        expect(res.status).toBe(404);
        expect(res.text ?? '').not.toContain('Ann Five');
        expect(res.headers['content-type']).not.toMatch(/^text\/csv/);
    });

    test('an inactive test is 404 for the export', async () => {
        await prisma.psychometricTest.update({ where: { id: fx.a.test.id }, data: { isActive: false } });

        expect((await api.get(`/api/v1/reports/test/${fx.a.test.id}/export?format=csv`, fx.a.adminToken)).status).toBe(404);
    });

    test('a request without format=csv is 400', async () => {
        expect((await api.get(`/api/v1/reports/test/${fx.a.test.id}/export`, fx.a.adminToken)).status).toBe(400);
        expect((await api.get(`/api/v1/reports/test/${fx.a.test.id}/export?format=json`, fx.a.adminToken)).status).toBe(400);
    });

    test('the export is logged as a sensitive admin action, with ids and no names', async () => {
        const logger = (await import('../config/logger')).default;
        const warn = jest.spyOn(logger, 'warn');

        await api.get(`/api/v1/reports/test/${fx.a.test.id}/export?format=csv`, fx.a.adminToken);

        const entries = warn.mock.calls.filter(([m]) => m === 'security_event').map(([, e]) => e);
        expect(entries).toContainEqual(
            expect.objectContaining({ event: 'sensitive_admin_action', action: 'export_test_report', resourceId: fx.a.test.id })
        );
        expect(JSON.stringify(warn.mock.calls)).not.toContain('Ann Five');
    });
});
