import { InviteStatus } from '@prisma/client';
import prisma from '../../config/prisma';
import logger from '../../config/logger';

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

export const submitResponses = async (data: SubmitResponsesInput, userId: string) => {
    const { token, studentId, responses } = data;

    if (!token) throw new Error('Token is required');
    if (!studentId) throw new Error('Student ID is required');
    if (!responses || responses.length === 0) throw new Error('Responses are required');

    try {
        const now = new Date();

        const result = await prisma.$transaction(async (tx) => {
            // 1) Find invite
            const invite = await tx.testInvite.findFirst({
                where: {
                    token,
                    isActive: true
                }
            });

            // 2) Invite must exist
            if (!invite) throw new Error('Invalid or inactive invite token');

            // 3) Invite should be pending
            if (invite.status === InviteStatus.COMPLETED) {
                throw new Error('Responses already submitted for this invite');
            }

            // 4) Student must match invite
            if (invite.studentId !== studentId) {
                throw new Error('Student does not match invite');
            }

            // 5) Validate questions
            const questionIds = [...new Set(responses.map((r) => r.questionId))];

            const questions = await tx.question.findMany({
                where: {
                    id: { in: questionIds },
                    isActive: true
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

            const questionMap = new Map(questions.map((q) => [q.id, q]));

            // 6) Validate answers in range
            for (const response of responses) {
                const question = questionMap.get(response.questionId);
                if (!question) throw new Error(`Question not found: ${response.questionId}`);

                if (response.answer < question.scaleMin || response.answer > question.scaleMax) {
                    throw new Error(
                        `Answer for question ${response.questionId} must be between ${question.scaleMin} and ${question.scaleMax}`
                    );
                }
            }

            // 7,8) Save responses
            const createResult = await tx.response.createMany({
                data: responses.map((r) => ({
                    questionId: r.questionId,
                    studentId,
                    answer: r.answer,
                    createdBy: userId,
                    createdAt: now,
                    isActive: true
                }))
            });

            // 9,10) Update invite
            await tx.testInvite.update({
                where: { id: invite.id },
                data: {
                    status: InviteStatus.COMPLETED,
                    updatedBy: userId,
                    updatedAt: now
                }
            });

            return createResult;
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
