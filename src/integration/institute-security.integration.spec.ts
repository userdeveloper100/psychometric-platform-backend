/**
 * SEC-02 regression tests: institute endpoints require a valid token and the ADMIN role,
 * and an ADMIN can only read or change their own institute.
 *
 * Promoted from security.pending.integration.spec.ts once SEC-02 was fixed.
 * The own-institute DELETE is not asserted here. It fails on the DB-01 cascade defect and is
 * tracked as pending in security.pending.integration.spec.ts.
 */
import { randomUUID } from 'crypto';
import { api, bodyText, prisma, seedTwoTenants, TwoTenantFixture } from '../test-utils/integration/harness';

let fx: TwoTenantFixture;

beforeEach(async () => {
    fx = await seedTwoTenants();
});

afterAll(async () => {
    await prisma.$disconnect();
});

const instituteRow = (id: string) => prisma.institute.findUnique({ where: { id } });

describe('SEC-02: role authorization (STUDENT is refused with 403)', () => {
    test('a STUDENT cannot create an institute and no institute is created', async () => {
        const before = await prisma.institute.count();
        const res = await api
            .post('/api/institutes', fx.a.studentToken)
            .send({ name: 'Rogue institute', email: 'rogue@integration.test' });
        expect(res.status).toBe(403);
        expect(await prisma.institute.count()).toBe(before);
    });

    test('a STUDENT cannot read their own institute (403)', async () => {
        const res = await api.get(`/api/institutes/${fx.a.institute.id}`, fx.a.studentToken);
        expect(res.status).toBe(403);
    });

    test('a STUDENT cannot read another institute (403)', async () => {
        const res = await api.get(`/api/institutes/${fx.b.institute.id}`, fx.a.studentToken);
        expect(res.status).toBe(403);
    });

    test('a STUDENT cannot rename their own institute (403) and the name is unchanged', async () => {
        const res = await api.put(`/api/institutes/${fx.a.institute.id}`, fx.a.studentToken).send({ name: 'Renamed' });
        expect(res.status).toBe(403);
        expect((await instituteRow(fx.a.institute.id))?.name).toBe(fx.a.institute.name);
    });

    test('a STUDENT cannot delete their own institute (403) and it stays active', async () => {
        const res = await api.delete(`/api/institutes/${fx.a.institute.id}`, fx.a.studentToken);
        expect(res.status).toBe(403);
        expect((await instituteRow(fx.a.institute.id))?.isActive).toBe(true);
    });

    test('a STUDENT cannot list institutes (403)', async () => {
        const res = await api.get('/api/institutes', fx.a.studentToken);
        expect(res.status).toBe(403);
    });
});

describe('SEC-02: tenant boundary (ADMIN of A is confined to institute A)', () => {
    test('admin of A reads their own institute (200)', async () => {
        const res = await api.get(`/api/institutes/${fx.a.institute.id}`, fx.a.adminToken);
        expect(res.status).toBe(200);
        expect(res.body.data.id).toBe(fx.a.institute.id);
    });

    test('admin of A cannot read institute B (404), and B data is not returned', async () => {
        const res = await api.get(`/api/institutes/${fx.b.institute.id}`, fx.a.adminToken);
        expect(res.status).toBe(404);
        expect(bodyText(res)).not.toContain(fx.b.institute.name);
    });

    test('admin of A cannot rename institute B (404) and B is unchanged', async () => {
        const res = await api.put(`/api/institutes/${fx.b.institute.id}`, fx.a.adminToken).send({ name: 'Renamed by A' });
        expect(res.status).toBe(404);
        expect((await instituteRow(fx.b.institute.id))?.name).toBe(fx.b.institute.name);
    });

    test('admin of A cannot soft delete institute B (404); B and its users stay active', async () => {
        const res = await api.delete(`/api/institutes/${fx.b.institute.id}`, fx.a.adminToken);
        expect(res.status).toBe(404);
        expect((await instituteRow(fx.b.institute.id))?.isActive).toBe(true);
        expect((await prisma.user.findUnique({ where: { id: fx.b.admin.id } }))?.isActive).toBe(true);
        expect((await prisma.student.findUnique({ where: { id: fx.b.student.id } }))?.isActive).toBe(true);
    });

    test('a foreign institute and a non-existent institute get the same response (no existence leak)', async () => {
        const foreign = await api.get(`/api/institutes/${fx.b.institute.id}`, fx.a.adminToken);
        const missing = await api.get(`/api/institutes/${randomUUID()}`, fx.a.adminToken);
        expect(foreign.status).toBe(missing.status);
        expect(foreign.body.message).toBe(missing.body.message);
    });

    test('admin of A listing institutes sees only institute A', async () => {
        const res = await api.get('/api/institutes', fx.a.adminToken);
        expect(res.status).toBe(200);
        const ids = res.body.data.map((row: { id: string }) => row.id);
        expect(ids).toEqual([fx.a.institute.id]);
        expect(bodyText(res)).not.toContain(fx.b.institute.name);
    });
});

describe('SEC-02: spoofed instituteId cannot override req.user.instituteId', () => {
    test('a body instituteId on own update changes only institute A name', async () => {
        const res = await api
            .put(`/api/institutes/${fx.a.institute.id}`, fx.a.adminToken)
            .send({ name: 'Renamed A', instituteId: fx.b.institute.id });
        expect(res.status).toBe(200);
        expect((await instituteRow(fx.a.institute.id))?.name).toBe('Renamed A');
        expect((await instituteRow(fx.b.institute.id))?.name).toBe(fx.b.institute.name);
    });

    test('a query instituteId on list does not widen the scope beyond institute A', async () => {
        const res = await api.get(`/api/institutes?instituteId=${fx.b.institute.id}`, fx.a.adminToken);
        expect(res.status).toBe(200);
        const ids = res.body.data.map((row: { id: string }) => row.id);
        expect(ids).toEqual([fx.a.institute.id]);
    });
});

describe('SEC-02: unauthenticated requests are refused with 401', () => {
    test('create, list, read, update and delete without a token all return 401', async () => {
        const responses = [
            await api.post('/api/institutes').send({ name: 'x', email: 'x@integration.test' }),
            await api.get('/api/institutes'),
            await api.get(`/api/institutes/${fx.a.institute.id}`),
            await api.put(`/api/institutes/${fx.a.institute.id}`).send({ name: 'x' }),
            await api.delete(`/api/institutes/${fx.a.institute.id}`),
        ];
        for (const res of responses) {
            expect(res.status).toBe(401);
        }
        expect((await instituteRow(fx.a.institute.id))?.name).toBe(fx.a.institute.name);
    });
});

describe('SEC-02: ADMIN can create an institute (provisional, see DEC-01)', () => {
    test('admin of A creates an institute (201)', async () => {
        const res = await api
            .post('/api/institutes', fx.a.adminToken)
            .send({ name: 'Second institute', email: 'second@integration.test' });
        expect(res.status).toBe(201);
    });
});
