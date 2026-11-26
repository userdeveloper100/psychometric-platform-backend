/**
 * DB-01 regression tests: soft-delete cascades reach the correct child rows, record the acting user in
 * updatedBy, leave the other institute untouched, and never remove rows.
 *
 * Promoted from security.pending.integration.spec.ts (the own-institute delete) once DB-01 was fixed,
 * and extended to test, dimension, question and student deletes.
 */
import { api, prisma, seedTwoTenants, TwoTenantFixture } from '../test-utils/integration/harness';

let fx: TwoTenantFixture;

beforeEach(async () => {
    fx = await seedTwoTenants();
});

afterAll(async () => {
    await prisma.$disconnect();
});

const activeOf = async (table: 'institute' | 'user' | 'student' | 'psychometricTest' | 'dimension' | 'question' | 'testInvite' | 'response', id: string) => {
    const row = await (prisma[table] as any).findUnique({ where: { id } });
    return row as { isActive: boolean; updatedBy: string | null } | null;
};

/** Every row of the B institute must still be active and unchanged. */
const expectBUntouched = async () => {
    expect((await activeOf('institute', fx.b.institute.id))?.isActive).toBe(true);
    expect((await activeOf('user', fx.b.admin.id))?.isActive).toBe(true);
    expect((await activeOf('user', fx.b.studentUser.id))?.isActive).toBe(true);
    expect((await activeOf('student', fx.b.student.id))?.isActive).toBe(true);
    expect((await activeOf('psychometricTest', fx.b.test.id))?.isActive).toBe(true);
    expect((await activeOf('dimension', fx.b.dimension.id))?.isActive).toBe(true);
    expect((await activeOf('question', fx.b.question.id))?.isActive).toBe(true);
    expect((await activeOf('testInvite', fx.b.invite.id))?.isActive).toBe(true);
    expect((await activeOf('response', fx.b.response.id))?.isActive).toBe(true);
};

describe('DB-01: own institute delete cascades to every dependent record', () => {
    test('admin of A deletes their own institute (200)', async () => {
        const res = await api.delete(`/api/v1/institutes/${fx.a.institute.id}`, fx.a.adminToken);
        expect(res.status).toBe(200);
        expect((await activeOf('institute', fx.a.institute.id))?.isActive).toBe(false);
    });

    test('every dependent row of institute A is soft deleted, with updatedBy set to the acting user', async () => {
        await api.delete(`/api/v1/institutes/${fx.a.institute.id}`, fx.a.adminToken);

        const rows = [
            ['psychometricTest', fx.a.test.id],
            ['dimension', fx.a.dimension.id],
            ['question', fx.a.question.id],
            ['student', fx.a.student.id],
            ['testInvite', fx.a.invite.id],
            ['response', fx.a.response.id],
            ['user', fx.a.admin.id],
            ['user', fx.a.studentUser.id],
        ] as const;

        for (const [table, id] of rows) {
            const row = await activeOf(table, id);
            expect(row?.isActive).toBe(false);
            expect(row?.updatedBy).toBe(fx.a.admin.id);
        }
        expect((await activeOf('institute', fx.a.institute.id))?.updatedBy).toBe(fx.a.admin.id);
    });

    test('institute B is untouched by the delete of institute A', async () => {
        await api.delete(`/api/v1/institutes/${fx.a.institute.id}`, fx.a.adminToken);
        await expectBUntouched();
    });

    test('no row is removed: the dependent rows still exist after the cascade', async () => {
        await api.delete(`/api/v1/institutes/${fx.a.institute.id}`, fx.a.adminToken);
        expect(await prisma.response.count({ where: { id: fx.a.response.id } })).toBe(1);
        expect(await prisma.testInvite.count({ where: { id: fx.a.invite.id } })).toBe(1);
        expect(await prisma.psychometricTest.count({ where: { id: fx.a.test.id } })).toBe(1);
    });
});

describe('DB-01: test delete cascades to dimensions, questions, invites and responses', () => {
    test('admin of A deletes an own test (200), and the cascade reaches its children', async () => {
        const res = await api.delete(`/api/v1/tests/${fx.a.test.id}`, fx.a.adminToken);
        expect(res.status).toBe(200);

        expect((await activeOf('psychometricTest', fx.a.test.id))?.isActive).toBe(false);
        expect((await activeOf('dimension', fx.a.dimension.id))?.isActive).toBe(false);
        expect((await activeOf('question', fx.a.question.id))?.isActive).toBe(false);
        expect((await activeOf('testInvite', fx.a.invite.id))?.isActive).toBe(false);
        expect((await activeOf('response', fx.a.response.id))?.isActive).toBe(false);
    });

    test('updatedBy on the test cascade is the acting user, never the institute id', async () => {
        await api.delete(`/api/v1/tests/${fx.a.test.id}`, fx.a.adminToken);
        for (const [table, id] of [
            ['psychometricTest', fx.a.test.id],
            ['dimension', fx.a.dimension.id],
            ['question', fx.a.question.id],
            ['testInvite', fx.a.invite.id],
            ['response', fx.a.response.id],
        ] as const) {
            const row = await activeOf(table, id);
            expect(row?.updatedBy).toBe(fx.a.admin.id);
            expect(row?.updatedBy).not.toBe(fx.a.institute.id);
        }
    });

    test('the institute and the student of an own test delete stay active', async () => {
        await api.delete(`/api/v1/tests/${fx.a.test.id}`, fx.a.adminToken);
        expect((await activeOf('institute', fx.a.institute.id))?.isActive).toBe(true);
        expect((await activeOf('student', fx.a.student.id))?.isActive).toBe(true);
    });

    test('admin of A cannot delete a B test (404), and the B cascade does not run', async () => {
        const res = await api.delete(`/api/v1/tests/${fx.b.test.id}`, fx.a.adminToken);
        expect(res.status).toBe(404);
        await expectBUntouched();
    });

    test('deleting the same test twice returns 404 and does not overwrite the first deletion', async () => {
        await api.delete(`/api/v1/tests/${fx.a.test.id}`, fx.a.adminToken);
        const first = await activeOf('psychometricTest', fx.a.test.id);

        const again = await api.delete(`/api/v1/tests/${fx.a.test.id}`, fx.a.adminToken);
        expect(again.status).toBe(404);
        expect((await activeOf('psychometricTest', fx.a.test.id))?.updatedBy).toBe(first?.updatedBy);
    });
});

describe('DB-01: dimension delete cascades to questions and their responses', () => {
    test('admin of A deletes an own dimension (200), and its questions and responses are soft deleted', async () => {
        const res = await api.delete(`/api/v1/dimensions/${fx.a.dimension.id}`, fx.a.adminToken);
        expect(res.status).toBe(200);

        expect((await activeOf('dimension', fx.a.dimension.id))?.isActive).toBe(false);
        expect((await activeOf('question', fx.a.question.id))?.isActive).toBe(false);
        expect((await activeOf('response', fx.a.response.id))?.isActive).toBe(false);
    });

    test('the parent test and the student stay active, and updatedBy is the acting user', async () => {
        await api.delete(`/api/v1/dimensions/${fx.a.dimension.id}`, fx.a.adminToken);
        expect((await activeOf('psychometricTest', fx.a.test.id))?.isActive).toBe(true);
        expect((await activeOf('student', fx.a.student.id))?.isActive).toBe(true);
        expect((await activeOf('response', fx.a.response.id))?.updatedBy).toBe(fx.a.admin.id);
    });

    test('a B dimension is not touched by an A delete attempt (404)', async () => {
        const res = await api.delete(`/api/v1/dimensions/${fx.b.dimension.id}`, fx.a.adminToken);
        expect(res.status).toBe(404);
        await expectBUntouched();
    });
});

describe('DB-01: question delete cascades to its responses', () => {
    test('admin of A deletes an own question (200), and its responses are soft deleted', async () => {
        const res = await api.delete(`/api/v1/questions/${fx.a.question.id}`, fx.a.adminToken);
        expect(res.status).toBe(200);

        expect((await activeOf('question', fx.a.question.id))?.isActive).toBe(false);
        expect((await activeOf('response', fx.a.response.id))?.isActive).toBe(false);
    });

    test('the parent dimension stays active', async () => {
        await api.delete(`/api/v1/questions/${fx.a.question.id}`, fx.a.adminToken);
        expect((await activeOf('dimension', fx.a.dimension.id))?.isActive).toBe(true);
    });

    test('a B question is not touched by an A delete attempt (404)', async () => {
        const res = await api.delete(`/api/v1/questions/${fx.b.question.id}`, fx.a.adminToken);
        expect(res.status).toBe(404);
        await expectBUntouched();
    });
});

describe('DB-01: student delete cascades to invites and responses', () => {
    test('admin of A deletes an own student (200), and their invites and responses are soft deleted', async () => {
        const res = await api.delete(`/api/v1/students/${fx.a.student.id}`, fx.a.adminToken);
        expect(res.status).toBe(200);

        expect((await activeOf('student', fx.a.student.id))?.isActive).toBe(false);
        expect((await activeOf('testInvite', fx.a.invite.id))?.isActive).toBe(false);
        expect((await activeOf('response', fx.a.response.id))?.isActive).toBe(false);
    });

    test('the test and the question are not deactivated by a student delete', async () => {
        await api.delete(`/api/v1/students/${fx.a.student.id}`, fx.a.adminToken);
        expect((await activeOf('psychometricTest', fx.a.test.id))?.isActive).toBe(true);
        expect((await activeOf('question', fx.a.question.id))?.isActive).toBe(true);
    });

    test('a B student is not touched by an A delete attempt (404)', async () => {
        const res = await api.delete(`/api/v1/students/${fx.b.student.id}`, fx.a.adminToken);
        expect(res.status).toBe(404);
        await expectBUntouched();
    });
});
