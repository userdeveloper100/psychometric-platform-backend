import prisma from '../../config/prisma';
import { Prisma } from '@prisma/client';
import { cascadeSoftDelete } from '../../utils/softDelete';

interface CreateDimensionInput {
    name: string;
    description: string;
}

interface GetAllDimensionsOptions {
    page?: number;
    limit?: number;
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
                testId,
                isActive: true
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
        const test = await prisma.psychometricTest.findFirst({
            where: {
                id: testId,
                isActive: true
            },
            select: { id: true }
        });

        if (!test) {
            throw new Error('Test not found');
        }

        return prisma.dimension.findMany({
            where: { testId, isActive: true },
            orderBy: { createdAt: 'asc' }
        });
    } catch (error) {
        if (error instanceof Error) throw error;
        throw new Error('Failed to fetch dimensions');
    }
}

export async function getAllDimensions({
    page = 1,
    limit = 10
}: GetAllDimensionsOptions = {}) {
    const currentPage = Number(page) || 1;
    const currentLimit = Number(limit) || 10;
    const skip = (currentPage - 1) * currentLimit;

    return prisma.dimension.findMany({
        where: { isActive: true },
        skip,
        take: currentLimit,
        orderBy: { createdAt: 'desc' }
    });
}

export async function deleteDimension(dimensionId: string, userId: string) {
    try {
        const dimension = await prisma.dimension.findFirst({
            where: {
                id: dimensionId,
                isActive: true
            }
        });

        if (!dimension) {
            throw new Error('Dimension not found');
        }

        await cascadeSoftDelete('dimension', dimensionId, ['question'], userId);

        return { success: true };
    } catch (error) {
        if (error instanceof Error) throw error;
        throw new Error('Failed to delete dimension');
    }
}
