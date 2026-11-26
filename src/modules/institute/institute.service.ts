import prisma from '../../config/prisma';
import { Prisma } from '@prisma/client';
import { softDeleteAudit } from '../../utils/softDelete';
import { generateInviteToken, hashInviteToken } from '../../utils/invite-token';

interface CreateInstituteInput {
    name: string;
    email: string;
    initialAdminEmail?: string;
    createdBy: string;
}

interface GetInstitutesOptions {
    page?: number;
    limit?: number;
    search?: string;
}

interface GetAllInstitutesOptions {
    page?: number;
    limit?: number;
    // Trusted tenant scope: the requester's own institute (from req.user), never from the request payload.
    instituteId: string;
}

/**
 * SEC-02: an ADMIN may only act on their own institute. Any other id is reported as "not found",
 * the same as a missing institute, so cross-tenant ids are not revealed. Runs before any read
 * that feeds a write, and before any cascade.
 */
export function assertOwnInstitute(id: string, requestingInstituteId: string): void {
    if (!requestingInstituteId || id !== requestingInstituteId) {
        throw new Error('Institute not found');
    }
}

// ─── Create Institute ─────────────────────────────────────────────────────────

const INITIAL_ADMIN_INVITE_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * DEC-01: SUPER_ADMIN provisions a tenant. The institute and, when an initial admin email is given, that admin's
 * invite are created in one transaction, so a failed step leaves neither behind. The raw invite token is returned
 * once, to the caller that created it, and only its hash is stored.
 */
export async function createInstitute({ name, email, initialAdminEmail, createdBy }: CreateInstituteInput) {
    const token = initialAdminEmail ? generateInviteToken() : null;
    const now = new Date();

    try {
        return await prisma.$transaction(async (tx) => {
            const institute = await tx.institute.create({
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

            if (!initialAdminEmail || !token) return { ...institute, initialAdminInvite: null };

            // Platform-level check: SUPER_ADMIN may learn that an email is taken. Accept refuses it generically anyway.
            const existing = await tx.user.findUnique({ where: { email: initialAdminEmail }, select: { id: true } });
            if (existing) throw new Error('Email already registered');

            const invite = await tx.userInvite.create({
                data: {
                    email: initialAdminEmail,
                    role: 'ADMIN',
                    tokenHash: hashInviteToken(token),
                    expiresAt: new Date(now.getTime() + INITIAL_ADMIN_INVITE_DAYS * DAY_MS),
                    instituteId: institute.id,
                    createdBy
                },
                select: { id: true, email: true, role: true, expiresAt: true }
            });

            return { ...institute, initialAdminInvite: { invite, token } };
        }, {
            maxWait: 5000,
            timeout: 10000
        });
    } catch (error) {
        if (error instanceof Error && error.message === 'Email already registered') throw error;
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
    limit = 10,
    instituteId
}: GetAllInstitutesOptions) {
    // Fail closed: without a trusted tenant scope, return nothing. Prisma ignores an undefined filter.
    if (!instituteId) {
        return [];
    }

    const currentPage = Number(page) || 1;
    const currentLimit = Number(limit) || 10;
    const skip = (currentPage - 1) * currentLimit;

    return prisma.institute.findMany({
        where: { isActive: true, id: instituteId },
        skip,
        take: currentLimit,
        orderBy: { createdAt: 'desc' }
    });
}

// ─── Get Institute By ID ──────────────────────────────────────────────────────

export async function getInstituteById(id: string, requestingInstituteId: string) {
    assertOwnInstitute(id, requestingInstituteId);
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

export async function updateInstitute(
    id: string,
    data: { name?: string },
    userId: string,
    requestingInstituteId: string
) {
    assertOwnInstitute(id, requestingInstituteId);

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

export async function deleteInstitute(id: string, userId: string, requestingInstituteId: string) {
    // Checked before any read or cascade, so a cross-tenant delete never reaches the cascade.
    assertOwnInstitute(id, requestingInstituteId);

    const institute = await prisma.institute.findFirst({
        where: { id, isActive: true }
    });

    if (!institute) {
        throw new Error('Institute not found');
    }

    // DB-01: one transaction. Each child is found through its real relation to the institute, and the
    // institute is updated last. Children are matched by relation, not by parent isActive, so the filters
    // still match after the parents are deactivated.
    await prisma.$transaction(async (tx) => {
        const audit = softDeleteAudit(userId);

        await tx.response.updateMany({
            where: {
                isActive: true,
                OR: [
                    { student: { instituteId: id } },
                    { question: { dimension: { test: { instituteId: id } } } }
                ]
            },
            data: audit
        });

        await tx.testInvite.updateMany({
            where: {
                isActive: true,
                OR: [
                    { test: { instituteId: id } },
                    { student: { instituteId: id } }
                ]
            },
            data: audit
        });

        await tx.question.updateMany({
            where: { isActive: true, dimension: { test: { instituteId: id } } },
            data: audit
        });

        await tx.dimension.updateMany({
            where: { isActive: true, test: { instituteId: id } },
            data: audit
        });

        await tx.student.updateMany({
            where: { isActive: true, instituteId: id },
            data: audit
        });

        await tx.psychometricTest.updateMany({
            where: { isActive: true, instituteId: id },
            data: audit
        });

        // Users of the institute are deactivated, as the previous cascade did.
        await tx.user.updateMany({
            where: { isActive: true, instituteId: id },
            data: audit
        });

        await tx.institute.update({
            where: { id },
            data: audit
        });
    });

    return { success: true };
}
