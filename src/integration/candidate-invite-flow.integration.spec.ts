/**
 * DEC-03 regression tests. A candidate is token-bound: an invite token alone loads the assessment and submits it,
 * with no user account and no JWT. A STUDENT JWT cannot read the internal assessment structure.
 */
import { randomUUID } from 'crypto';
import logger from '../config/logger';
import { api, bodyText, prisma, seedTwoTenants, TwoTenantFixture } from '../test-utils/integration/harness';

let fx: TwoTenantFixture;

beforeEach(async () => {
    fx = await seedTwoTenants();
});

afterEach(() => {
    jest.restoreAllMocks();
});

afterAll(async () => {
    await prisma.$disconnect();
});

const REFUSED_MESSAGE = 'Assessment is not available for this invite';

const loadAssessment = (token: unknown) => api.post('/api/v1/invites/assessment').send({ token });

const submitWithToken = (token: string, studentId: string, questionId: string) =>
    api.post('/api/v1/responses/submit').send({ token, studentId, responses: [{ questionId, answer: 4 }] });

const inviteRow = (id: string) => prisma.testInvite.findUnique({ where: { id } });

describe('DEC-03: a candidate loads the assessment with the invite token alone', () => {
    test('a valid token returns the test, the active dimension and the active question with no JWT (200)', async () => {
        const res = await loadAssessment(fx.a.invite.token);

        expect(res.status).toBe(200);
        expect(res.body.data.studentId).toBe(fx.a.student.id);
        expect(res.body.data.test).toEqual({
            id: fx.a.test.id,
            title: fx.a.test.title,
            description: fx.a.test.description,
        });
        expect(res.body.data.dimensions).toEqual([
            {
                id: fx.a.dimension.id,
                name: fx.a.dimension.name,
                questions: [{ id: fx.a.question.id, text: fx.a.question.text, scaleMin: 1, scaleMax: 5 }],
            },
        ]);
    });

    test('the payload holds no other tenant data and no internal fields', async () => {
        const res = await loadAssessment(fx.a.invite.token);
        const text = bodyText(res);

        expect(text).not.toContain(fx.b.test.id);
        expect(text).not.toContain(fx.b.dimension.id);
        expect(text).not.toContain(fx.b.question.id);
        expect(text).not.toContain(fx.a.institute.id);
        expect(text).not.toContain('createdBy');
        expect(text).not.toContain('isActive');
    });

    test('inactive dimensions and inactive questions are excluded from the candidate payload', async () => {
        const inactiveDimension = await prisma.dimension.create({
            data: { name: 'retired dimension', testId: fx.a.test.id, isActive: false },
        });
        await prisma.question.create({
            data: { text: 'hidden inactive question', dimensionId: fx.a.dimension.id, scaleMin: 1, scaleMax: 5, isActive: false },
        });
        await prisma.question.create({
            data: { text: 'hidden question under retired dimension', dimensionId: inactiveDimension.id, scaleMin: 1, scaleMax: 5 },
        });

        const res = await loadAssessment(fx.a.invite.token);
        const text = bodyText(res);

        expect(res.status).toBe(200);
        expect(text).not.toContain(inactiveDimension.id);
        expect(text).not.toContain('retired dimension');
        expect(text).not.toContain('hidden inactive question');
        expect(text).not.toContain('hidden question under retired dimension');
        expect(res.body.data.dimensions).toHaveLength(1);
        expect(res.body.data.dimensions[0].questions.map((q: { id: string }) => q.id)).toEqual([fx.a.question.id]);
    });

    test('a token is required (400)', async () => {
        expect((await loadAssessment(undefined)).status).toBe(400);
        expect((await loadAssessment(123)).status).toBe(400);
    });
});

describe('DEC-03: refused invite tokens get one generic 404 and leak nothing', () => {
    test.each([
        ['an unknown token', async () => 'invite-that-does-not-exist'],
        [
            'an expired invite',
            async () => {
                await prisma.testInvite.update({ where: { id: fx.a.invite.id }, data: { expiresAt: new Date(Date.now() - 60_000) } });
                return fx.a.invite.token;
            },
        ],
        [
            'a revoked invite',
            async () => {
                await prisma.testInvite.update({ where: { id: fx.a.invite.id }, data: { isActive: false } });
                return fx.a.invite.token;
            },
        ],
        [
            'a completed invite',
            async () => {
                await prisma.testInvite.update({ where: { id: fx.a.invite.id }, data: { status: 'COMPLETED' } });
                return fx.a.invite.token;
            },
        ],
        [
            'an inactive student',
            async () => {
                await prisma.student.update({ where: { id: fx.a.student.id }, data: { isActive: false } });
                return fx.a.invite.token;
            },
        ],
        [
            'an inactive test',
            async () => {
                await prisma.psychometricTest.update({ where: { id: fx.a.test.id }, data: { isActive: false } });
                return fx.a.invite.token;
            },
        ],
        [
            'an inactive institute',
            async () => {
                await prisma.institute.update({ where: { id: fx.a.institute.id }, data: { isActive: false } });
                return fx.a.invite.token;
            },
        ],
    ])('%s returns 404 with the generic message and no assessment', async (_label, prepare) => {
        const token = await prepare();
        const res = await loadAssessment(token);

        expect(res.status).toBe(404);
        expect(res.body.message).toBe(REFUSED_MESSAGE);
        expect(res.body.data).toBeUndefined();
        expect(bodyText(res)).not.toContain(fx.a.question.id);
        expect(bodyText(res)).not.toContain(token);
    });

    test('the refusal logs invite_validation_failed with the fixed reason and never the token', async () => {
        const warn = jest.spyOn(logger, 'warn');
        const bogus = `bogus-token-${randomUUID()}`;

        await loadAssessment(bogus);

        const securityCalls = warn.mock.calls.filter((call) => call[0] === 'security_event');
        expect(securityCalls).toHaveLength(1);
        expect(securityCalls[0][1]).toEqual(
            expect.objectContaining({ event: 'invite_validation_failed', action: 'load_assessment', reason: 'Invalid or inactive invite token' })
        );
        expect(JSON.stringify(warn.mock.calls)).not.toContain(bogus);
    });
});

describe('DEC-03: the candidate submits with the invite token alone, once', () => {
    test('a submission with the token and no JWT is accepted (201) and the invite is completed', async () => {
        const res = await submitWithToken(fx.a.invite.token, fx.a.student.id, fx.a.question.id);

        expect(res.status).toBe(201);
        expect(res.body.data.createdCount).toBe(1);
        expect((await inviteRow(fx.a.invite.id))?.status).toBe('COMPLETED');

        const saved = await prisma.response.findMany({ where: { studentId: fx.a.student.id, questionId: fx.a.question.id, createdBy: 'system' } });
        expect(saved).toHaveLength(1);
    });

    test('after completion the candidate cannot reload the assessment or submit again', async () => {
        await submitWithToken(fx.a.invite.token, fx.a.student.id, fx.a.question.id);
        const responsesAfterFirst = await prisma.response.count({ where: { studentId: fx.a.student.id } });

        const reload = await loadAssessment(fx.a.invite.token);
        const again = await submitWithToken(fx.a.invite.token, fx.a.student.id, fx.a.question.id);

        expect(reload.status).toBe(404);
        expect(again.status).toBe(400);
        expect(again.body.message).toBe('Responses already submitted for this invite');
        expect(await prisma.response.count({ where: { studentId: fx.a.student.id } })).toBe(responsesAfterFirst);
    });

    test('a submission with a bogus token is refused (400) and writes nothing', async () => {
        const before = await prisma.response.count();
        const res = await submitWithToken('bogus-token', fx.a.student.id, fx.a.question.id);

        expect(res.status).toBe(400);
        expect(res.body.message).toBe('Invalid or inactive invite token');
        expect(await prisma.response.count()).toBe(before);
    });
});

describe('DEC-03: internal assessment reads are ADMIN only', () => {
    test.each([
        ['GET /api/v1/tests', () => '/api/v1/tests'],
        ['GET /api/v1/dimensions', () => '/api/v1/dimensions'],
        ['GET /api/v1/dimensions/tests/:testId/dimensions', () => `/api/v1/dimensions/tests/${fx.a.test.id}/dimensions`],
        ['GET /api/v1/questions', () => '/api/v1/questions'],
        ['GET /api/v1/questions/dimensions/:dimensionId/questions', () => `/api/v1/questions/dimensions/${fx.a.dimension.id}/questions`],
    ])('a STUDENT JWT gets 403 on %s', async (_label, path) => {
        const res = await api.get(path(), fx.a.studentToken);
        expect(res.status).toBe(403);
        expect(bodyText(res)).not.toContain(fx.a.question.id);
    });

    test('an ADMIN JWT still reads the structure lists (200)', async () => {
        expect((await api.get('/api/v1/tests', fx.a.adminToken)).status).toBe(200);
        expect((await api.get('/api/v1/dimensions', fx.a.adminToken)).status).toBe(200);
        expect((await api.get('/api/v1/questions', fx.a.adminToken)).status).toBe(200);
    });

    test('an unauthenticated read of the structure lists is refused with 401', async () => {
        expect((await api.get('/api/v1/tests')).status).toBe(401);
        expect((await api.get('/api/v1/dimensions')).status).toBe(401);
        expect((await api.get('/api/v1/questions')).status).toBe(401);
    });
});
