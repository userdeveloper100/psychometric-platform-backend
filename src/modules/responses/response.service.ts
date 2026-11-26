import { InviteStatus } from '@prisma/client';
import prisma from '../../config/prisma';
import logger from '../../config/logger';
import { findUsableInvite } from '../invites/invite-validation';

export interface SubmitResponseItem {
    questionId: string;
    answer: number;
}

export interface SubmitResponsesInput {
    token: string;
    studentId: string;
    responses: SubmitResponseItem[];
}

interface GetAllResponsesOptions {
    page?: number;
    limit?: number;
    instituteId: string;
}

/**
 * SEC-03: every response read and delete is scoped to the caller's institute through the
 * relationship chain (response -> student, and response -> question -> dimension -> test).
 * Both links must match, so a response is only visible when both parents belong to the institute.
 */
const responseInInstitute = (instituteId: string) => ({
    isActive: true,
    student: { instituteId },
    question: { dimension: { test: { instituteId } } },
});

/** Fail-closed guard: an empty scope never falls through to an unscoped query. */
const requireInstitute = (instituteId: string | undefined): string => {
    if (!instituteId) throw new Error('Institute scope is required');
    return instituteId;
};

/**
 * DB-03: a submission is accepted only if it is bound to a valid invite. The invite decides the student,
 * the test and the institute. Body values for those are used only to check that they match, never to write.
 * Every check and every write runs in one transaction, so a refused submission leaves no partial rows.
 */
export const submitResponses = async (data: SubmitResponsesInput, userId: string) => {
    const { token, studentId, responses } = data;

    if (!token) throw new Error('Token is required');
    if (!studentId) throw new Error('Student ID is required');
    if (!Array.isArray(responses) || responses.length === 0) throw new Error('Responses are required');

    // Payload shape checks need no database read. Each one refuses the submission before any query runs.
    const isWellFormed = responses.every(
        (r) => typeof r.questionId === 'string' && r.questionId.length > 0 && Number.isInteger(r.answer)
    );
    if (!isWellFormed) throw new Error('Each response needs a questionId and an integer answer');

    const questionIds = responses.map((r) => r.questionId);
    if (new Set(questionIds).size !== questionIds.length) {
        throw new Error('Duplicate question answers are not allowed');
    }

    try {
        const now = new Date();

        const result = await prisma.$transaction(async (tx) => {
            // 1-4) The invite is the only source of truth for the student, the test and the institute. The shared
            //      rules (SEC-05, DEC-03) check that it exists, is pending and unexpired, matches the body studentId,
            //      and that the test, the student and the institute are all active. Messages never include the token.
            const invite = await findUsableInvite(tx, token, now, studentId);

            // 5) Every question must be active, under an active dimension, of the invited test. A question from
            //    another test, another institute, or an inactive parent is missing from this result and refused.
            const questions = await tx.question.findMany({
                where: {
                    id: { in: questionIds },
                    isActive: true,
                    dimension: {
                        isActive: true,
                        test: {
                            id: invite.testId,
                            isActive: true,
                            instituteId: invite.test.instituteId
                        }
                    }
                },
                select: {
                    id: true,
                    scaleMin: true,
                    scaleMax: true
                }
            });

            if (questions.length !== questionIds.length) {
                throw new Error('One or more questions are invalid or inactive');
            }

            // 6) Each answer must be inside the question's scale.
            const questionMap = new Map(questions.map((q) => [q.id, q]));
            for (const response of responses) {
                const question = questionMap.get(response.questionId);
                if (!question) throw new Error('One or more questions are invalid or inactive');

                if (response.answer < question.scaleMin || response.answer > question.scaleMax) {
                    throw new Error(
                        `Answer for question ${response.questionId} must be between ${question.scaleMin} and ${question.scaleMax}`
                    );
                }
            }

            // 7) Claim the invite before writing. The update matches only a pending, unexpired invite. A concurrent
            //    second submission waits on the row lock, re-checks, matches nothing, and rolls back with no rows.
            const claimed = await tx.testInvite.updateMany({
                where: {
                    id: invite.id,
                    isActive: true,
                    status: InviteStatus.PENDING,
                    OR: [{ expiresAt: null }, { expiresAt: { gt: now } }]
                },
                data: {
                    status: InviteStatus.COMPLETED,
                    updatedBy: userId,
                    updatedAt: now
                }
            });
            if (claimed.count !== 1) throw new Error('Responses already submitted for this invite');

            // 8) Save responses. The student comes from the invite, not from the request body.
            return tx.response.createMany({
                data: responses.map((r) => ({
                    questionId: r.questionId,
                    studentId: invite.studentId,
                    answer: r.answer,
                    createdBy: userId,
                    createdAt: now,
                    isActive: true
                }))
            });
        }, {
            // A concurrent second submission waits on the invite row lock until the first commits. That wait can exceed
            // Prisma's default 2s start window, which would surface as a 500 instead of the 400 refusal.
            maxWait: 5000,
            timeout: 10000
        });

        return {
            success: true,
            message: 'Responses submitted successfully',
            createdCount: result.count
        };
    } catch (error) {
        logger.error('Failed to submit responses', {
            error: error instanceof Error ? error.message : error
        });
        throw error instanceof Error ? error : new Error('Failed to submit responses');
    }
};

export const getStudentResponses = async (studentId: string, instituteId: string) => {
    if (!studentId) throw new Error('Student ID is required');
    const scope = requireInstitute(instituteId);

    try {
        // A student outside the institute is reported as not found, so existence is not leaked.
        const student = await prisma.student.findFirst({
            where: { id: studentId, instituteId: scope },
            select: { id: true }
        });
        if (!student) throw new Error('Student not found');

        return await prisma.response.findMany({
            where: {
                ...responseInInstitute(scope),
                studentId
            },
            include: {
                question: true
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
    } catch (error) {
        logger.error('Failed to fetch student responses', {
            error: error instanceof Error ? error.message : error
        });
        throw error instanceof Error ? error : new Error('Failed to fetch student responses');
    }
};

export const getTestResponses = async (testId: string, instituteId: string) => {
    if (!testId) throw new Error('Test ID is required');
    const scope = requireInstitute(instituteId);

    try {
        // A test outside the institute is reported as not found, so existence is not leaked.
        const test = await prisma.psychometricTest.findFirst({
            where: { id: testId, instituteId: scope, isActive: true },
            select: { id: true }
        });
        if (!test) throw new Error('Test not found');

        return await prisma.response.findMany({
            where: {
                ...responseInInstitute(scope),
                question: {
                    isActive: true,
                    dimension: {
                        isActive: true,
                        test: {
                            id: testId,
                            isActive: true
                        }
                    }
                }
            },
            include: {
                question: {
                    include: {
                        dimension: {
                            include: {
                                test: true
                            }
                        }
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
    } catch (error) {
        logger.error('Failed to fetch test responses', {
            error: error instanceof Error ? error.message : error
        });
        throw error instanceof Error ? error : new Error('Failed to fetch test responses');
    }
};

export const getAllResponses = async ({
    page = 1,
    limit = 10,
    instituteId
}: GetAllResponsesOptions) => {
    const scope = requireInstitute(instituteId);
    const currentPage = Number(page) || 1;
    const currentLimit = Number(limit) || 10;
    const skip = (currentPage - 1) * currentLimit;

    try {
        return await prisma.response.findMany({
            where: responseInInstitute(scope),
            skip,
            take: currentLimit,
            orderBy: { createdAt: 'desc' }
        });
    } catch (error) {
        logger.error('Failed to fetch responses', {
            error: error instanceof Error ? error.message : error
        });
        throw error instanceof Error ? error : new Error('Failed to fetch responses');
    }
};

/** Total for pagination, with the same institute scope as getAllResponses so the count cannot leak other tenants. */
export const countResponses = async (instituteId: string) => {
    const scope = requireInstitute(instituteId);
    return prisma.response.count({ where: responseInInstitute(scope) });
};

export const deleteResponse = async (responseId: string, userId: string, instituteId: string) => {
    if (!responseId) throw new Error('Response ID is required');
    const scope = requireInstitute(instituteId);

    try {
        // Scoped lookup first. A response in another institute is reported as not found and is never updated.
        const response = await prisma.response.findFirst({
            where: {
                id: responseId,
                ...responseInInstitute(scope)
            }
        });

        if (!response) {
            throw new Error('Response not found');
        }

        return await prisma.response.update({
            where: { id: responseId },
            data: {
                isActive: false,
                updatedBy: userId,
                updatedAt: new Date()
            }
        });
    } catch (error) {
        logger.error('Failed to delete response', {
            error: error instanceof Error ? error.message : error
        });
        throw error instanceof Error ? error : new Error('Failed to delete response');
    }
};
