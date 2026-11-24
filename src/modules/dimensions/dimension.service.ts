import prisma from '../../config/prisma';
import { Prisma } from '@prisma/client';
import { cascadeSoftDelete } from '../../utils/softDelete';
import { withCache, cacheDelete } from '../../utils/cache';

// Test structures change rarely — good cache candidates (5 min TTL via withCache).
const testDimensionsCacheKey = (testId: string) => `dimensions:test:${testId}`;

interface CreateDimensionInput {
    name: string;
    description: string;
}

interface GetAllDimensionsOptions {
    page?: number;
    limit?: number;
    instituteId: string;
}

/**
 * SEC-06: every dimension lookup is scoped to the caller's institute through the parent test.
 * A dimension of another institute is reported as not found, so its existence is not leaked.
 */
const dimensionInInstitute = (instituteId: string) => ({
    isActive: true,
    test: { instituteId, isActive: true },
});

/** Fail-closed guard: an empty scope never falls through to an unscoped query. */
const requireInstitute = (instituteId: string | undefined): string => {
    if (!instituteId) throw new Error('Institute scope is required');
    return instituteId;
};

export async function createDimension(
    testId: string,
    { name, description }: CreateDimensionInput,
    instituteId: string
) {
    const scope = requireInstitute(instituteId);
    try {
        // Parent test must be active and belong to the caller's institute before anything is written.
        const test = await prisma.psychometricTest.findFirst({
            where: { id: testId, instituteId: scope, isActive: true },
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

        // Invalidate the cached dimension list for this test.
        await cacheDelete(testDimensionsCacheKey(testId));

        return dimension;
    } catch (error) {
        if (error instanceof Error) throw error;
        throw new Error('Failed to create dimension');
    }
}

export async function getTestDimensions(testId: string, instituteId: string) {
    const scope = requireInstitute(instituteId);
    try {
        const test = await prisma.psychometricTest.findFirst({
            where: {
                id: testId,
                instituteId: scope,
                isActive: true
            },
            select: { id: true }
        });

        if (!test) {
            throw new Error('Test not found');
        }

        // The cache key is per test. It is only read after the institute check above.
        return withCache(testDimensionsCacheKey(testId), () =>
            prisma.dimension.findMany({
                where: { testId, isActive: true },
                orderBy: { createdAt: 'asc' }
            })
        );
    } catch (error) {
        if (error instanceof Error) throw error;
        throw new Error('Failed to fetch dimensions');
    }
}

export async function getAllDimensions({
    page = 1,
    limit = 10,
    instituteId
}: GetAllDimensionsOptions) {
    const scope = requireInstitute(instituteId);
    const currentPage = Number(page) || 1;
    const currentLimit = Number(limit) || 10;
    const skip = (currentPage - 1) * currentLimit;

    return prisma.dimension.findMany({
        where: dimensionInInstitute(scope),
        skip,
        take: currentLimit,
        orderBy: { createdAt: 'desc' }
    });
}

/** Total for pagination, scoped the same way as getAllDimensions. */
export async function countDimensions(instituteId: string) {
    const scope = requireInstitute(instituteId);
    return prisma.dimension.count({ where: dimensionInInstitute(scope) });
}

export async function deleteDimension(dimensionId: string, userId: string, instituteId: string) {
    const scope = requireInstitute(instituteId);
    try {
        // Ownership is checked before the cascade. A foreign dimension is reported as not found and never touched.
        const dimension = await prisma.dimension.findFirst({
            where: {
                id: dimensionId,
                ...dimensionInInstitute(scope)
            }
        });

        if (!dimension) {
            throw new Error('Dimension not found');
        }

        await cascadeSoftDelete('dimension', dimensionId, ['question'], userId);

        // Invalidate the cached dimension list for the parent test.
        await cacheDelete(testDimensionsCacheKey(dimension.testId));

        return { success: true };
    } catch (error) {
        if (error instanceof Error) throw error;
        throw new Error('Failed to delete dimension');
    }
}
