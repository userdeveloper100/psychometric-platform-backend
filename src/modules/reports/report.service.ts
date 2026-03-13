import prisma from '../../config/prisma';
import { calculateDimensionScores } from '../../utils/scoring';

export async function getTestReport(testId: string) {
    // Get all students who completed the test
    const invites = await prisma.testInvite.findMany({
        where: { testId, status: 'COMPLETED' },
        include: { student: true }
    });
    // For each student, get their responses
    const reports = await Promise.all(invites.map(async (invite) => {
        const responses = await prisma.response.findMany({
            where: { studentId: invite.studentId },
            include: { question: true }
        });
        const dimensionResponses = responses.map(r => ({
            dimensionId: r.question.dimensionId,
            answer: r.answer
        }));
        const scores = calculateDimensionScores(dimensionResponses);
        return {
            student: invite.student,
            scores
        };
    }));
    return reports;
}
