import prisma from '../../config/prisma';
import bcrypt from 'bcryptjs';
import { Prisma, Role } from '@prisma/client';
import { generateToken } from '../../utils/jwt';
import { generateInviteToken, hashInviteToken } from '../../utils/invite-token';
import { dispatchInviteNotification } from '../notifications/notification.queue';


interface LoginInput {
    email: string;
    password: string;
}

interface CreateUserInviteInput {
    email: string;
    role: Role;
    expiresAt: Date;
    instituteId: string;
    createdBy: string;
}

interface ListUserInvitesOptions {
    page?: number;
    limit?: number;
    instituteId: string;
}

interface AcceptUserInviteInput {
    token: string;
    password: string;
}

/**
 * DEC-02: one generic refusal for every unusable invite (unknown, revoked, used, expired, inactive institute,
 * or an email that already has an account). A response never says which check failed.
 */
export const USER_INVITE_REFUSAL = 'Invite is invalid or no longer usable';

const USER_INVITE_SELECT = {
    id: true,
    email: true,
    role: true,
    expiresAt: true,
    consumedAt: true,
    createdAt: true,
} as const;

interface GetAllUsersOptions {
    page?: number;
    limit?: number;
    instituteId: string;
}

/**
 * DEC-02: issues a user invite in the caller's institute. The raw token is returned once, here, and only its
 * hash is stored. The institute comes from the verified token, never from the request body.
 */
export async function createUserInvite({ email, role, expiresAt, instituteId, createdBy }: CreateUserInviteInput) {
    if (!instituteId) throw new Error('Institute scope is required');

    const token = generateInviteToken();
    const invite = await prisma.userInvite.create({
        data: {
            email,
            role,
            expiresAt,
            tokenHash: hashInviteToken(token),
            instituteId,
            createdBy,
        },
        select: { id: true, email: true, role: true, expiresAt: true },
    });

    // Queued after the create. dispatch never throws, so the invite response is unaffected.
    await dispatchInviteNotification({
        type: 'SEND_USER_INVITE',
        inviteId: invite.id,
        instituteId,
        recipientEmail: invite.email,
        inviteToken: token,
    });

    return { invite, token };
}

/** DEC-02: pending and used invites of the caller's institute. Token hashes and raw tokens are never selected. */
export async function listUserInvites({ page = 1, limit = 10, instituteId }: ListUserInvitesOptions) {
    if (!instituteId) throw new Error('Institute scope is required');
    const currentPage = Number(page) || 1;
    const currentLimit = Number(limit) || 10;
    const skip = (currentPage - 1) * currentLimit;

    return prisma.userInvite.findMany({
        where: { instituteId, isActive: true },
        skip,
        take: currentLimit,
        orderBy: { createdAt: 'desc' },
        select: USER_INVITE_SELECT,
    });
}

export async function countUserInvites(instituteId: string) {
    if (!instituteId) throw new Error('Institute scope is required');
    return prisma.userInvite.count({ where: { instituteId, isActive: true } });
}

/**
 * DEC-02: revokes a pending invite of the caller's institute. A foreign, missing, used or already revoked invite
 * matches nothing and is reported as not found, so existence in another institute is not revealed.
 */
export async function revokeUserInvite({ id, adminId, instituteId }: { id: string; adminId: string; instituteId: string }) {
    if (!instituteId) throw new Error('Institute scope is required');

    const now = new Date();
    const revoked = await prisma.userInvite.updateMany({
        where: { id, instituteId, isActive: true, consumedAt: null },
        data: { isActive: false, updatedBy: adminId, updatedAt: now },
    });
    if (revoked.count !== 1) throw new Error('Invite not found');

    return prisma.userInvite.findFirstOrThrow({ where: { id }, select: USER_INVITE_SELECT });
}

/**
 * DEC-02: creates the account for an invite. The token is the only credential. Claiming the invite and creating
 * the user run in one transaction, so a refused or failed step leaves no user and the invite still usable.
 * The name is validated by the controller but not stored, because User has no name column yet (open decision).
 */
export async function acceptUserInvite({ token, password }: AcceptUserInviteInput) {
    const now = new Date();
    const tokenHash = hashInviteToken(token);
    const hashedPassword = await bcrypt.hash(password, 10);

    try {
        return await prisma.$transaction(async (tx) => {
            const invite = await tx.userInvite.findFirst({
                where: {
                    tokenHash,
                    isActive: true,
                    consumedAt: null,
                    expiresAt: { gt: now },
                    institute: { isActive: true },
                },
                select: { id: true, email: true, role: true, instituteId: true },
            });
            if (!invite) throw new Error(USER_INVITE_REFUSAL);

            // Conditional claim: only one concurrent accept can consume the invite. The other matches nothing.
            const claimed = await tx.userInvite.updateMany({
                where: { id: invite.id, isActive: true, consumedAt: null, expiresAt: { gt: now } },
                data: { consumedAt: now, updatedAt: now },
            });
            if (claimed.count !== 1) throw new Error(USER_INVITE_REFUSAL);

            return tx.user.create({
                data: {
                    email: invite.email,
                    password: hashedPassword,
                    role: invite.role,
                    instituteId: invite.instituteId,
                },
                select: { id: true, email: true, role: true, instituteId: true },
            });
        }, {
            maxWait: 5000,
            timeout: 10000,
        });
    } catch (error) {
        // An email that already has an account fails the unique constraint. It is reported with the same generic message.
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            throw new Error(USER_INVITE_REFUSAL);
        }
        if (error instanceof Error && error.message === USER_INVITE_REFUSAL) throw error;
        throw new Error('Failed to accept invite');
    }
}

export async function login({ email, password }: LoginInput) {
    try {
        // 1. Find user by email
        const user = await prisma.user.findUnique({
            where: { email }
        });

        if (!user) {
            throw new Error('Invalid credentials');
        }

        // 2. Compare password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            throw new Error('Invalid credentials');
        }

        // 3. Generate JWT token
        const token = generateToken({
            userId: user.id,
            role: user.role,
            instituteId: user.instituteId
        });

        // 4. Return token and user data
        return {
            token,
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                instituteId: user.instituteId
            }
        };
    } catch (error) {
        if (error instanceof Error && error.message === 'Invalid credentials') {
            throw error;
        }
        throw new Error('Login failed');
    }
}

/**
 * Step 12 release gate: the user list is limited to the requester's institute. It used to list the users of every
 * institute. Fail-closed: an empty scope throws and never queries.
 */
export async function getAllUsers({
    page = 1,
    limit = 10,
    instituteId
}: GetAllUsersOptions) {
    if (!instituteId) throw new Error('Institute scope is required');
    const currentPage = Number(page) || 1;
    const currentLimit = Number(limit) || 10;
    const skip = (currentPage - 1) * currentLimit;

    return prisma.user.findMany({
        where: { isActive: true, instituteId },
        skip,
        take: currentLimit,
        orderBy: { createdAt: 'desc' },
        select: {
            id: true,
            email: true,
            role: true,
            instituteId: true,
            createdAt: true,
            updatedAt: true
        }
    });
}

// Not routed. Scoped anyway (Step 12 release gate): an admin can only deactivate a user of their own institute.
export async function deleteUser(userId: string, adminId: string, instituteId: string) {
    if (!instituteId) throw new Error('Institute scope is required');
    const user = await prisma.user.findFirst({
        where: { id: userId, instituteId, isActive: true }
    });

    if (!user) {
        throw new Error('User not found');
    }

    return prisma.user.update({
        where: { id: userId },
        data: {
            isActive: false,
            updatedBy: adminId,
            updatedAt: new Date()
        }
    });
}
