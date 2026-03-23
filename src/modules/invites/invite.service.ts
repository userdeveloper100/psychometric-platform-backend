import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import prisma from '../../config/prisma';
import logger from '../../config/logger';

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface InviteResult {
    created: number;
    skipped: number;
    invites: {
        id: string;
        studentId: string;
        token: string;
        status: string;
    }[];
}

<<<<<<< HEAD
interface GetAllInvitesOptions {
    page?: number;
    limit?: number;
}

=======
>>>>>>> 11519917377035306673a076a7e613f111ba9d8f
// ─── Invite Students ──────────────────────────────────────────────────────────

export async function inviteStudents(
    testId: string,
    studentIds: string[],
    userId: string,
    instituteId: string
): Promise<InviteResult> {
    logger.info('Inviting students to test', { testId, count: studentIds.length });

    try {
        // 1. Verify test exists and belongs to the institute (tenant-scoped)
        const test = await prisma.psychometricTest.findFirst({
            where: { id: testId, instituteId, isActive: true },
            select: { id: true }
        });

        if (!test) {
            throw new Error('Test not found or access denied');
        }

        // 2. Verify all students exist and belong to the same institute
        const students = await prisma.student.findMany({
            where: {
                id: { in: studentIds },
                instituteId,
                isActive: true
            },
            select: { id: true }
        });

        if (!students.length) {
            throw new Error('No valid students found for this institute');
        }

        const validStudentIds = new Set(students.map((s) => s.id));

        // 3. Find already-invited active students to skip duplicates
        const existingInvites = await prisma.testInvite.findMany({
            where: {
                testId,
                studentId: { in: [...validStudentIds] },
                isActive: true
            },
            select: { studentId: true }
        });

        const alreadyInvitedSet = new Set(
            existingInvites.map((i) => i.studentId)
        );

        const newStudentIds = [...validStudentIds].filter(
            (id) => !alreadyInvitedSet.has(id)
        );

        const skipped = studentIds.length - newStudentIds.length;

        if (!newStudentIds.length) {
            return {
                created: 0,
                skipped,
                invites: [],
                message: 'All students already invited'
            } as any;
        }

        // 4. Generate unique token per student and create invite records
        const inviteData = newStudentIds.map((studentId) => ({
            testId,
            studentId,
            token: randomUUID(),           // unique invite token
            status: 'PENDING' as const,
            isActive: true,
            createdBy: userId
        }));

        // 5. Bulk create invites inside a transaction
        await prisma.$transaction(
            inviteData.map((data) =>
                prisma.testInvite.create({ data })
            )
        );

        // Fetch created invites to return
        const created = await prisma.testInvite.findMany({
            where: {
                testId,
                studentId: { in: newStudentIds },
                isActive: true
            },
            select: {
                id: true,
                studentId: true,
                token: true,
                status: true
            }
        });

        logger.info('Students invited', {
            testId,
            created: created.length,
            skipped
        });

        return { created: created.length, skipped, invites: created };
    } catch (error) {
        logger.error('Failed to invite students', {
            error: error instanceof Error ? error.message : error,
            testId
        });
        if (error instanceof Error) throw error;
        throw new Error('Failed to invite students');
    }
}

// ─── Get Invites for a Test ───────────────────────────────────────────────────

export async function getTestInvites(
    testId: string,
    instituteId: string
) {
    logger.info('Fetching test invites', { testId });
    try {
        // Tenant-scoped test check
        const test = await prisma.psychometricTest.findFirst({
            where: { id: testId, instituteId, isActive: true },
            select: { id: true }
        });

        if (!test) {
            throw new Error('Test not found or access denied');
        }

        const invites = await prisma.testInvite.findMany({
            where: { testId, isActive: true },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                token: true,
                status: true,
                createdAt: true,
                student: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                }
            }
        });

        logger.info('Test invites fetched', { testId, count: invites.length });
        return invites;
    } catch (error) {
        logger.error('Failed to fetch test invites', {
            error: error instanceof Error ? error.message : error,
            testId
        });
        if (error instanceof Error) throw error;
        throw new Error('Failed to fetch test invites');
    }
}

// ─── Get Invites for a Student ────────────────────────────────────────────────

export async function getStudentInvites(
    studentId: string,
    instituteId: string
) {
    logger.info('Fetching student invites', { studentId });
    try {
        // Tenant-scoped student check
        const student = await prisma.student.findFirst({
            where: { id: studentId, instituteId, isActive: true },
            select: { id: true }
        });

        if (!student) {
            throw new Error('Student not found or access denied');
        }

        const invites = await prisma.testInvite.findMany({
            where: { studentId, isActive: true },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                token: true,
                status: true,
                createdAt: true,
                test: {
                    select: {
                        id: true,
                        title: true,
                        status: true
                    }
                }
            }
        });

        logger.info('Student invites fetched', { studentId, count: invites.length });
        return invites;
    } catch (error) {
        logger.error('Failed to fetch student invites', {
            error: error instanceof Error ? error.message : error,
            studentId
        });
        if (error instanceof Error) throw error;
        throw new Error('Failed to fetch student invites');
    }
}

<<<<<<< HEAD
export async function getAllInvites({
    page = 1,
    limit = 10
}: GetAllInvitesOptions = {}) {
    const currentPage = Number(page) || 1;
    const currentLimit = Number(limit) || 10;
    const skip = (currentPage - 1) * currentLimit;

    return prisma.testInvite.findMany({
        where: { isActive: true },
        skip,
        take: currentLimit,
        orderBy: { createdAt: 'desc' }
    });
}

=======
>>>>>>> 11519917377035306673a076a7e613f111ba9d8f
// ─── Soft Delete Invite ───────────────────────────────────────────────────────

export async function deleteInvite(
    inviteId: string,
    userId: string,
    instituteId: string
) {
    logger.info('Soft deleting invite', { inviteId, userId });
    try {
        // Tenant-scoped invite lookup
        const invite = await prisma.testInvite.findFirst({
            where: {
                id: inviteId,
                isActive: true,
                test: { instituteId }
            },
            select: { id: true, status: true }
        });

        if (!invite) {
            throw new Error('Invite not found or access denied');
        }

        // Prevent deleting already completed invites
        if (invite.status === 'COMPLETED') {
            throw new Error('Cannot delete a completed invite');
        }

        const updated = await prisma.testInvite.update({
            where: { id: inviteId },
            data: { isActive: false, updatedBy: userId }
        });

        logger.info('Invite soft deleted', { inviteId });
        return updated;
    } catch (error) {
        logger.error('Failed to delete invite', {
            error: error instanceof Error ? error.message : error,
            inviteId
        });
        if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2025'
        ) {
            throw new Error('Invite not found');
        }
        if (error instanceof Error) throw error;
        throw new Error('Failed to delete invite');
    }
<<<<<<< HEAD
}
=======
}
>>>>>>> 11519917377035306673a076a7e613f111ba9d8f
