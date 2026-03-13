import prisma from '../../config/prisma';

interface CreateQuestionInput {
    text: string;
    scaleMin: number;
    scaleMax: number;
}

export async function createQuestion(dimensionId: string, { text, scaleMin, scaleMax }: CreateQuestionInput) {
    return prisma.question.create({
        data: { text, scaleMin, scaleMax, dimensionId }
    });
}
