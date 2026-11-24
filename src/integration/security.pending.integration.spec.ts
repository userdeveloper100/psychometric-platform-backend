/**
 * PENDING security regression tests.
 *
 * Each test asserts the SECURE behaviour. Against the current code these tests are
 * expected to FAIL, and each failure is evidence of the audit finding in its title.
 * They are not skipped, and they are not fixed. Do not weaken an assertion to make
 * one pass. Only a real production fix turns one green.
 *
 * Run with: npm run test:integration:pending
 * Mapping to audit IDs: docs/IMPLEMENTATION_AUDIT.md section 8.
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

// SEC-01 (test publish and delete tenant ownership) was promoted out of this file once fixed.
// Its active regression tests live in src/integration/test-security.integration.spec.ts.

// SEC-02 (institute role and tenant authorization) was promoted out of this file once fixed.
// Its active regression tests live in src/integration/institute-security.integration.spec.ts.

describe('[PENDING DB-01, surfaced while fixing SEC-02] admin deletes their own institute', () => {
    // Not a SEC-02 failure. An ADMIN may delete their own institute, but the soft-delete cascade
    // currently fails with a Prisma invocation error (see softDelete.ts modelFieldMap, DB-01).
    // This test stays pending until DB-01 is fixed.
    test('admin of A can soft delete their own institute (200)', async () => {
        const res = await api.delete(`/api/institutes/${fx.a.institute.id}`, fx.a.adminToken);
        expect(res.status).toBe(200);
        const row = await prisma.institute.findUnique({ where: { id: fx.a.institute.id } });
        expect(row?.isActive).toBe(false);
    });
});

// SEC-03 (response tenant isolation) was promoted out of this file once fixed. Its active regression tests
// live in src/integration/response-security.integration.spec.ts.

// SEC-05 (invite token protection and invite role/tenant authorization) was promoted out of this file once fixed.
// Its active regression tests live in src/integration/invite-security.integration.spec.ts.

describe('[PENDING SEC-06] dimension and question writes must enforce tenant authorization', () => {
    test('admin of A cannot add a dimension to institute B test', async () => {
        const before = await prisma.dimension.count({ where: { testId: fx.b.test.id } });
        const res = await api
            .post(`/api/dimensions/tests/${fx.b.test.id}/dimensions`, fx.a.adminToken)
            .send({ name: 'Injected', description: 'cross tenant' });
        expect(DENIED_STATUSES).toContain(res.status);
        expect(await prisma.dimension.count({ where: { testId: fx.b.test.id } })).toBe(before);
    });

    test('admin of A cannot add a question to institute B dimension', async () => {
        const before = await prisma.question.count({ where: { dimensionId: fx.b.dimension.id } });
        const res = await api
            .post(`/api/questions/dimensions/${fx.b.dimension.id}/questions`, fx.a.adminToken)
            .send({ text: 'Injected question', scaleMin: 1, scaleMax: 5 });
        expect(DENIED_STATUSES).toContain(res.status);
        expect(await prisma.question.count({ where: { dimensionId: fx.b.dimension.id } })).toBe(before);
    });

    test('admin of A cannot soft delete an institute B dimension', async () => {
        const res = await api.delete(`/api/dimensions/dimensions/${fx.b.dimension.id}`, fx.a.adminToken);
        expect(DENIED_STATUSES).toContain(res.status);
        const row = await prisma.dimension.findUnique({ where: { id: fx.b.dimension.id } });
        expect(row?.isActive).toBe(true);
    });

    test('admin of A cannot soft delete an institute B question', async () => {
        const res = await api.delete(`/api/questions/questions/${fx.b.question.id}`, fx.a.adminToken);
        expect(DENIED_STATUSES).toContain(res.status);
        const row = await prisma.question.findUnique({ where: { id: fx.b.question.id } });
        expect(row?.isActive).toBe(true);
    });
});

describe('[PENDING SEC-10] reports must be restricted to authorized institute and student access', () => {
    // Caveat: today these report routes return 400 for every request (see the
    // FUNCTIONAL-DEFECT block below), so these tests fail on the status code before
    // any tenant check runs. They prove the required outcome, not the current leak.
    // They become meaningful evidence once the functional defect is fixed.
    test('admin of A cannot read the test report of institute B', async () => {
        const res = await api.get(`/api/reports/reports/test/${fx.b.test.id}`, fx.a.adminToken);
        expect(DENIED_STATUSES).toContain(res.status);
        expect(bodyText(res)).not.toContain(fx.b.student.id);
    });

    test('admin of A cannot read the student report of institute B student', async () => {
        const res = await api.get(
            `/api/reports/reports/student/${fx.b.student.id}/test/${fx.b.test.id}`,
            fx.a.adminToken
        );
        expect(DENIED_STATUSES).toContain(res.status);
    });

    test('the student report route returns one student, not the whole test (same tenant)', async () => {
        const res = await api.get(
            `/api/reports/reports/student/${fx.a.student.id}/test/${fx.a.test.id}`,
            fx.a.adminToken
        );
        expect(res.status).toBe(200);
        expect(res.body.data.studentId).toBe(fx.a.student.id);
    });
});

describe('[PENDING FUNCTIONAL-DEFECT] report routes read the wrong route parameter (not a security finding)', () => {
    // Discovered while building this harness. The route is '/reports/test/:testId', but
    // report.controller.ts reads req.params.id, so every valid request returns 400
    // "Test ID is required". The same controller is used by the student-report route.
    // Recorded here, not fixed, because this task does not change production code.
    test('admin gets the test report for their own institute test', async () => {
        const res = await api.get(`/api/reports/reports/test/${fx.a.test.id}`, fx.a.adminToken);
        expect(res.status).toBe(200);
        expect(res.body.data.testId).toBe(fx.a.test.id);
    });
});

// SEC-07 (JWT configuration) was promoted out of this file once fixed. Its regression
// tests now live in src/middleware/auth.middleware.spec.ts and src/config/env.process.spec.ts,
// and the HTTP-level 401 checks are in src/integration/guards.integration.spec.ts.
