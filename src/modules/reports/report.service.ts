import prisma from '../../config/prisma';
import logger from '../../config/logger';

type DimensionScore = {
    dimensionId: string;
    dimensionName: string;
    score: number;
};

type StudentReport = {
    studentId: string;
    testId: string;
    dimensions: DimensionScore[];
};

type TestReport = {
    testId: string;
    students: Array<{
        studentId: string;
        dimensions: DimensionScore[];
    }>;
};

interface GetAllReportsOptions {
    page?: number;
    limit?: number;
    instituteId: string;
}

/** Fail-closed guard: an empty scope never falls through to an unscoped query. */
const requireInstitute = (instituteId: string | undefined): string => {
    if (!instituteId) throw new Error('Institute scope is required');
    return instituteId;
};

/**
 * Scores one student on one test. Only active dimensions, active questions and active responses count.
 * Callers must have already checked that the student and the test belong to the institute.
 */
const buildStudentScores = async (studentId: string, testId: string): Promise<DimensionScore[]> => {
    // 1,2) Active dimensions and active questions of the test
    const dimensions = await prisma.dimension.findMany({
        where: { testId, isActive: true },
        select: {
            id: true,
            name: true,
            questions: {
                where: { isActive: true },
                select: { id: true }
            }
        }
    });

    const questionIds = dimensions.flatMap((d) => d.questions.map((q) => q.id));

    // 3) Active responses of the student for those questions
    const responses = questionIds.length
        ? await prisma.response.findMany({
            where: {
                studentId,
                isActive: true,
                questionId: { in: questionIds }
            },
            select: {
                questionId: true,
                answer: true
            }
        })
        : [];

    // 4,5) Map to dimensions and calculate averages
    return dimensions.map((dimension) => {
        const dimQuestionIds = new Set(dimension.questions.map((q) => q.id));
        const dimResponses = responses.filter((r) => dimQuestionIds.has(r.questionId));

        const score =
            dimResponses.length > 0
                ? Number(
                    (
                        dimResponses.reduce((sum, r) => sum + Number(r.answer), 0) /
                        dimResponses.length
                    ).toFixed(2)
                )
                : 0;

        return {
            dimensionId: dimension.id,
            dimensionName: dimension.name,
            score
        };
    });
};

/**
 * SEC-10: the student and the test must both be active and belong to the caller's institute.
 * A student or test of another institute is reported as not found, so existence is not leaked.
 */
export const getStudentReport = async (
    studentId: string,
    testId: string,
    instituteId: string
): Promise<StudentReport> => {
    if (!studentId) throw new Error('studentId is required');
    if (!testId) throw new Error('testId is required');
    const scope = requireInstitute(instituteId);

    try {
        const student = await prisma.student.findFirst({
            where: { id: studentId, instituteId: scope, isActive: true },
            select: { id: true }
        });
        if (!student) throw new Error('Student not found');

        const test = await prisma.psychometricTest.findFirst({
            where: { id: testId, instituteId: scope, isActive: true },
            select: { id: true }
        });
        if (!test) throw new Error('Test not found');

        return {
            studentId,
            testId,
            dimensions: await buildStudentScores(studentId, testId)
        };
    } catch (error) {
        logger.error('Failed to generate student report', {
            studentId,
            testId,
            error: error instanceof Error ? error.message : error
        });
        throw error instanceof Error ? error : new Error('Failed to generate student report');
    }
};

/** SEC-10: the test must be active and in the institute. Only active students of the institute are included. */
export const getTestReport = async (testId: string, instituteId: string): Promise<TestReport> => {
    if (!testId) throw new Error('testId is required');
    const scope = requireInstitute(instituteId);

    try {
        const test = await prisma.psychometricTest.findFirst({
            where: { id: testId, instituteId: scope, isActive: true },
            select: { id: true }
        });
        if (!test) throw new Error('Test not found');

        // 1) Students invited to this test, limited to active students of the institute
        const invites = await prisma.testInvite.findMany({
            where: {
                testId,
                isActive: true,
                student: { instituteId: scope, isActive: true }
            },
            select: {
                studentId: true
            },
            distinct: ['studentId']
        });

        // 2) Score each student with the same rules as the student report
        const students = await Promise.all(
            invites.map(async (invite) => ({
                studentId: invite.studentId,
                dimensions: await buildStudentScores(invite.studentId, testId)
            }))
        );

        // 3) Return aggregated report
        return {
            testId,
            students
        };
    } catch (error) {
        logger.error('Failed to generate test report', {
            testId,
            error: error instanceof Error ? error.message : error
        });
        throw error instanceof Error ? error : new Error('Failed to generate test report');
    }
};

/** SEC-10: the list of tests is limited to the caller's institute and to active tests. */
export const getAllReports = async ({
    page = 1,
    limit = 10,
    instituteId
}: GetAllReportsOptions) => {
    const scope = requireInstitute(instituteId);
    const currentPage = Number(page) || 1;
    const currentLimit = Number(limit) || 10;
    const skip = (currentPage - 1) * currentLimit;

    try {
        return await prisma.psychometricTest.findMany({
            where: { isActive: true, instituteId: scope },
            skip,
            take: currentLimit,
            orderBy: { createdAt: 'desc' }
        });
    } catch (error) {
        logger.error('Failed to fetch reports', {
            error: error instanceof Error ? error.message : error
        });
        throw error instanceof Error ? error : new Error('Failed to fetch reports');
    }
};

/** Total for pagination, with the same scope as getAllReports. */
export const countReports = async (instituteId: string) => {
    const scope = requireInstitute(instituteId);
    return prisma.psychometricTest.count({ where: { isActive: true, instituteId: scope } });
};
