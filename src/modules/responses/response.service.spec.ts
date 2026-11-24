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
        testInvite: { findFirst: jest.fn(), update: jest.fn() },
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
const inviteMock = prisma.testInvite as unknown as { findFirst: jest.Mock; update: jest.Mock };
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
        studentId: 'student-a',
        status: 'PENDING',
        expiresAt: null,
        ...overrides,
    });

    const expectRefusedWithoutToken = async (message: string) => {
        await expect(submitResponses(payload, 'system')).rejects.toThrow(message);
        expect(responseMock.createMany).not.toHaveBeenCalled();
        expect(inviteMock.update).not.toHaveBeenCalled();
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
        inviteMock.update.mockResolvedValue({});

        const result = await submitResponses(payload, 'system');

        expect(result).toEqual(expect.objectContaining({ success: true, createdCount: 1 }));
        expect(responseMock.createMany).toHaveBeenCalled();
    });
});
