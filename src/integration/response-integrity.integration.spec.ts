/**
 * DB-03 regression tests: a submission is accepted only when it is bound to a valid invite and every
 * question belongs to the invited test. A refused submission writes no rows and does not consume the invite.
 */
import { randomUUID } from 'crypto';
import type { PsychometricTest, Question, TestInvite } from '@prisma/client';
import { api, bodyText, prisma, seedTwoTenants, TwoTenantFixture } from '../test-utils/integration/harness';

let fx: TwoTenantFixture;

beforeEach(async () => {
    fx = await seedTwoTenants();
});

afterAll(async () => {
    await prisma.$disconnect();
});

const SUBMIT = '/api/responses/responses/submit';
const submit = (body: Record<string, unknown>, token = fx.a.studentToken) => api.post(SUBMIT, token).send(body);
const totalResponses = () => prisma.response.count();
const inviteRow = (id: string) => prisma.testInvite.findUnique({ where: { id } });

/** A question under a dimension of the given test. The flags let a test set up an inactive parent. */
const questionIn = async (testId: string, { dimensionActive = true, questionActive = true } = {}): Promise<Question> => {
    const dimension = await prisma.dimension.create({ data: { name: 'dim', testId, isActive: dimensionActive } });
    return prisma.question.create({
        data: { text: 'q', dimensionId: dimension.id, scaleMin: 1, scaleMax: 5, isActive: questionActive },
    });
};

/** A PENDING invite for the institute A student, on a fresh active test with one active question. */
const freshInvite = async (): Promise<{ test: PsychometricTest; question: Question; invite: TestInvite }> => {
    const test = await prisma.psychometricTest.create({ data: { title: 'fresh', instituteId: fx.a.institute.id } });
    const question = await questionIn(test.id);
    const invite = await prisma.testInvite.create({
        data: { testId: test.id, studentId: fx.a.student.id, token: `inv-${randomUUID()}` },
    });
    return { test, question, invite };
};

const submitFor = (invite: TestInvite, responses: { questionId: string; answer: unknown }[], studentId = fx.a.student.id) =>
    submit({ token: invite.token, studentId, responses });

/** A refusal with the expected message, no new rows, and the invite still open for a later submission. */
const expectRefused = async (
    res: { status: number; body: { message?: string } },
    message: string,
    invite: TestInvite,
    rowsBefore: number
) => {
    expect(res.status).toBe(400);
    expect(res.body.message).toBe(message);
    expect(await totalResponses()).toBe(rowsBefore);
    expect((await inviteRow(invite.id))?.status).toBe('PENDING');
};

describe('DB-03: a valid submission is bound to the invite and completes it once', () => {
    test('a valid submission creates responses for the invite student and marks the invite COMPLETED (201)', async () => {
        const { question, invite } = await freshInvite();

        const res = await submitFor(invite, [{ questionId: question.id, answer: 4 }]);

        expect(res.status).toBe(201);
        const rows = await prisma.response.findMany({ where: { questionId: question.id } });
        expect(rows).toHaveLength(1);
        expect(rows[0].studentId).toBe(fx.a.student.id);
        expect(rows[0].answer).toBe(4);
        expect((await inviteRow(invite.id))?.status).toBe('COMPLETED');
    });

    test('extra body values (instituteId, testId, another studentId) cannot move the response: the invite decides', async () => {
        const { test, question, invite } = await freshInvite();

        const res = await submit({
            token: invite.token,
            studentId: fx.a.student.id,
            instituteId: fx.b.institute.id,
            testId: fx.b.test.id,
            responses: [{ questionId: question.id, answer: 2 }],
        });

        expect(res.status).toBe(201);
        const row = await prisma.response.findFirstOrThrow({
            where: { questionId: question.id },
            include: { student: true, question: { include: { dimension: true } } },
        });
        expect(row.student.instituteId).toBe(fx.a.institute.id);
        expect(row.question.dimension.testId).toBe(test.id);
    });

    test('a spoofed studentId of another institute is refused (400), writes nothing and leaves the invite open', async () => {
        const { question, invite } = await freshInvite();
        const before = await totalResponses();

        const res = await submitFor(invite, [{ questionId: question.id, answer: 3 }], fx.b.student.id);

        await expectRefused(res, 'Student does not match invite', invite, before);
        expect(bodyText(res)).not.toContain(invite.token);
    });
});

describe('DB-03: every submitted question must belong to the invited test, institute and active parents', () => {
    test('a question from another test of the same institute is refused (400) and writes zero rows', async () => {
        const { invite } = await freshInvite();
        const otherTest = await prisma.psychometricTest.create({ data: { title: 'other', instituteId: fx.a.institute.id } });
        const foreign = await questionIn(otherTest.id);
        const before = await totalResponses();

        const res = await submitFor(invite, [{ questionId: foreign.id, answer: 3 }]);

        await expectRefused(res, 'One or more questions are invalid or inactive', invite, before);
    });

    test('a question from a test of another institute is refused (400) and writes zero rows', async () => {
        const { invite } = await freshInvite();
        const foreign = await questionIn(fx.b.test.id);
        const before = await totalResponses();

        const res = await submitFor(invite, [{ questionId: foreign.id, answer: 3 }]);

        await expectRefused(res, 'One or more questions are invalid or inactive', invite, before);
    });

    test('a deactivated question is refused (400) and writes zero rows', async () => {
        const { test, invite } = await freshInvite();
        const inactive = await questionIn(test.id, { questionActive: false });
        const before = await totalResponses();

        const res = await submitFor(invite, [{ questionId: inactive.id, answer: 3 }]);

        await expectRefused(res, 'One or more questions are invalid or inactive', invite, before);
    });

    test('a question under an inactive dimension is refused (400) and writes zero rows', async () => {
        const { test, invite } = await freshInvite();
        const hidden = await questionIn(test.id, { dimensionActive: false });
        const before = await totalResponses();

        const res = await submitFor(invite, [{ questionId: hidden.id, answer: 3 }]);

        await expectRefused(res, 'One or more questions are invalid or inactive', invite, before);
    });

    test('a question of an inactive test of the same institute is refused (400) and writes zero rows', async () => {
        const { invite } = await freshInvite();
        const retired = await prisma.psychometricTest.create({
            data: { title: 'retired', instituteId: fx.a.institute.id, isActive: false },
        });
        const question = await questionIn(retired.id);
        const before = await totalResponses();

        const res = await submitFor(invite, [{ questionId: question.id, answer: 3 }]);

        await expectRefused(res, 'One or more questions are invalid or inactive', invite, before);
    });

    test('a mixed payload with one valid and one foreign question writes no rows at all (no partial save)', async () => {
        const { question, invite } = await freshInvite();
        const otherTest = await prisma.psychometricTest.create({ data: { title: 'other', instituteId: fx.a.institute.id } });
        const foreign = await questionIn(otherTest.id);
        const before = await totalResponses();

        const res = await submitFor(invite, [
            { questionId: question.id, answer: 3 },
            { questionId: foreign.id, answer: 3 },
        ]);

        await expectRefused(res, 'One or more questions are invalid or inactive', invite, before);
        expect(await prisma.response.count({ where: { questionId: question.id } })).toBe(0);
    });
});

describe('DB-03: payload integrity', () => {
    test('duplicate questionId entries are refused (400) and write zero rows', async () => {
        const { question, invite } = await freshInvite();
        const before = await totalResponses();

        const res = await submitFor(invite, [
            { questionId: question.id, answer: 2 },
            { questionId: question.id, answer: 4 },
        ]);

        await expectRefused(res, 'Duplicate question answers are not allowed', invite, before);
    });

    test('an empty responses array is refused (400)', async () => {
        const { invite } = await freshInvite();
        const before = await totalResponses();

        const res = await submitFor(invite, []);

        expect(res.status).toBe(400);
        expect(await totalResponses()).toBe(before);
        expect((await inviteRow(invite.id))?.status).toBe('PENDING');
    });

    test('an answer that is not an integer (string or fraction) is refused (400) and writes zero rows', async () => {
        const { question, invite } = await freshInvite();
        const before = await totalResponses();

        const asString = await submitFor(invite, [{ questionId: question.id, answer: '3' }]);
        await expectRefused(asString, 'Each response needs a questionId and an integer answer', invite, before);

        const fraction = await submitFor(invite, [{ questionId: question.id, answer: 2.5 }]);
        await expectRefused(fraction, 'Each response needs a questionId and an integer answer', invite, before);
    });

    test('an answer outside the question scale is refused (400) and writes zero rows', async () => {
        const { question, invite } = await freshInvite();
        const before = await totalResponses();

        const res = await submitFor(invite, [{ questionId: question.id, answer: 9 }]);

        expect(res.status).toBe(400);
        expect(res.body.message).toBe(`Answer for question ${question.id} must be between 1 and 5`);
        expect(await totalResponses()).toBe(before);
    });

    test('responses that is not an array is refused (400)', async () => {
        const { invite } = await freshInvite();
        const res = await submit({ token: invite.token, studentId: fx.a.student.id, responses: { questionId: 'x', answer: 3 } });
        expect(res.status).toBe(400);
    });
});

describe('DB-03: an invite is consumed exactly once', () => {
    test('a re-submission for an already completed invite is refused (400) and writes zero rows', async () => {
        const { question, invite } = await freshInvite();
        expect((await submitFor(invite, [{ questionId: question.id, answer: 3 }])).status).toBe(201);
        const before = await totalResponses();

        const res = await submitFor(invite, [{ questionId: question.id, answer: 5 }]);

        expect(res.status).toBe(400);
        expect(res.body.message).toBe('Responses already submitted for this invite');
        expect(await totalResponses()).toBe(before);
    });

    test('two concurrent submissions for one invite: exactly one is saved (201) and the other is refused (400)', async () => {
        const { question, invite } = await freshInvite();
        const responses = [{ questionId: question.id, answer: 3 }];

        const [first, second] = await Promise.all([submitFor(invite, responses), submitFor(invite, responses)]);

        expect([first.status, second.status].sort()).toEqual([201, 400]);
        const loser = first.status === 400 ? first : second;
        expect(loser.body.message).toBe('Responses already submitted for this invite');
        expect(await prisma.response.count({ where: { questionId: question.id } })).toBe(1);
        expect((await inviteRow(invite.id))?.status).toBe('COMPLETED');
    });

    test('an invite whose student has been deactivated is refused with the generic message (400) and writes zero rows', async () => {
        const { question, invite } = await freshInvite();
        await prisma.student.update({ where: { id: fx.a.student.id }, data: { isActive: false } });
        const before = await totalResponses();

        const res = await submitFor(invite, [{ questionId: question.id, answer: 3 }]);

        await expectRefused(res, 'Invalid or inactive invite token', invite, before);
        expect(bodyText(res)).not.toContain(invite.token);
    });
});
