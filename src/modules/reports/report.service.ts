import prisma from '../../config/prisma';
import logger from '../../config/logger';
import {
    cohortStatistics,
    CohortStatistics,
    dimensionNormalizedScore,
    dimensionRawScore,
    percentileRank,
    performanceBand,
    PerformanceBand,
    round2,
    weightedComposite,
} from './scoring.engine';

type ReportStatus = 'PENDING' | 'COMPLETED' | null;

type DimensionScore = {
    dimensionId: string;
    dimensionName: string;
    /** Raw mean of the answers, as before the scoring engine. Kept for existing clients. */
    score: number;
    /** Mean of the answers normalized to 0..100 against each question's scale. Null when nothing can be normalized. */
    normalizedScore: number | null;
};

type ScoredStudent = {
    dimensions: DimensionScore[];
    compositeScore: number | null;
    percentileRank: number | null;
    performanceBand: PerformanceBand | null;
};

type StudentReport = ScoredStudent & {
    studentId: string;
    testId: string;
    status: ReportStatus;
};

type TestReport = {
    testId: string;
    cohort: {
        invitedCount: number;
        completedCount: number;
        compositeStatistics: CohortStatistics | null;
        dimensionAverages: Array<{ dimensionId: string; dimensionName: string; averageNormalizedScore: number | null }>;
    };
    students: Array<ScoredStudent & { studentId: string; studentName: string; status: ReportStatus }>;
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

interface ScoringDimension {
    id: string;
    name: string;
    questions: Array<{ id: string; scaleMin: number; scaleMax: number }>;
}

interface ScoringContext {
    dimensions: ScoringDimension[];
    /** Students invited to the test, in the institute, with the invite status. */
    invites: Array<{ studentId: string; studentName: string; status: 'PENDING' | 'COMPLETED' }>;
    /** Active answers per student for the active questions of the test. */
    answers: Map<string, Array<{ questionId: string; answer: number }>>;
}

/**
 * Loads everything the scores need for one test in a fixed number of queries. Only active test, dimensions,
 * questions, invites, students and responses count. The test must be active and in the institute.
 * `extraStudentIds` adds students that are scored but not listed (the student report).
 */
const loadScoringContext = async (testId: string, scope: string, extraStudentIds: string[] = []): Promise<ScoringContext> => {
    const test = await prisma.psychometricTest.findFirst({
        where: { id: testId, instituteId: scope, isActive: true },
        select: { id: true }
    });
    if (!test) throw new Error('Test not found');

    const dimensions = await prisma.dimension.findMany({
        where: { testId, isActive: true },
        select: {
            id: true,
            name: true,
            questions: {
                where: { isActive: true },
                select: { id: true, scaleMin: true, scaleMax: true }
            }
        }
    });
    const questionIds = dimensions.flatMap((d) => d.questions.map((q) => q.id));

    const invites = await prisma.testInvite.findMany({
        where: {
            testId,
            isActive: true,
            student: { instituteId: scope, isActive: true }
        },
        select: {
            studentId: true,
            status: true,
            student: { select: { name: true } }
        }
    });

    const studentIds = [...new Set([...invites.map((i) => i.studentId), ...extraStudentIds])];
    const responses = studentIds.length && questionIds.length
        ? await prisma.response.findMany({
            where: {
                studentId: { in: studentIds },
                isActive: true,
                questionId: { in: questionIds }
            },
            select: { studentId: true, questionId: true, answer: true }
        })
        : [];

    const answers = new Map<string, Array<{ questionId: string; answer: number }>>();
    for (const r of responses) {
        const list = answers.get(r.studentId) ?? [];
        list.push({ questionId: r.questionId, answer: Number(r.answer) });
        answers.set(r.studentId, list);
    }

    return {
        dimensions,
        invites: invites.map((i) => ({
            studentId: i.studentId,
            studentName: i.student.name,
            status: i.status
        })),
        answers
    };
};

/** Scores one student from the context. Equal weights, because the schema has no dimension weight. */
const scoreStudent = (ctx: ScoringContext, studentId: string): Omit<ScoredStudent, 'percentileRank' | 'performanceBand'> => {
    const rows = ctx.answers.get(studentId) ?? [];
    const dimensions: DimensionScore[] = ctx.dimensions.map((dimension) => {
        const scaleByQuestion = new Map(dimension.questions.map((q) => [q.id, q]));
        const dimRows = rows.filter((r) => scaleByQuestion.has(r.questionId));
        const normalizedScore = dimensionNormalizedScore(
            dimRows.map((r) => {
                const q = scaleByQuestion.get(r.questionId)!;
                return { answer: r.answer, scaleMin: q.scaleMin, scaleMax: q.scaleMax };
            })
        );
        return {
            dimensionId: dimension.id,
            dimensionName: dimension.name,
            score: dimensionRawScore(dimRows.map((r) => r.answer)),
            normalizedScore
        };
    });

    return {
        dimensions,
        compositeScore: weightedComposite(dimensions.map((d) => ({ score: d.normalizedScore })))
    };
};

/**
 * Scores every student in the context, then ranks each completed candidate against the completed cohort of the same
 * test and institute. A pending candidate has no percentile. The cohort never includes another institute.
 */
const analyse = (ctx: ScoringContext, studentIds: string[]) => {
    const statusOf = new Map(ctx.invites.map((i) => [i.studentId, i.status as ReportStatus]));
    const scored = new Map(studentIds.map((id) => [id, scoreStudent(ctx, id)]));

    const completedIds = ctx.invites.filter((i) => i.status === 'COMPLETED').map((i) => i.studentId);
    const cohortComposites = completedIds
        .map((id) => scored.get(id)?.compositeScore)
        .filter((v): v is number => typeof v === 'number');

    const withRank = (id: string): ScoredStudent & { status: ReportStatus } => {
        const s = scored.get(id)!;
        const status = statusOf.get(id) ?? null;
        const pct = status === 'COMPLETED' && s.compositeScore !== null
            ? percentileRank(s.compositeScore, cohortComposites)
            : null;
        return { ...s, percentileRank: pct, performanceBand: performanceBand(pct), status };
    };

    const cohortDimensionAverages = ctx.dimensions.map((dimension, index) => {
        const values = completedIds
            .map((id) => scored.get(id)?.dimensions[index]?.normalizedScore)
            .filter((v): v is number => typeof v === 'number');
        return {
            dimensionId: dimension.id,
            dimensionName: dimension.name,
            averageNormalizedScore: values.length ? round2(values.reduce((s, v) => s + v, 0) / values.length) : null
        };
    });

    return {
        withRank,
        cohort: {
            invitedCount: ctx.invites.length,
            completedCount: completedIds.length,
            compositeStatistics: cohortStatistics(cohortComposites),
            dimensionAverages: cohortDimensionAverages
        }
    };
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

        const ctx = await loadScoringContext(testId, scope, [studentId]);
        const { withRank } = analyse(ctx, [...new Set([...ctx.invites.map((i) => i.studentId), studentId])]);
        const own = withRank(studentId);

        return { studentId, testId, ...own };
    } catch (error) {
        logger.error('Failed to generate student report', {
            studentId,
            testId,
            error: error instanceof Error ? error.message : error
        });
        throw error instanceof Error ? error : new Error('Failed to generate student report');
    }
};

/**
 * SEC-10: the test must be active and in the institute. Only active students of the institute are included.
 */
export const getTestReport = async (testId: string, instituteId: string): Promise<TestReport> => {
    if (!testId) throw new Error('testId is required');
    const scope = requireInstitute(instituteId);

    try {
        const ctx = await loadScoringContext(testId, scope);
        const invitedIds = ctx.invites.map((i) => i.studentId);
        const { withRank, cohort } = analyse(ctx, invitedIds);

        return {
            testId,
            cohort,
            students: ctx.invites.map((invite) => ({
                studentId: invite.studentId,
                studentName: invite.studentName,
                ...withRank(invite.studentId)
            }))
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
