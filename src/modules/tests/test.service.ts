import prisma from '../../config/prisma';
import { Prisma } from '@prisma/client';

// ─── Enums ────────────────────────────────────────────────────────────────────

export enum TestStatus {
    DRAFT = 'DRAFT',
    PUBLISHED = 'PUBLISHED'
}

export enum UserRole {
    ADMIN = 'ADMIN',
    STUDENT = 'STUDENT'
}

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface CreateTestInput {
    title: string;
    description: string;
    instituteId: string;
    requestedBy: {
        role: UserRole;
        instituteId: string;
    };
}

interface GetInstituteTestsOptions {
    instituteId: string;
    page?: number;
    limit?: number;
    status?: TestStatus;
    search?: string;
}

interface PublishTestInput {
    testId: string;
    instituteId: string;
    requestedBy: {
        role: UserRole;
        instituteId: string;
    };
}

// ─── Create Test ──────────────────────────────────────────────────────────────

export async function createTest({
    title,
    description,
    instituteId,
    requestedBy
}: CreateTestInput) {
    try {
        // Guard: only ADMIN users can create tests
        if (requestedBy.role !== UserRole.ADMIN) {
            throw new Error('Only ADMIN users can create tests');
        }

        // Guard: admin can only create tests for their own institute
        if (requestedBy.instituteId !== instituteId) {
            throw new Error('You can only create tests for your own institute');
        }

        // Verify institute exists before creating test
        const institute = await prisma.institute.findUnique({
            where: { id: instituteId },
            select: { id: true }
        });

        if (!institute) {
            throw new Error('Institute not found');
        }

        const test = await prisma.psychometricTest.create({
            data: {
                title,
                description,
                instituteId,
                status: TestStatus.DRAFT  // always starts as DRAFT
            },
            select: {
                id: true,
                title: true,
                description: true,
                status: true,
                instituteId: true,
                createdAt: true
            }
        });

        return test;
    } catch (error) {
        if (error instanceof Error) throw error;
        throw new Error('Failed to create test');
    }
}

// ─── Get Institute Tests (Paginated + Filtered) ───────────────────────────────

export async function getInstituteTests({
    instituteId,
    page = 1,
    limit = 10,
    status,
    search = ''
}: GetInstituteTestsOptions) {
    try {
        const skip = (page - 1) * limit;

        // Build dynamic where clause
        const where: Prisma.PsychometricTestWhereInput = {
            instituteId,
            ...(status && { status }),
            ...(search && {
                OR: [
                    { title: { contains: search, mode: 'insensitive' } },
                    { description: { contains: search, mode: 'insensitive' } }
                ]
            })
        };

        // Fetch count and tests in parallel for performance
        const [total, tests] = await Promise.all([
            prisma.psychometricTest.count({ where }),
            prisma.psychometricTest.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    title: true,
                    description: true,
                    status: true,
                    instituteId: true,
                    createdAt: true
                }
            })
        ]);

        return {
            data: tests,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
                hasNextPage: page < Math.ceil(total / limit),
                hasPreviousPage: page > 1
            }
        };
    } catch (error) {
        throw new Error('Failed to fetch tests');
    }
}

// ─── Publish Test ─────────────────────────────────────────────────────────────

export async function publishTest({
    testId,
    instituteId,
    requestedBy
}: PublishTestInput) {
    try {
        // Guard: only ADMIN users can publish tests
        if (requestedBy.role !== UserRole.ADMIN) {
            throw new Error('Only ADMIN users can publish tests');
        }

        // Fetch existing test
        const existingTest = await prisma.psychometricTest.findUnique({
            where: { id: testId },
            select: { id: true, status: true, instituteId: true }
        });

        if (!existingTest) {
            throw new Error('Test not found');
        }

        // Guard: admin can only publish tests from their own institute
        if (existingTest.instituteId !== instituteId) {
            throw new Error('You can only publish tests from your own institute');
        }

        // Guard: prevent re-publishing already published tests
        if (existingTest.status === TestStatus.PUBLISHED) {
            throw new Error('Test is already published');
        }

        const updatedTest = await prisma.psychometricTest.update({
            where: { id: testId },
            data: { status: TestStatus.PUBLISHED },
            select: {
                id: true,
                title: true,
                description: true,
                status: true,
                instituteId: true,
                createdAt: true
            }
        });

        return updatedTest;
    } catch (error) {
        if (error instanceof Error) throw error;
        throw new Error('Failed to publish test');
    }
}
