import prisma from '../../config/prisma';
import { Prisma } from '@prisma/client';
import { cascadeSoftDelete } from '../../utils/softDelete';

interface CreateInstituteInput {
    name: string;
    email: string;
}

interface GetInstitutesOptions {
    page?: number;
    limit?: number;
    search?: string;
}

interface GetAllInstitutesOptions {
    page?: number;
    limit?: number;
}

// ─── Create Institute ─────────────────────────────────────────────────────────

export async function createInstitute({ name, email }: CreateInstituteInput) {
    try {
        const institute = await prisma.institute.create({
            data: {
                name,
                email,
                isActive: true
            },
            select: {
                id: true,
                name: true,
                email: true,
                createdAt: true
            }
        });

        return institute;
    } catch (error) {
        if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002'
        ) {
            throw new Error('Institute with this email already exists');
        }
        throw new Error('Failed to create institute');
    }
}

// ─── Get All Institutes (Paginated) ──────────────────────────────────────────

export async function getInstitutes({
    page = 1,
    limit = 10,
    search = ''
}: GetInstitutesOptions = {}) {
    try {
        const skip = (page - 1) * limit;

        // Build dynamic where clause for search
        const where: Prisma.InstituteWhereInput = {
            isActive: true,
            ...(search && {
                OR: [
                    {
                        name: {
                            contains: search,
                            mode: 'insensitive'
                        }
                    },
                    {
                        email: {
                            contains: search,
                            mode: 'insensitive'
                        }
                    }
                ]
            })
        };

        // Run count and fetch in parallel for performance
        const [total, institutes] = await Promise.all([
            prisma.institute.count({ where }),
            prisma.institute.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    createdAt: true
                }
            })
        ]);

        return {
            data: institutes,
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
        throw new Error('Failed to fetch institutes');
    }
}

export async function getAllInstitutes({
    page = 1,
    limit = 10
}: GetAllInstitutesOptions = {}) {
    const currentPage = Number(page) || 1;
    const currentLimit = Number(limit) || 10;
    const skip = (currentPage - 1) * currentLimit;

    return prisma.institute.findMany({
        where: { isActive: true },
        skip,
        take: currentLimit,
        orderBy: { createdAt: 'desc' }
    });
}

// ─── Get Institute By ID ──────────────────────────────────────────────────────

export async function getInstituteById(id: string) {
    try {
        const institute = await prisma.institute.findFirst({
            where: {
                id,
                isActive: true
            },
            select: {
                id: true,
                name: true,
                email: true,
                createdAt: true
            }
        });

        if (!institute) {
            throw new Error('Institute not found');
        }

        return institute;
    } catch (error) {
        if (error instanceof Error && error.message === 'Institute not found') {
            throw error;
        }
        throw new Error('Failed to fetch institute');
    }
}

export async function updateInstitute(id: string, data: { name?: string }, userId: string) {
    const institute = await prisma.institute.findFirst({
        where: { id, isActive: true }
    });

    if (!institute) {
        throw new Error('Institute not found');
    }

    return prisma.institute.update({
        where: { id },
        data: {
            ...(data.name !== undefined ? { name: data.name } : {}),
            updatedBy: userId,
            updatedAt: new Date()
        }
    });
}

export async function deleteInstitute(id: string, userId: string) {
    const institute = await prisma.institute.findFirst({
        where: { id, isActive: true }
    });

    if (!institute) {
        throw new Error('Institute not found');
    }

    await cascadeSoftDelete('institute', id, ['user', 'student', 'psychometricTest'], userId);

    return { success: true };
}
