import prisma from '../../config/prisma';
import { Prisma } from '@prisma/client';

interface CreateQuestionInput {
    text: string;
    scaleMin?: number;
    scaleMax?: number;
}

<<<<<<< HEAD
interface GetAllQuestionsOptions {
    page?: number;
    limit?: number;
}

=======
>>>>>>> 11519917377035306673a076a7e613f111ba9d8f
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
                scaleMax
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
        const dimension = await prisma.dimension.findUnique({
            where: { id: dimensionId },
            select: { id: true }
        });

        if (!dimension) {
            throw new Error('Dimension not found');
        }

        return await prisma.question.findMany({
            where: { dimensionId },
            orderBy: { createdAt: 'asc' }
        });
    } catch (error) {
        if (error instanceof Error) throw error;
        throw new Error('Failed to fetch questions');
    }
}

<<<<<<< HEAD
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

=======
>>>>>>> 11519917377035306673a076a7e613f111ba9d8f
export async function deleteQuestion(questionId: string) {
    try {
        return await prisma.question.delete({
            where: { id: questionId }
        });
    } catch (error) {
        if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2025'
        ) {
            throw new Error('Question not found');
        }
        throw new Error('Failed to delete question');
    }
}
