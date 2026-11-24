import prisma from '../../config/prisma';
import { Prisma } from '@prisma/client';
import { cascadeSoftDelete } from '../../utils/softDelete';

interface CreateQuestionInput {
    text: string;
    scaleMin?: number;
    scaleMax?: number;
}

interface GetAllQuestionsOptions {
    page?: number;
    limit?: number;
    instituteId: string;
}

/**
 * SEC-06: a question is in scope only when its whole parent chain is active and belongs to the
 * caller's institute: question -> dimension -> test -> institute.
 */
const questionInInstitute = (instituteId: string) => ({
    isActive: true,
    dimension: {
        isActive: true,
        test: { instituteId, isActive: true },
    },
});

/** A dimension is in scope only when its parent test is active and belongs to the caller's institute. */
const dimensionInInstitute = (instituteId: string) => ({
    isActive: true,
    test: { instituteId, isActive: true },
});

/** Fail-closed guard: an empty scope never falls through to an unscoped query. */
const requireInstitute = (instituteId: string | undefined): string => {
    if (!instituteId) throw new Error('Institute scope is required');
    return instituteId;
};

export async function createQuestion(
    dimensionId: string,
    { text, scaleMin = 1, scaleMax = 5 }: CreateQuestionInput,
    instituteId: string
) {
    const scope = requireInstitute(instituteId);
    try {
        // Parent dimension and test must be active and belong to the caller's institute before anything is written.
        const dimension = await prisma.dimension.findFirst({
            where: { id: dimensionId, ...dimensionInInstitute(scope) },
            select: { id: true }
        });

        if (!dimension) {
            throw new Error('Dimension not found');
        }

        if (scaleMin >= scaleMax) {
            throw new Error('scaleMin must be less than scaleMax');
        }

        const question = await prisma.question.create({
            data: {
                text,
                dimensionId,
                scaleMin,
                scaleMax,
                isActive: true
            }
        });

        return question;
    } catch (error) {
        if (error instanceof Error) throw error;
        throw new Error('Failed to create question');
    }
}

export async function getDimensionQuestions(dimensionId: string, instituteId: string) {
    const scope = requireInstitute(instituteId);
    try {
        const dimension = await prisma.dimension.findFirst({
            where: { id: dimensionId, ...dimensionInInstitute(scope) },
            select: { id: true }
        });

        if (!dimension) {
            throw new Error('Dimension not found');
        }

        return await prisma.question.findMany({
            where: { dimensionId, isActive: true },
            orderBy: { createdAt: 'asc' }
        });
    } catch (error) {
        if (error instanceof Error) throw error;
        throw new Error('Failed to fetch questions');
    }
}

export async function getAllQuestions({
    page = 1,
    limit = 10,
    instituteId
}: GetAllQuestionsOptions) {
    const scope = requireInstitute(instituteId);
    const currentPage = Number(page) || 1;
    const currentLimit = Number(limit) || 10;
    const skip = (currentPage - 1) * currentLimit;

    return prisma.question.findMany({
        where: questionInInstitute(scope),
        skip,
        take: currentLimit,
        orderBy: { createdAt: 'desc' }
    });
}

/** Total for pagination, scoped the same way as getAllQuestions. */
export async function countQuestions(instituteId: string) {
    const scope = requireInstitute(instituteId);
    return prisma.question.count({ where: questionInInstitute(scope) });
}

export async function deleteQuestion(questionId: string, userId: string, instituteId: string) {
    const scope = requireInstitute(instituteId);
    try {
        // Ownership is checked before the cascade. A foreign question is reported as not found and never touched.
        const question = await prisma.question.findFirst({
            where: {
                id: questionId,
                ...questionInInstitute(scope)
            }
        });

        if (!question) {
            throw new Error('Question not found');
        }

        await cascadeSoftDelete('question', questionId, ['response'], userId);

        return { success: true };
    } catch (error) {
        if (error instanceof Error) throw error;
        throw new Error('Failed to delete question');
    }
}
