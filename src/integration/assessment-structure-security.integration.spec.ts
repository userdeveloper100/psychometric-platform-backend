/**
 * SEC-06 regression tests: dimensions and questions are written and deleted only through an
 * ADMIN of the owning institute, and the whole parent chain (question -> dimension -> test -> institute)
 * must belong to the caller.
 *
 * Read policy (documented in docs/INTEGRATION_TESTING.md): any authenticated user may read the
 * dimensions and questions of their own institute. A STUDENT cannot read another institute's structure.
 *
 * Promoted from security.pending.integration.spec.ts once SEC-06 was fixed.
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

const dimensionRow = (id: string) => prisma.dimension.findUnique({ where: { id } });
const questionRow = (id: string) => prisma.question.findUnique({ where: { id } });
const ids = (res: { body: { data: { id: string }[] } }) => res.body.data.map((row) => row.id);

const createDimensionPath = (testId: string) => `/api/dimensions/tests/${testId}/dimensions`;
const deleteDimensionPath = (id: string) => `/api/dimensions/dimensions/${id}`;
const createQuestionPath = (dimensionId: string) => `/api/questions/dimensions/${dimensionId}/questions`;
const deleteQuestionPath = (id: string) => `/api/questions/questions/${id}`;

describe('SEC-06: role authorization (STUDENT is refused with 403 on writes)', () => {
    test('a STUDENT cannot create a dimension (403) and none is created', async () => {
        const before = await prisma.dimension.count();
        const res = await api
            .post(createDimensionPath(fx.a.test.id), fx.a.studentToken)
            .send({ name: 'Rogue', description: 'x' });
        expect(res.status).toBe(403);
        expect(await prisma.dimension.count()).toBe(before);
    });

    test('a STUDENT cannot delete a dimension (403) and it stays active', async () => {
        const res = await api.delete(deleteDimensionPath(fx.a.dimension.id), fx.a.studentToken);
        expect(res.status).toBe(403);
        expect((await dimensionRow(fx.a.dimension.id))?.isActive).toBe(true);
    });

    test('a STUDENT cannot create a question (403) and none is created', async () => {
        const before = await prisma.question.count();
        const res = await api
            .post(createQuestionPath(fx.a.dimension.id), fx.a.studentToken)
            .send({ text: 'Rogue?', scaleMin: 1, scaleMax: 5 });
        expect(res.status).toBe(403);
        expect(await prisma.question.count()).toBe(before);
    });

    test('a STUDENT cannot delete a question (403) and it stays active', async () => {
        const res = await api.delete(deleteQuestionPath(fx.a.question.id), fx.a.studentToken);
        expect(res.status).toBe(403);
        expect((await questionRow(fx.a.question.id))?.isActive).toBe(true);
    });
});

describe('SEC-06: unauthenticated requests are refused with 401', () => {
    test('every dimension and question route without a token returns 401 and nothing changes', async () => {
        const responses = [
            await api.post(createDimensionPath(fx.a.test.id)).send({ name: 'x', description: 'x' }),
            await api.get(createDimensionPath(fx.a.test.id)),
            await api.get('/api/dimensions'),
            await api.delete(deleteDimensionPath(fx.a.dimension.id)),
            await api.post(createQuestionPath(fx.a.dimension.id)).send({ text: 'x', scaleMin: 1, scaleMax: 5 }),
            await api.get(createQuestionPath(fx.a.dimension.id)),
            await api.get('/api/questions'),
            await api.delete(deleteQuestionPath(fx.a.question.id)),
        ];
        for (const res of responses) {
            expect(res.status).toBe(401);
        }
        expect((await dimensionRow(fx.a.dimension.id))?.isActive).toBe(true);
        expect((await questionRow(fx.a.question.id))?.isActive).toBe(true);
    });
});

describe('SEC-06: admin of A manages institute A structure (own chain succeeds)', () => {
    test('admin of A creates a dimension in own test (201)', async () => {
        const res = await api
            .post(createDimensionPath(fx.a.test.id), fx.a.adminToken)
            .send({ name: 'Openness', description: 'Trait' });
        expect(res.status).toBe(201);
        expect(await prisma.dimension.findFirst({ where: { testId: fx.a.test.id, name: 'Openness' } })).not.toBeNull();
    });

    test('admin of A creates a question in own dimension (201)', async () => {
        const res = await api
            .post(createQuestionPath(fx.a.dimension.id), fx.a.adminToken)
            .send({ text: 'I enjoy new ideas', scaleMin: 1, scaleMax: 5 });
        expect(res.status).toBe(201);
        expect(await prisma.question.findFirst({ where: { dimensionId: fx.a.dimension.id, text: 'I enjoy new ideas' } })).not.toBeNull();
    });

    test('admin of A deletes an own question (200) and it is soft deleted', async () => {
        const res = await api.delete(deleteQuestionPath(fx.a.question.id), fx.a.adminToken);
        expect(res.status).toBe(200);
        expect((await questionRow(fx.a.question.id))?.isActive).toBe(false);
    });

    test('admin of A deletes an own dimension (200) and it is soft deleted', async () => {
        const res = await api.delete(deleteDimensionPath(fx.a.dimension.id), fx.a.adminToken);
        expect(res.status).toBe(200);
        expect((await dimensionRow(fx.a.dimension.id))?.isActive).toBe(false);
    });
});

describe('SEC-06: admin of A cannot touch institute B structure (404, B untouched)', () => {
    test('create a dimension in a B test returns 404 and no dimension is added', async () => {
        const before = await prisma.dimension.count({ where: { testId: fx.b.test.id } });
        const res = await api
            .post(createDimensionPath(fx.b.test.id), fx.a.adminToken)
            .send({ name: 'Injected', description: 'cross tenant' });
        expect(res.status).toBe(404);
        expect(await prisma.dimension.count({ where: { testId: fx.b.test.id } })).toBe(before);
    });

    test('list the dimensions of a B test returns 404 and no B dimension is returned', async () => {
        const res = await api.get(createDimensionPath(fx.b.test.id), fx.a.adminToken);
        expect(res.status).toBe(404);
        expect(bodyText(res)).not.toContain(fx.b.dimension.id);
    });

    test('soft delete a B dimension returns 404 and it stays active', async () => {
        const res = await api.delete(deleteDimensionPath(fx.b.dimension.id), fx.a.adminToken);
        expect(res.status).toBe(404);
        expect((await dimensionRow(fx.b.dimension.id))?.isActive).toBe(true);
    });

    test('add a question to a B dimension returns 404 and no question is added', async () => {
        const before = await prisma.question.count({ where: { dimensionId: fx.b.dimension.id } });
        const res = await api
            .post(createQuestionPath(fx.b.dimension.id), fx.a.adminToken)
            .send({ text: 'Injected question', scaleMin: 1, scaleMax: 5 });
        expect(res.status).toBe(404);
        expect(await prisma.question.count({ where: { dimensionId: fx.b.dimension.id } })).toBe(before);
    });

    test('list the questions of a B dimension returns 404 and no B question is returned', async () => {
        const res = await api.get(createQuestionPath(fx.b.dimension.id), fx.a.adminToken);
        expect(res.status).toBe(404);
        expect(bodyText(res)).not.toContain(fx.b.question.id);
    });

    test('soft delete a B question returns 404 and it stays active', async () => {
        const res = await api.delete(deleteQuestionPath(fx.b.question.id), fx.a.adminToken);
        expect(res.status).toBe(404);
        expect((await questionRow(fx.b.question.id))?.isActive).toBe(true);
    });

    test('a foreign dimension and a non-existent dimension get the same response (no existence leak)', async () => {
        const foreign = await api.post(createQuestionPath(fx.b.dimension.id), fx.a.adminToken).send({ text: 'x', scaleMin: 1, scaleMax: 5 });
        const missing = await api.post(createQuestionPath(randomUUID()), fx.a.adminToken).send({ text: 'x', scaleMin: 1, scaleMax: 5 });
        expect(foreign.status).toBe(missing.status);
        expect(foreign.body.message).toBe(missing.body.message);
    });

    test('a dimension of institute B used with an own test id is not accepted (404)', async () => {
        // The question route takes only a dimensionId, so the parent chain is checked through the dimension itself.
        const res = await api
            .post(createQuestionPath(fx.b.dimension.id), fx.a.adminToken)
            .send({ text: 'x', scaleMin: 1, scaleMax: 5, testId: fx.a.test.id, dimensionId: fx.a.dimension.id });
        expect(res.status).toBe(404);
        expect(await prisma.question.count({ where: { dimensionId: fx.a.dimension.id } })).toBe(1);
    });

    test('a dimension of an inactive own test is not accepted (404)', async () => {
        await prisma.psychometricTest.update({ where: { id: fx.a.test.id }, data: { isActive: false } });
        const res = await api
            .post(createQuestionPath(fx.a.dimension.id), fx.a.adminToken)
            .send({ text: 'x', scaleMin: 1, scaleMax: 5 });
        expect(res.status).toBe(404);
    });
});

describe('SEC-06: reads are limited to the caller institute', () => {
    test('a STUDENT of institute A can read the dimensions of an A test (200)', async () => {
        const res = await api.get(createDimensionPath(fx.a.test.id), fx.a.studentToken);
        expect(res.status).toBe(200);
        expect(ids(res)).toEqual([fx.a.dimension.id]);
    });

    test('a STUDENT of institute A cannot read the dimensions of a B test (404)', async () => {
        const res = await api.get(createDimensionPath(fx.b.test.id), fx.a.studentToken);
        expect(DENIED_STATUSES).toContain(res.status);
        expect(bodyText(res)).not.toContain(fx.b.dimension.id);
    });

    test('a STUDENT of institute A cannot read the questions of a B dimension (404)', async () => {
        const res = await api.get(createQuestionPath(fx.b.dimension.id), fx.a.studentToken);
        expect(DENIED_STATUSES).toContain(res.status);
        expect(bodyText(res)).not.toContain(fx.b.question.id);
    });

    test('the global dimension list returns only institute A dimensions', async () => {
        const res = await api.get('/api/dimensions', fx.a.adminToken);
        expect(res.status).toBe(200);
        expect(ids(res)).toEqual([fx.a.dimension.id]);
        expect(bodyText(res)).not.toContain(fx.b.dimension.id);
    });

    test('the global question list returns only institute A questions', async () => {
        const res = await api.get('/api/questions', fx.a.adminToken);
        expect(res.status).toBe(200);
        expect(ids(res)).toEqual([fx.a.question.id]);
        expect(bodyText(res)).not.toContain(fx.b.question.id);
    });

    test('a query instituteId does not widen the global lists beyond institute A', async () => {
        const dims = await api.get(`/api/dimensions?instituteId=${fx.b.institute.id}`, fx.a.adminToken);
        const qs = await api.get(`/api/questions?instituteId=${fx.b.institute.id}`, fx.a.adminToken);
        expect(ids(dims)).toEqual([fx.a.dimension.id]);
        expect(ids(qs)).toEqual([fx.a.question.id]);
    });
});

describe('SEC-06: a token without an institute fails closed', () => {
    // Built inside each test, because the fixture is only seeded in beforeEach.
    const noInstituteToken = () => generateToken({ userId: fx.a.admin.id, role: 'ADMIN', instituteId: '' });

    test('writes and reads are refused and B structure is not touched', async () => {
        const create = await api.post(createDimensionPath(fx.b.test.id), noInstituteToken()).send({ name: 'x', description: 'x' });
        const remove = await api.delete(deleteDimensionPath(fx.b.dimension.id), noInstituteToken());
        const list = await api.get('/api/dimensions', noInstituteToken());
        expect(DENIED_STATUSES).toContain(create.status);
        expect(DENIED_STATUSES).toContain(remove.status);
        expect(list.status).toBe(403);
        expect(bodyText(list)).not.toContain(fx.a.dimension.id);
        expect((await dimensionRow(fx.b.dimension.id))?.isActive).toBe(true);
    });
});

describe('SEC-06: spoofed instituteId cannot override req.user.instituteId', () => {
    test('a body instituteId on a create in a B test does not grant access (404)', async () => {
        const res = await api
            .post(createDimensionPath(fx.b.test.id), fx.a.adminToken)
            .send({ name: 'x', description: 'x', instituteId: fx.a.institute.id });
        expect(res.status).toBe(404);
    });

    test('a body instituteId on a delete of a B question does not grant access (404)', async () => {
        const res = await api
            .delete(deleteQuestionPath(fx.b.question.id), fx.a.adminToken)
            .send({ instituteId: fx.a.institute.id });
        expect(res.status).toBe(404);
        expect((await questionRow(fx.b.question.id))?.isActive).toBe(true);
    });
});
