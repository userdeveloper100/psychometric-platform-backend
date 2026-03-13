import prisma from '../../config/prisma';

interface AnswerInput {
    questionId: string;
    answer: number;
}

export async function submitResponse(testId: string, studentId: string, answers: AnswerInput[]) {
    // Save all responses
    const created = await Promise.all(
        answers.map(({ questionId, answer }) =>
            prisma.response.create({ data: { questionId, studentId, answer } })
        )
    );
    // Optionally update invite status to COMPLETED
    await prisma.testInvite.updateMany({
        where: { testId, studentId },
        data: { status: 'COMPLETED' }
    });
    return created;
}
