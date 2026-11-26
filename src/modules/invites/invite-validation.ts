import { InviteStatus, Prisma } from '@prisma/client';
import prisma from '../../config/prisma';

/**
 * DEC-03: the one set of rules that decides whether an invite token may be used. The candidate assessment
 * read and the response submission both call it, so the two paths cannot drift apart.
 * Messages are fixed strings and never include the token.
 */
export const INVITE_REFUSALS: readonly string[] = [
    'Invalid or inactive invite token',
    'Responses already submitted for this invite',
    'Invite has expired',
    'Student does not match invite',
];

type DbClient = Prisma.TransactionClient | typeof prisma;

const isExpired = (expiresAt: Date | null, now: Date): boolean =>
    expiresAt !== null && expiresAt.getTime() <= now.getTime();

/**
 * Loads the invite for a token and refuses it unless it is usable. The checks run in a fixed order:
 * the invite exists, it is pending, it is unexpired, the studentId matches (when given), and the
 * test, the student and the institute are all active and in the same institute.
 */
export const findUsableInvite = async (db: DbClient, token: string, now: Date, studentId?: string) => {
    const invite = await db.testInvite.findFirst({
        where: { token, isActive: true },
        select: {
            id: true,
            testId: true,
            studentId: true,
            status: true,
            expiresAt: true,
            test: {
                select: {
                    instituteId: true,
                    isActive: true,
                    institute: { select: { isActive: true } }
                }
            },
            student: { select: { instituteId: true, isActive: true } }
        }
    });

    if (!invite) throw new Error('Invalid or inactive invite token');
    if (invite.status !== InviteStatus.PENDING) throw new Error('Responses already submitted for this invite');
    if (isExpired(invite.expiresAt, now)) throw new Error('Invite has expired');

    // A studentId in the body must match the invite. A mismatch is refused, never reassigned.
    if (studentId !== undefined && invite.studentId !== studentId) throw new Error('Student does not match invite');

    const sameInstitute = invite.test.instituteId === invite.student.instituteId;
    const allActive = invite.test.isActive && invite.test.institute.isActive && invite.student.isActive;
    if (!allActive || !sameInstitute) throw new Error('Invalid or inactive invite token');

    return invite;
};
