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

<<<<<<< HEAD
interface GetAllResponsesOptions {
    page?: number;
    limit?: number;
}

=======
>>>>>>> 11519917377035306673a076a7e613f111ba9d8f
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

export const getStudentResponses = async (studentId: string) => {
    if (!studentId) throw new Error('Student ID is required');

    try {
        return await prisma.response.findMany({
            where: {
                studentId,
                isActive: true
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

export const getTestResponses = async (testId: string) => {
    if (!testId) throw new Error('Test ID is required');

    try {
        return await prisma.response.findMany({
            where: {
                isActive: true,
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
<<<<<<< HEAD

export const getAllResponses = async ({
    page = 1,
    limit = 10
}: GetAllResponsesOptions = {}) => {
    const currentPage = Number(page) || 1;
    const currentLimit = Number(limit) || 10;
    const skip = (currentPage - 1) * currentLimit;

    try {
        return await prisma.response.findMany({
            where: { isActive: true },
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
=======
>>>>>>> 11519917377035306673a076a7e613f111ba9d8f
