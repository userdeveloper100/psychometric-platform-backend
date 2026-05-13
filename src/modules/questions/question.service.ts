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
}

export async function createQuestion(
    dimensionId: string,
    { text, scaleMin = 1, scaleMax = 5 }: CreateQuestionInput
) {
    try {
        const dimension = await prisma.dimension.findUnique({
            where: { id: dimensionId },
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

export async function getDimensionQuestions(dimensionId: string) {
    try {
        const dimension = await prisma.dimension.findFirst({
            where: {
                id: dimensionId,
                isActive: true
            },
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
    limit = 10
}: GetAllQuestionsOptions = {}) {
    const currentPage = Number(page) || 1;
    const currentLimit = Number(limit) || 10;
    const skip = (currentPage - 1) * currentLimit;

    return prisma.question.findMany({
        where: { isActive: true },
        skip,
        take: currentLimit,
        orderBy: { createdAt: 'desc' }
    });
}

export async function deleteQuestion(questionId: string, userId: string) {
    try {
        const question = await prisma.question.findFirst({
            where: {
                id: questionId,
                isActive: true
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
