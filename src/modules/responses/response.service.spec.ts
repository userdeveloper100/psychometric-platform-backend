import prisma from '../../config/prisma';
import logger from '../../config/logger';
import {
    countResponses,
    deleteResponse,
    getAllResponses,
    getStudentResponses,
    getTestResponses,
    submitResponses,
} from './response.service';

jest.mock('../../config/prisma', () => {
    const client: any = {
        response: {
            findMany: jest.fn(),
            findFirst: jest.fn(),
            update: jest.fn(),
            count: jest.fn(),
            createMany: jest.fn(),
        },
        student: { findFirst: jest.fn() },
        psychometricTest: { findFirst: jest.fn() },
        testInvite: { findFirst: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
        question: { findMany: jest.fn() },
    };
    // The submit path runs inside a transaction. The mock passes the same client as the transaction.
    client.$transaction = jest.fn(async (fn: (tx: unknown) => unknown) => fn(client));
    return { __esModule: true, default: client };
});
jest.mock('../../config/logger', () => ({
    __esModule: true,
    default: { error: jest.fn() },
}));

const responseMock = prisma.response as unknown as Record<'findMany' | 'findFirst' | 'update' | 'count' | 'createMany', jest.Mock>;
const studentMock = prisma.student as unknown as { findFirst: jest.Mock };
const testMock = prisma.psychometricTest as unknown as { findFirst: jest.Mock };
const inviteMock = prisma.testInvite as unknown as { findFirst: jest.Mock; update: jest.Mock; updateMany: jest.Mock };
const questionMock = prisma.question as unknown as { findMany: jest.Mock };

const OWN = 'institute-a';
const OTHER = 'institute-b';

// The scope every response query must carry: the response's student and its test both belong to the institute.
const expectedScope = (instituteId: string) => ({
    isActive: true,
    student: { instituteId },
    question: { dimension: { test: { instituteId } } },
});

beforeEach(() => {
    jest.clearAllMocks();
});

describe('response.service tenant scope (SEC-03)', () => {
    describe('getAllResponses and countResponses', () => {
        test('fail closed: no instituteId throws and never queries', async () => {
            await expect(getAllResponses({ instituteId: '' })).rejects.toThrow('Institute scope is required');
            await expect(countResponses('')).rejects.toThrow('Institute scope is required');
            expect(responseMock.findMany).not.toHaveBeenCalled();
            expect(responseMock.count).not.toHaveBeenCalled();
        });

        test('list is filtered by the requester institute through student and test', async () => {
            responseMock.findMany.mockResolvedValue([]);
            await getAllResponses({ page: 1, limit: 10, instituteId: OWN });
            expect(responseMock.findMany).toHaveBeenCalledWith(
                expect.objectContaining({ where: expectedScope(OWN) })
            );
        });

        test('count uses the same institute scope as the list', async () => {
            responseMock.count.mockResolvedValue(3);
            expect(await countResponses(OWN)).toBe(3);
            expect(responseMock.count).toHaveBeenCalledWith({ where: expectedScope(OWN) });
        });
    });

    describe('getStudentResponses', () => {
        test('fail closed: no instituteId throws and never queries', async () => {
            await expect(getStudentResponses('student-a', '')).rejects.toThrow('Institute scope is required');
            expect(studentMock.findFirst).not.toHaveBeenCalled();
            expect(responseMock.findMany).not.toHaveBeenCalled();
        });

        test('a student of another institute is not found and their responses are never read', async () => {
            studentMock.findFirst.mockResolvedValue(null);
            await expect(getStudentResponses('student-b', OWN)).rejects.toThrow('Student not found');
            expect(studentMock.findFirst).toHaveBeenCalledWith(
                expect.objectContaining({ where: { id: 'student-b', instituteId: OWN } })
            );
            expect(responseMock.findMany).not.toHaveBeenCalled();
        });

        test('an own student is read with the institute scope applied', async () => {
            studentMock.findFirst.mockResolvedValue({ id: 'student-a' });
            responseMock.findMany.mockResolvedValue([]);
            await getStudentResponses('student-a', OWN);
            expect(responseMock.findMany).toHaveBeenCalledWith(
                expect.objectContaining({ where: { ...expectedScope(OWN), studentId: 'student-a' } })
            );
        });
    });

    describe('getTestResponses', () => {
        test('fail closed: no instituteId throws and never queries', async () => {
            await expect(getTestResponses('test-a', '')).rejects.toThrow('Institute scope is required');
            expect(testMock.findFirst).not.toHaveBeenCalled();
            expect(responseMock.findMany).not.toHaveBeenCalled();
        });

        test('a test of another institute is not found and its responses are never read', async () => {
            testMock.findFirst.mockResolvedValue(null);
            await expect(getTestResponses('test-b', OWN)).rejects.toThrow('Test not found');
            expect(testMock.findFirst).toHaveBeenCalledWith(
                expect.objectContaining({ where: { id: 'test-b', instituteId: OWN, isActive: true } })
            );
            expect(responseMock.findMany).not.toHaveBeenCalled();
        });

        test('an own test is read with the institute scope applied', async () => {
            testMock.findFirst.mockResolvedValue({ id: 'test-a' });
            responseMock.findMany.mockResolvedValue([]);
            await getTestResponses('test-a', OWN);
            expect(responseMock.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        ...expectedScope(OWN),
                        question: expect.objectContaining({
                            dimension: expect.objectContaining({
                                test: expect.objectContaining({ id: 'test-a', isActive: true }),
                            }),
                        }),
                    }),
                })
            );
        });
    });

    describe('deleteResponse', () => {
        test('fail closed: no instituteId throws and never updates', async () => {
            await expect(deleteResponse('response-a', 'u1', '')).rejects.toThrow('Institute scope is required');
            expect(responseMock.findFirst).not.toHaveBeenCalled();
            expect(responseMock.update).not.toHaveBeenCalled();
        });

        test('a response in another institute is not found and is never updated', async () => {
            responseMock.findFirst.mockResolvedValue(null);
            await expect(deleteResponse('response-b', 'u1', OWN)).rejects.toThrow('Response not found');
            expect(responseMock.findFirst).toHaveBeenCalledWith({
                where: { id: 'response-b', ...expectedScope(OWN) },
            });
            expect(responseMock.update).not.toHaveBeenCalled();
        });

        test('an own response is soft deleted after the scoped lookup', async () => {
            responseMock.findFirst.mockResolvedValue({ id: 'response-a' });
            responseMock.update.mockResolvedValue({ id: 'response-a', isActive: false });
            await deleteResponse('response-a', 'u1', OWN);
            expect(responseMock.findFirst).toHaveBeenCalledWith({
                where: { id: 'response-a', ...expectedScope(OWN) },
            });
            expect(responseMock.update).toHaveBeenCalledWith(
                expect.objectContaining({ where: { id: 'response-a' }, data: expect.objectContaining({ isActive: false }) })
            );
        });

        test('a foreign institute id does not match an own response', async () => {
            responseMock.findFirst.mockResolvedValue(null);
            await expect(deleteResponse('response-a', 'u1', OTHER)).rejects.toThrow('Response not found');
            expect(responseMock.findFirst).toHaveBeenCalledWith({
                where: { id: 'response-a', ...expectedScope(OTHER) },
            });
        });
    });
});

// SEC-05: invite validation on submission. Rejections are refused with a fixed message and never echo the token.
describe('submitResponses invite validation (SEC-05)', () => {
    const TOKEN = 'a'.repeat(64);
    const payload = {
        token: TOKEN,
        studentId: 'student-a',
        responses: [{ questionId: 'question-a', answer: 3 }],
    };
    const pendingInvite = (overrides: Record<string, unknown> = {}) => ({
        id: 'invite-a',
        testId: 'test-a',
        studentId: 'student-a',
        status: 'PENDING',
        expiresAt: null,
        test: { instituteId: OWN, isActive: true, institute: { isActive: true } },
        student: { instituteId: OWN, isActive: true },
        ...overrides,
    });

    const expectRefusedWithoutToken = async (message: string) => {
        await expect(submitResponses(payload, 'system')).rejects.toThrow(message);
        expect(responseMock.createMany).not.toHaveBeenCalled();
        expect(inviteMock.updateMany).not.toHaveBeenCalled();
        const logged = JSON.stringify((logger.error as jest.Mock).mock.calls);
        expect(logged).not.toContain(TOKEN);
    };

    test('an unknown or revoked invite (isActive false) is refused with the generic message', async () => {
        // The lookup filters on isActive: true, so a revoked invite is simply not found.
        inviteMock.findFirst.mockResolvedValue(null);
        await expectRefusedWithoutToken('Invalid or inactive invite token');
        expect(inviteMock.findFirst).toHaveBeenCalledWith(
            expect.objectContaining({ where: { token: TOKEN, isActive: true } })
        );
    });

    test('an expired invite is refused and nothing is saved', async () => {
        inviteMock.findFirst.mockResolvedValue(pendingInvite({ expiresAt: new Date(Date.now() - 60_000) }));
        await expectRefusedWithoutToken('Invite has expired');
    });

    test('an already used invite (COMPLETED) is refused and nothing is saved', async () => {
        inviteMock.findFirst.mockResolvedValue(pendingInvite({ status: 'COMPLETED' }));
        await expectRefusedWithoutToken('Responses already submitted for this invite');
    });

    test('an invite with a future expiry is accepted and saved', async () => {
        inviteMock.findFirst.mockResolvedValue(pendingInvite({ expiresAt: new Date(Date.now() + 60_000) }));
        questionMock.findMany.mockResolvedValue([{ id: 'question-a', scaleMin: 1, scaleMax: 5 }]);
        responseMock.createMany.mockResolvedValue({ count: 1 });
        inviteMock.updateMany.mockResolvedValue({ count: 1 });

        const result = await submitResponses(payload, 'system');

        expect(result).toEqual(expect.objectContaining({ success: true, createdCount: 1 }));
        expect(responseMock.createMany).toHaveBeenCalled();
    });
});

// DB-03: response integrity. Every write is bound to the invite, and a refused submission writes nothing.
describe('submitResponses response integrity (DB-03)', () => {
    const TOKEN = 'b'.repeat(64);
    const payload = {
        token: TOKEN,
        studentId: 'student-a',
        responses: [{ questionId: 'question-a', answer: 3 }],
    };
    const invite = (overrides: Record<string, unknown> = {}) => ({
        id: 'invite-a',
        testId: 'test-a',
        studentId: 'student-a',
        status: 'PENDING',
        expiresAt: null,
        test: { instituteId: OWN, isActive: true, institute: { isActive: true } },
        student: { instituteId: OWN, isActive: true },
        ...overrides,
    });
    const questionsOk = [{ id: 'question-a', scaleMin: 1, scaleMax: 5 }];

    // Refusal must not write rows and must not mark the invite as used.
    const expectNothingWritten = () => {
        expect(responseMock.createMany).not.toHaveBeenCalled();
        expect(inviteMock.updateMany).not.toHaveBeenCalled();
    };

    beforeEach(() => {
        inviteMock.findFirst.mockResolvedValue(invite());
        questionMock.findMany.mockResolvedValue(questionsOk);
        responseMock.createMany.mockResolvedValue({ count: 1 });
        inviteMock.updateMany.mockResolvedValue({ count: 1 });
    });

    test('a valid submission writes responses bound to the invite student and marks the invite completed in the same transaction', async () => {
        const result = await submitResponses(payload, 'system');

        expect(result).toEqual(expect.objectContaining({ success: true, createdCount: 1 }));
        expect(prisma.$transaction).toHaveBeenCalledTimes(1);
        expect(inviteMock.updateMany).toHaveBeenCalledWith({
            where: expect.objectContaining({ id: 'invite-a', status: 'PENDING', isActive: true }),
            data: expect.objectContaining({ status: 'COMPLETED' }),
        });
        expect(responseMock.createMany).toHaveBeenCalledWith({
            data: [expect.objectContaining({ questionId: 'question-a', studentId: 'student-a', answer: 3 })],
        });
    });

    test('questions are looked up only within the invited test, its active dimensions, and the institute', async () => {
        await submitResponses(payload, 'system');

        expect(questionMock.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    id: { in: ['question-a'] },
                    isActive: true,
                    dimension: {
                        isActive: true,
                        test: { id: 'test-a', isActive: true, instituteId: OWN },
                    },
                },
            })
        );
    });

    test('a question from another test (same institute) is refused and writes zero rows', async () => {
        questionMock.findMany.mockResolvedValue([]);
        await expect(submitResponses(payload, 'system')).rejects.toThrow('One or more questions are invalid or inactive');
        expectNothingWritten();
    });

    test('a question from a test of another institute is refused and writes zero rows', async () => {
        // The institute is part of the lookup, so a foreign question is never returned.
        questionMock.findMany.mockResolvedValue([]);
        await expect(submitResponses(payload, 'system')).rejects.toThrow('One or more questions are invalid or inactive');
        expectNothingWritten();
    });

    test('a deactivated question is refused and writes zero rows', async () => {
        questionMock.findMany.mockResolvedValue([]);
        await expect(submitResponses(payload, 'system')).rejects.toThrow('One or more questions are invalid or inactive');
        expectNothingWritten();
    });

    test('a question under an inactive dimension or inactive test is refused and writes zero rows', async () => {
        // The lookup filters the dimension and the test, so an inactive parent returns no question.
        questionMock.findMany.mockResolvedValue([]);
        await expect(submitResponses(payload, 'system')).rejects.toThrow('One or more questions are invalid or inactive');
        expect(questionMock.findMany.mock.calls[0][0].where.dimension).toEqual(
            expect.objectContaining({ isActive: true, test: expect.objectContaining({ isActive: true }) })
        );
        expectNothingWritten();
    });

    test('an inactive institute is refused with the generic invite message and writes zero rows (DEC-03)', async () => {
        inviteMock.findFirst.mockResolvedValue(invite({ test: { instituteId: OWN, isActive: true, institute: { isActive: false } } }));
        await expect(submitResponses(payload, 'system')).rejects.toThrow('Invalid or inactive invite token');
        expectNothingWritten();
    });

    test('an inactive invited test is refused with the generic invite message and writes zero rows', async () => {
        inviteMock.findFirst.mockResolvedValue(invite({ test: { instituteId: OWN, isActive: false } }));
        await expect(submitResponses(payload, 'system')).rejects.toThrow('Invalid or inactive invite token');
        expectNothingWritten();
    });

    test('an inactive student is refused with the generic invite message and writes zero rows', async () => {
        inviteMock.findFirst.mockResolvedValue(invite({ student: { instituteId: OWN, isActive: false } }));
        await expect(submitResponses(payload, 'system')).rejects.toThrow('Invalid or inactive invite token');
        expectNothingWritten();
    });

    test('an invite whose student and test are in different institutes is refused and writes zero rows', async () => {
        inviteMock.findFirst.mockResolvedValue(invite({ student: { instituteId: OTHER, isActive: true } }));
        await expect(submitResponses(payload, 'system')).rejects.toThrow('Invalid or inactive invite token');
        expectNothingWritten();
    });

    test('duplicate questionId entries in the payload are refused before any query and write zero rows', async () => {
        const duplicate = {
            ...payload,
            responses: [
                { questionId: 'question-a', answer: 3 },
                { questionId: 'question-a', answer: 4 },
            ],
        };
        await expect(submitResponses(duplicate, 'system')).rejects.toThrow('Duplicate question answers are not allowed');
        expect(inviteMock.findFirst).not.toHaveBeenCalled();
        expectNothingWritten();
    });

    test('a spoofed body studentId cannot assign responses to another student: the submission is refused', async () => {
        await expect(submitResponses({ ...payload, studentId: 'student-b' }, 'system')).rejects.toThrow(
            'Student does not match invite'
        );
        expectNothingWritten();
    });

    test('a re-submission for an already completed invite is refused and writes zero rows', async () => {
        inviteMock.findFirst.mockResolvedValue(invite({ status: 'COMPLETED' }));
        await expect(submitResponses(payload, 'system')).rejects.toThrow('Responses already submitted for this invite');
        expectNothingWritten();
    });

    test('a concurrent second submission that loses the claim writes zero rows and does not rewrite the invite', async () => {
        // Another transaction completed the invite first, so the conditional update matches nothing.
        inviteMock.updateMany.mockResolvedValue({ count: 0 });
        await expect(submitResponses(payload, 'system')).rejects.toThrow('Responses already submitted for this invite');
        expect(responseMock.createMany).not.toHaveBeenCalled();
    });

    test('an answer that is not an integer is refused before any query and writes zero rows', async () => {
        for (const answer of [2.5, '3' as unknown as number, null as unknown as number]) {
            await expect(
                submitResponses({ ...payload, responses: [{ questionId: 'question-a', answer }] }, 'system')
            ).rejects.toThrow('Each response needs a questionId and an integer answer');
        }
        expect(inviteMock.findFirst).not.toHaveBeenCalled();
        expectNothingWritten();
    });

    test('an answer outside the question scale is refused and writes zero rows', async () => {
        await expect(
            submitResponses({ ...payload, responses: [{ questionId: 'question-a', answer: 9 }] }, 'system')
        ).rejects.toThrow('Answer for question question-a must be between 1 and 5');
        expectNothingWritten();
    });

    test('a partial failure in a multi-question payload writes no rows at all', async () => {
        // One valid question and one foreign question: the lookup returns only the valid one, so the whole submission is refused.
        questionMock.findMany.mockResolvedValue([{ id: 'question-a', scaleMin: 1, scaleMax: 5 }]);
        const mixed = {
            ...payload,
            responses: [
                { questionId: 'question-a', answer: 3 },
                { questionId: 'question-foreign', answer: 3 },
            ],
        };
        await expect(submitResponses(mixed, 'system')).rejects.toThrow('One or more questions are invalid or inactive');
        expectNothingWritten();
    });

    test('an empty responses array is refused', async () => {
        await expect(submitResponses({ ...payload, responses: [] }, 'system')).rejects.toThrow('Responses are required');
        expect(inviteMock.findFirst).not.toHaveBeenCalled();
    });
});
