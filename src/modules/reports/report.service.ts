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

export const getStudentReport = async (studentId: string, testId: string): Promise<StudentReport> => {
    if (!studentId) throw new Error('studentId is required');
    if (!testId) throw new Error('testId is required');

    try {
        // 1,2) Get dimensions + questions for the test
        const dimensions = await prisma.dimension.findMany({
            where: { testId },
            select: {
                id: true,
                name: true,
                questions: {
                    select: { id: true }
                }
            }
        });

        const questionIds = dimensions.flatMap((d) => d.questions.map((q) => q.id));

        // 3) Get active responses of student for those questions
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
        const dimensionScores: DimensionScore[] = dimensions.map((dimension) => {
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

        // 6) Return report structure
        return {
            studentId,
            testId,
            dimensions: dimensionScores
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

export const getTestReport = async (testId: string): Promise<TestReport> => {
    if (!testId) throw new Error('testId is required');

    try {
        // 1) Get students invited to this test
        const invites = await prisma.testInvite.findMany({
            where: {
                testId,
                isActive: true
            },
            select: {
                studentId: true
            },
            distinct: ['studentId']
        });

        // 2) Generate each student report
        const students = await Promise.all(
            invites.map(async (invite) => {
                const report = await getStudentReport(invite.studentId, testId);
                return {
                    studentId: invite.studentId,
                    dimensions: report.dimensions
                };
            })
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
