import { randomBytes } from 'crypto';
import { InviteStatus, Prisma } from '@prisma/client';
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

interface GetAllInvitesOptions {
    page?: number;
    limit?: number;
    instituteId: string;
}

/**
 * SEC-05: invite listings never include the token. A token is returned once, in the response to
 * the admin who creates the invite, so it can be shared with the student. Reads never return it again.
 */
const inviteListSelect = {
    id: true,
    testId: true,
    studentId: true,
    status: true,
    expiresAt: true,
    createdAt: true,
} as const;

/** Fail-closed guard: an empty tenant scope never falls through to an unscoped query. */
const requireInstitute = (instituteId: string | undefined): string => {
    if (!instituteId) throw new Error('Institute scope is required');
    return instituteId;
};

/** 256-bit CSPRNG token. The value is never logged. */
const newInviteToken = (): string => randomBytes(32).toString('hex');

const isExpired = (expiresAt: Date | null, now: Date): boolean =>
    expiresAt !== null && expiresAt.getTime() <= now.getTime();

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

        // Same 404 message as a foreign or missing student, so cross-tenant ids are not revealed.
        if (!students.length) {
            throw new Error('Student not found or access denied');
        }

        const validStudentIds = [...new Set(students.map((s) => s.id))];

        // 3. Classify every existing row for these students. The table allows one row per (testId, studentId),
        //    including inactive rows, so a revoked or expired row is reused with a new token instead of inserted again.
        const existingRows = await prisma.testInvite.findMany({
            where: { testId, studentId: { in: validStudentIds } },
            select: { id: true, studentId: true, isActive: true, status: true, expiresAt: true }
        });
        const rowByStudent = new Map(existingRows.map((row) => [row.studentId, row]));
        const now = new Date();

        const rowsToReissue: string[] = [];
        const studentsToCreate: string[] = [];
        const issuedStudentIds: string[] = [];

        for (const studentId of validStudentIds) {
            const row = rowByStudent.get(studentId);

            if (!row) {
                studentsToCreate.push(studentId);
            } else if (row.status === InviteStatus.COMPLETED) {
                // A completed invite is never reissued. The student has already responded.
                continue;
            } else if (row.isActive && !isExpired(row.expiresAt, now)) {
                // A duplicate active, unexpired invite is skipped and its token is unchanged.
                continue;
            } else {
                // Revoked (inactive) or expired: reissue with a new token.
                rowsToReissue.push(row.id);
            }
            issuedStudentIds.push(studentId);
        }

        const skipped = studentIds.length - issuedStudentIds.length;

        if (!issuedStudentIds.length) {
            return {
                created: 0,
                skipped,
                invites: [],
                message: 'All students already invited'
            } as any;
        }

        // 4. Write in one transaction. Each token is a fresh 256-bit CSPRNG value. A reissued row replaces
        //    the old token, so the old token stops working at the same moment.
        await prisma.$transaction(async (tx) => {
            for (const id of rowsToReissue) {
                await tx.testInvite.update({
                    where: { id },
                    data: {
                        token: newInviteToken(),
                        status: InviteStatus.PENDING,
                        isActive: true,
                        expiresAt: null,
                        updatedBy: userId
                    }
                });
            }

            for (const studentId of studentsToCreate) {
                await tx.testInvite.create({
                    data: {
                        testId,
                        studentId,
                        token: newInviteToken(),
                        status: InviteStatus.PENDING,
                        isActive: true,
                        createdBy: userId
                    }
                });
            }
        });

        // Fetch the issued invites, with their new tokens, for the admin's response
        const created = await prisma.testInvite.findMany({
            where: {
                testId,
                studentId: { in: issuedStudentIds },
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
                status: true,
                expiresAt: true,
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
                status: true,
                expiresAt: true,
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

/** Invites of the requester's institute only. Scope is the invite's test, so a foreign invite is never listed. */
export async function getAllInvites({
    page = 1,
    limit = 10,
    instituteId
}: GetAllInvitesOptions) {
    const scope = requireInstitute(instituteId);
    const currentPage = Number(page) || 1;
    const currentLimit = Number(limit) || 10;
    const skip = (currentPage - 1) * currentLimit;

    return prisma.testInvite.findMany({
        where: { isActive: true, test: { instituteId: scope } },
        select: inviteListSelect,
        skip,
        take: currentLimit,
        orderBy: { createdAt: 'desc' }
    });
}

/** Total for pagination, scoped the same way as getAllInvites. */
export async function countInvites(instituteId: string) {
    const scope = requireInstitute(instituteId);
    return prisma.testInvite.count({
        where: { isActive: true, test: { instituteId: scope } }
    });
}

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
}
