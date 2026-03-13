import prisma from '../../config/prisma';

interface CreateTestInput {
    title: string;
    description: string;
    instituteId: string;
}

export async function createTest({ title, description, instituteId }: CreateTestInput) {
    return prisma.psychometricTest.create({
        data: { title, description, instituteId }
    });
}

export async function getTests() {
    return prisma.psychometricTest.findMany();
}

export async function publishTest(id: string) {
    return prisma.psychometricTest.update({
        where: { id },
        data: { status: 'PUBLISHED' }
    });
}
