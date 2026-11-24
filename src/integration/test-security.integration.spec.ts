/**
 * SEC-01 regression tests: a test can only be published or deleted by an ADMIN of the
 * institute that owns it. The institute is derived from the JWT, never from the payload.
 *
 * Promoted from security.pending.integration.spec.ts once SEC-01 was fixed.
 */
import { randomUUID } from 'crypto';
import { api, prisma, seedTwoTenants, TwoTenantFixture } from '../test-utils/integration/harness';

let fx: TwoTenantFixture;

beforeEach(async () => {
    fx = await seedTwoTenants();
});

afterAll(async () => {
    await prisma.$disconnect();
});

const testRow = (id: string) => prisma.psychometricTest.findUnique({ where: { id } });

describe('SEC-01: publish is scoped to the requesting institute', () => {
    test('admin publishes their own institute test (200)', async () => {
        const res = await api.patch(`/api/tests/${fx.a.test.id}/publish`, fx.a.adminToken).send({});
        expect(res.status).toBe(200);
        expect((await testRow(fx.a.test.id))?.status).toBe('PUBLISHED');
    });

    test('admin of A cannot publish B test when sending B instituteId in the body (404)', async () => {
        const res = await api
            .patch(`/api/tests/${fx.b.test.id}/publish`, fx.a.adminToken)
            .send({ instituteId: fx.b.institute.id });
        expect(res.status).toBe(404);
        expect((await testRow(fx.b.test.id))?.status).toBe('DRAFT');
    });

    test('admin of A cannot publish B test without a body instituteId (404)', async () => {
        const res = await api.patch(`/api/tests/${fx.b.test.id}/publish`, fx.a.adminToken).send({});
        expect(res.status).toBe(404);
        expect((await testRow(fx.b.test.id))?.status).toBe('DRAFT');
    });

    test('a spoofed body instituteId on own test does not change ownership or publish another institute test', async () => {
        const res = await api
            .patch(`/api/tests/${fx.a.test.id}/publish`, fx.a.adminToken)
            .send({ instituteId: fx.b.institute.id });
        expect(res.status).toBe(200);
        const row = await testRow(fx.a.test.id);
        expect(row?.status).toBe('PUBLISHED');
        expect(row?.instituteId).toBe(fx.a.institute.id);
        expect((await testRow(fx.b.test.id))?.status).toBe('DRAFT');
    });

    test('a foreign test and a non-existent test get the same response (no existence leak)', async () => {
        const foreign = await api.patch(`/api/tests/${fx.b.test.id}/publish`, fx.a.adminToken).send({});
        const missing = await api.patch(`/api/tests/${randomUUID()}/publish`, fx.a.adminToken).send({});
        expect(foreign.status).toBe(missing.status);
        expect(foreign.body.message).toBe(missing.body.message);
    });

    test('a STUDENT cannot publish a test (403) and it stays DRAFT', async () => {
        const res = await api.patch(`/api/tests/${fx.a.test.id}/publish`, fx.a.studentToken).send({});
        expect(res.status).toBe(403);
        expect((await testRow(fx.a.test.id))?.status).toBe('DRAFT');
    });

    test('an unauthenticated request cannot publish (401)', async () => {
        const res = await api.patch(`/api/tests/${fx.a.test.id}/publish`).send({});
        expect(res.status).toBe(401);
        expect((await testRow(fx.a.test.id))?.status).toBe('DRAFT');
    });
});

describe('SEC-01: delete is scoped to the requesting institute', () => {
    test('admin deletes their own institute test (200) and it becomes inactive', async () => {
        const res = await api.delete(`/api/tests/${fx.a.test.id}`, fx.a.adminToken);
        expect(res.status).toBe(200);
        expect((await testRow(fx.a.test.id))?.isActive).toBe(false);
    });

    test('admin of A cannot delete B test when sending B instituteId in the body (404)', async () => {
        const res = await api
            .delete(`/api/tests/${fx.b.test.id}`, fx.a.adminToken)
            .send({ instituteId: fx.b.institute.id });
        expect(res.status).toBe(404);
        expect((await testRow(fx.b.test.id))?.isActive).toBe(true);
    });

    test('admin of A cannot delete B test without a body instituteId (404)', async () => {
        const res = await api.delete(`/api/tests/${fx.b.test.id}`, fx.a.adminToken);
        expect(res.status).toBe(404);
        expect((await testRow(fx.b.test.id))?.isActive).toBe(true);
    });

    test('a spoofed body instituteId on own delete removes only the own test, and B is untouched', async () => {
        const res = await api
            .delete(`/api/tests/${fx.a.test.id}`, fx.a.adminToken)
            .send({ instituteId: fx.b.institute.id });
        expect(res.status).toBe(200);
        expect((await testRow(fx.a.test.id))?.isActive).toBe(false);
        expect((await testRow(fx.b.test.id))?.isActive).toBe(true);
    });

    test('a foreign test and a non-existent test get the same response (no existence leak)', async () => {
        const foreign = await api.delete(`/api/tests/${fx.b.test.id}`, fx.a.adminToken);
        const missing = await api.delete(`/api/tests/${randomUUID()}`, fx.a.adminToken);
        expect(foreign.status).toBe(missing.status);
        expect(foreign.body.message).toBe(missing.body.message);
    });

    test('a STUDENT cannot delete a test (403) and it stays active', async () => {
        const res = await api.delete(`/api/tests/${fx.a.test.id}`, fx.a.studentToken);
        expect(res.status).toBe(403);
        expect((await testRow(fx.a.test.id))?.isActive).toBe(true);
    });

    test('an unauthenticated request cannot delete (401)', async () => {
        const res = await api.delete(`/api/tests/${fx.a.test.id}`);
        expect(res.status).toBe(401);
        expect((await testRow(fx.a.test.id))?.isActive).toBe(true);
    });
});
