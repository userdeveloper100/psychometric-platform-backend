import prisma from '../../config/prisma';

interface CreateDimensionInput {
    name: string;
    description: string;
}

export async function createDimension(testId: string, { name, description }: CreateDimensionInput) {
    return prisma.dimension.create({
        data: { name, description, testId }
    });
}
