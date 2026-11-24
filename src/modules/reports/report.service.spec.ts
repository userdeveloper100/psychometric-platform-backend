import prisma from '../../config/prisma';
import { countReports, getAllReports, getStudentReport, getTestReport } from './report.service';

jest.mock('../../config/prisma', () => ({
    __esModule: true,
    default: {
        psychometricTest: { findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn() },
        student: { findFirst: jest.fn() },
        dimension: { findMany: jest.fn() },
        response: { findMany: jest.fn() },
        testInvite: { findMany: jest.fn() },
    },
}));
jest.mock('../../config/logger', () => ({
    __esModule: true,
    default: { error: jest.fn() },
}));

const testMock = prisma.psychometricTest as unknown as Record<'findFirst' | 'findMany' | 'count', jest.Mock>;
const studentMock = prisma.student as unknown as { findFirst: jest.Mock };
const dimMock = prisma.dimension as unknown as { findMany: jest.Mock };
const responseMock = prisma.response as unknown as { findMany: jest.Mock };
const inviteMock = prisma.testInvite as unknown as { findMany: jest.Mock };

const OWN = 'institute-a';
const OTHER = 'institute-b';

beforeEach(() => {
    jest.clearAllMocks();
});

// One dimension with two active questions, and answers of 4 and 2 (average 3).
const oneDimension = [
    {
        id: 'dim-a',
        name: 'Openness',
        questions: [{ id: 'q1' }, { id: 'q2' }],
    },
];

describe('report.service tenant scope and active records (SEC-10)', () => {
    describe('getStudentReport', () => {
        test('fail closed: no instituteId throws and nothing is read', async () => {
            await expect(getStudentReport('s1', 't1', '')).rejects.toThrow('Institute scope is required');
            expect(studentMock.findFirst).not.toHaveBeenCalled();
            expect(dimMock.findMany).not.toHaveBeenCalled();
        });

        test('a student of another institute is not found and no response is read', async () => {
            studentMock.findFirst.mockResolvedValue(null);
            await expect(getStudentReport('student-b', 't1', OWN)).rejects.toThrow('Student not found');
            expect(studentMock.findFirst).toHaveBeenCalledWith(
                expect.objectContaining({ where: { id: 'student-b', instituteId: OWN, isActive: true } })
            );
            expect(responseMock.findMany).not.toHaveBeenCalled();
        });

        test('an inactive or foreign test is not found and no response is read', async () => {
            studentMock.findFirst.mockResolvedValue({ id: 's1' });
            testMock.findFirst.mockResolvedValue(null);
            await expect(getStudentReport('s1', 't-inactive', OWN)).rejects.toThrow('Test not found');
            expect(testMock.findFirst).toHaveBeenCalledWith(
                expect.objectContaining({ where: { id: 't-inactive', instituteId: OWN, isActive: true } })
            );
            expect(dimMock.findMany).not.toHaveBeenCalled();
        });

        test('an own student and test are scored from active dimensions, questions and responses only', async () => {
            studentMock.findFirst.mockResolvedValue({ id: 's1' });
            testMock.findFirst.mockResolvedValue({ id: 't1' });
            dimMock.findMany.mockResolvedValue(oneDimension);
            responseMock.findMany.mockResolvedValue([
                { questionId: 'q1', answer: 4 },
                { questionId: 'q2', answer: 2 },
            ]);

            const report = await getStudentReport('s1', 't1', OWN);

            expect(dimMock.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { testId: 't1', isActive: true },
                    select: expect.objectContaining({
                        questions: expect.objectContaining({ where: { isActive: true } }),
                    }),
                })
            );
            expect(responseMock.findMany).toHaveBeenCalledWith(
                expect.objectContaining({ where: expect.objectContaining({ studentId: 's1', isActive: true }) })
            );
            expect(report).toEqual({
                studentId: 's1',
                testId: 't1',
                dimensions: [{ dimensionId: 'dim-a', dimensionName: 'Openness', score: 3 }],
            });
        });

        test('a soft-deleted response does not count (score 0 with no active responses)', async () => {
            studentMock.findFirst.mockResolvedValue({ id: 's1' });
            testMock.findFirst.mockResolvedValue({ id: 't1' });
            dimMock.findMany.mockResolvedValue(oneDimension);
            responseMock.findMany.mockResolvedValue([]);

            const report = await getStudentReport('s1', 't1', OWN);

            expect(report.dimensions[0].score).toBe(0);
        });
    });

    describe('getTestReport', () => {
        test('fail closed: no instituteId throws and nothing is read', async () => {
            await expect(getTestReport('t1', '')).rejects.toThrow('Institute scope is required');
            expect(testMock.findFirst).not.toHaveBeenCalled();
            expect(inviteMock.findMany).not.toHaveBeenCalled();
        });

        test('a test of another institute (or inactive) is not found and no invite is read', async () => {
            testMock.findFirst.mockResolvedValue(null);
            await expect(getTestReport('t-b', OWN)).rejects.toThrow('Test not found');
            expect(testMock.findFirst).toHaveBeenCalledWith(
                expect.objectContaining({ where: { id: 't-b', instituteId: OWN, isActive: true } })
            );
            expect(inviteMock.findMany).not.toHaveBeenCalled();
        });

        test('only active invites of active students of the institute are included', async () => {
            testMock.findFirst.mockResolvedValue({ id: 't1' });
            inviteMock.findMany.mockResolvedValue([]);

            await getTestReport('t1', OWN);

            expect(inviteMock.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: {
                        testId: 't1',
                        isActive: true,
                        student: { instituteId: OWN, isActive: true },
                    },
                })
            );
        });
    });

    describe('getAllReports and countReports', () => {
        test('the list is limited to the requester institute and active tests', async () => {
            testMock.findMany.mockResolvedValue([]);
            await getAllReports({ page: 1, limit: 10, instituteId: OWN });
            expect(testMock.findMany).toHaveBeenCalledWith(
                expect.objectContaining({ where: { isActive: true, instituteId: OWN } })
            );
        });

        test('the count uses the same scope', async () => {
            testMock.count.mockResolvedValue(2);
            expect(await countReports(OWN)).toBe(2);
            expect(testMock.count).toHaveBeenCalledWith({ where: { isActive: true, instituteId: OWN } });
        });

        test('fail closed without an institute and never queries', async () => {
            await expect(getAllReports({ page: 1, limit: 10, instituteId: '' })).rejects.toThrow(
                'Institute scope is required'
            );
            await expect(countReports('')).rejects.toThrow('Institute scope is required');
            expect(testMock.findMany).not.toHaveBeenCalled();
            expect(testMock.count).not.toHaveBeenCalled();
        });

        test('a different institute id gets a different scope', async () => {
            testMock.findMany.mockResolvedValue([]);
            await getAllReports({ page: 1, limit: 10, instituteId: OTHER });
            expect(testMock.findMany).toHaveBeenCalledWith(
                expect.objectContaining({ where: { isActive: true, instituteId: OTHER } })
            );
        });
    });
});
