import prisma from '../../config/prisma';
import { Prisma } from '@prisma/client';

interface CreateDimensionInput {
    name: string;
    description: string;
}

export async function createDimension(
    testId: string,
    { name, description }: CreateDimensionInput
) {
    try {
        const test = await prisma.psychometricTest.findUnique({
            where: { id: testId },
            select: { id: true }
        });

        if (!test) {
            throw new Error('Test not found');
        }

        const dimension = await prisma.dimension.create({
            data: {
                name,
                testId
            }
        });

        return dimension;
    } catch (error) {
        if (error instanceof Error) throw error;
        throw new Error('Failed to create dimension');
    }
}

export async function getTestDimensions(testId: string) {
    try {
        const test = await prisma.psychometricTest.findUnique({
            where: { id: testId },
            select: { id: true }
        });

        if (!test) {
            throw new Error('Test not found');
        }

        return prisma.dimension.findMany({
            where: { testId },
            orderBy: { createdAt: 'asc' } // requires createdAt in Dimension model
        });
    } catch (error) {
        if (error instanceof Error) throw error;
        throw new Error('Failed to fetch dimensions');
    }
}

export async function deleteDimension(dimensionId: string) {
    try {
        return await prisma.dimension.delete({
            where: { id: dimensionId }
        });
    } catch (error) {
        if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2025'
        ) {
            throw new Error('Dimension not found');
        }
        throw new Error('Failed to delete dimension');
    }
}
