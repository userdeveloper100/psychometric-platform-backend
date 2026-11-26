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

// One dimension with two active questions on a 1..5 scale, and answers of 4 and 2: raw average 3, normalized average 50.
const oneDimension = [
    {
        id: 'dim-a',
        name: 'Openness',
        questions: [
            { id: 'q1', scaleMin: 1, scaleMax: 5 },
            { id: 'q2', scaleMin: 1, scaleMax: 5 },
        ],
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
            inviteMock.findMany.mockResolvedValue([]);
            responseMock.findMany.mockResolvedValue([
                { studentId: 's1', questionId: 'q1', answer: 4 },
                { studentId: 's1', questionId: 'q2', answer: 2 },
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
                expect.objectContaining({ where: expect.objectContaining({ studentId: { in: ['s1'] }, isActive: true }) })
            );
            expect(report).toEqual({
                studentId: 's1',
                testId: 't1',
                status: null,
                dimensions: [{ dimensionId: 'dim-a', dimensionName: 'Openness', score: 3, normalizedScore: 50 }],
                compositeScore: 50,
                percentileRank: null,
                performanceBand: null,
            });
        });

        test('a soft-deleted response does not count (score 0 with no active responses)', async () => {
            studentMock.findFirst.mockResolvedValue({ id: 's1' });
            testMock.findFirst.mockResolvedValue({ id: 't1' });
            dimMock.findMany.mockResolvedValue(oneDimension);
            inviteMock.findMany.mockResolvedValue([]);
            responseMock.findMany.mockResolvedValue([]);

            const report = await getStudentReport('s1', 't1', OWN);

            expect(report.dimensions[0].score).toBe(0);
            expect(report.dimensions[0].normalizedScore).toBeNull();
            expect(report.compositeScore).toBeNull();
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

describe('scoring analytics: cohort, percentile and the institute boundary (DEC scoring engine)', () => {
    // Four invited candidates of institute A. Three completed, one pending.
    // Answers on the 1..5 scale: s1 = 5,5 (100), s2 = 3,3 (50), s3 = 1,1 (0), s4 = 5,5 (100, pending).
    const invitesOfA = [
        { studentId: 's1', status: 'COMPLETED', student: { name: 'Ann' } },
        { studentId: 's2', status: 'COMPLETED', student: { name: 'Ben' } },
        { studentId: 's3', status: 'COMPLETED', student: { name: 'Cy' } },
        { studentId: 's4', status: 'PENDING', student: { name: 'Dee' } },
    ];
    const answersOfA = [
        { studentId: 's1', questionId: 'q1', answer: 5 },
        { studentId: 's1', questionId: 'q2', answer: 5 },
        { studentId: 's2', questionId: 'q1', answer: 3 },
        { studentId: 's2', questionId: 'q2', answer: 3 },
        { studentId: 's3', questionId: 'q1', answer: 1 },
        { studentId: 's3', questionId: 'q2', answer: 1 },
        { studentId: 's4', questionId: 'q1', answer: 5 },
        { studentId: 's4', questionId: 'q2', answer: 5 },
    ];

    beforeEach(() => {
        testMock.findFirst.mockResolvedValue({ id: 't1' });
        dimMock.findMany.mockResolvedValue(oneDimension);
        inviteMock.findMany.mockResolvedValue(invitesOfA);
        responseMock.findMany.mockResolvedValue(answersOfA);
    });

    test('the cohort uses completed candidates only, with mean, median and population standard deviation', async () => {
        const report = await getTestReport('t1', OWN);

        expect(report.cohort.invitedCount).toBe(4);
        expect(report.cohort.completedCount).toBe(3);
        // composites 100, 50, 0: mean 50, median 50, population sd sqrt(5000 / 3) = 40.82
        expect(report.cohort.compositeStatistics).toEqual({
            count: 3,
            mean: 50,
            median: 50,
            stdDev: 40.82,
            min: 0,
            max: 100,
        });
        expect(report.cohort.dimensionAverages).toEqual([
            { dimensionId: 'dim-a', dimensionName: 'Openness', averageNormalizedScore: 50 },
        ]);
    });

    test('each completed candidate has a midrank percentile and a band; a pending candidate has neither', async () => {
        const report = await getTestReport('t1', OWN);
        const byId = Object.fromEntries(report.students.map((s) => [s.studentId, s]));

        // midrank with the candidate in the cohort: s1 (100) = (2 + 0.5) / 3 = 83.33, HIGH. s2 (50) = (1 + 0.5) / 3 = 50, AVERAGE. s3 (0) = (0 + 0.5) / 3 = 16.67, LOW.
        expect(byId.s1).toEqual(expect.objectContaining({ percentileRank: 83.33, performanceBand: 'HIGH', status: 'COMPLETED' }));
        expect(byId.s2).toEqual(expect.objectContaining({ percentileRank: 50, performanceBand: 'AVERAGE' }));
        expect(byId.s3).toEqual(expect.objectContaining({ percentileRank: 16.67, performanceBand: 'LOW' }));
        expect(byId.s4).toEqual(expect.objectContaining({ percentileRank: null, performanceBand: null, status: 'PENDING' }));
    });

    test('the student report ranks the same candidate against the same cohort', async () => {
        studentMock.findFirst.mockResolvedValue({ id: 's2' });

        const report = await getStudentReport('s2', 't1', OWN);

        expect(report).toEqual(
            expect.objectContaining({ status: 'COMPLETED', compositeScore: 50, percentileRank: 50, performanceBand: 'AVERAGE' })
        );
    });

    test('the invite and student queries are limited to the requester institute and to active records', async () => {
        await getTestReport('t1', OWN);

        expect(inviteMock.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { testId: 't1', isActive: true, student: { instituteId: OWN, isActive: true } },
            })
        );
    });

    test('a student of another institute cannot be scored by the student report (not found, no cohort read)', async () => {
        studentMock.findFirst.mockResolvedValue(null);

        await expect(getStudentReport('s-of-b', 't1', OWN)).rejects.toThrow('Student not found');
        expect(inviteMock.findMany).not.toHaveBeenCalled();
    });
});
