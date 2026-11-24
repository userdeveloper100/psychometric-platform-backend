import prisma from '../../config/prisma';
import { countResponses, deleteResponse, getAllResponses, getStudentResponses, getTestResponses } from './response.service';

jest.mock('../../config/prisma', () => ({
    __esModule: true,
    default: {
        response: {
            findMany: jest.fn(),
            findFirst: jest.fn(),
            update: jest.fn(),
            count: jest.fn(),
        },
        student: { findFirst: jest.fn() },
        psychometricTest: { findFirst: jest.fn() },
    },
}));
jest.mock('../../config/logger', () => ({
    __esModule: true,
    default: { error: jest.fn() },
}));

const responseMock = prisma.response as unknown as Record<'findMany' | 'findFirst' | 'update' | 'count', jest.Mock>;
const studentMock = prisma.student as unknown as { findFirst: jest.Mock };
const testMock = prisma.psychometricTest as unknown as { findFirst: jest.Mock };

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
