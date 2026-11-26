import { createHash } from 'crypto';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import prisma from '../../config/prisma';
import {
    acceptUserInvite,
    createUserInvite,
    listUserInvites,
    revokeUserInvite,
    USER_INVITE_REFUSAL,
} from './auth.service';

jest.mock('../../config/prisma', () => {
    const client: any = {
        userInvite: {
            create: jest.fn(),
            findMany: jest.fn(),
            count: jest.fn(),
            findFirst: jest.fn(),
            findFirstOrThrow: jest.fn(),
            updateMany: jest.fn(),
        },
        user: { create: jest.fn() },
    };
    // The accept path runs inside a transaction. The mock passes the same client as the transaction.
    client.$transaction = jest.fn(async (fn: (tx: unknown) => unknown) => fn(client));
    return { __esModule: true, default: client };
});

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const db = prisma as any;

beforeEach(() => {
    jest.clearAllMocks();
});

describe('createUserInvite (DEC-02)', () => {
    test('returns a 256-bit hex token once and stores only its SHA-256 hash, scoped to the institute', async () => {
        db.userInvite.create.mockResolvedValue({ id: 'inv1', email: 't@b.com', role: 'ADMIN', expiresAt: new Date() });

        const { token } = await createUserInvite({
            email: 't@b.com',
            role: 'ADMIN',
            expiresAt: new Date(Date.now() + 1000),
            instituteId: 'i1',
            createdBy: 'u1',
        });

        expect(token).toMatch(/^[0-9a-f]{64}$/);
        const data = db.userInvite.create.mock.calls[0][0].data;
        expect(data.tokenHash).toBe(sha256(token));
        expect(data.instituteId).toBe('i1');
        expect(JSON.stringify(db.userInvite.create.mock.calls[0][0])).not.toContain(token);
    });

    test('the create result never includes the token or the hash', async () => {
        db.userInvite.create.mockResolvedValue({ id: 'inv1', email: 't@b.com', role: 'ADMIN', expiresAt: new Date() });

        const { invite } = await createUserInvite({
            email: 't@b.com',
            role: 'ADMIN',
            expiresAt: new Date(Date.now() + 1000),
            instituteId: 'i1',
            createdBy: 'u1',
        });

        expect(JSON.stringify(invite)).not.toMatch(/tokenHash/);
    });

    test('throws when the institute scope is empty, and never writes', async () => {
        await expect(
            createUserInvite({ email: 't@b.com', role: 'ADMIN', expiresAt: new Date(), instituteId: '', createdBy: 'u1' })
        ).rejects.toThrow('Institute scope is required');
        expect(db.userInvite.create).not.toHaveBeenCalled();
    });
});

describe('listUserInvites (DEC-02)', () => {
    test('is scoped to the institute and never selects the token hash', async () => {
        db.userInvite.findMany.mockResolvedValue([]);

        await listUserInvites({ page: 1, limit: 10, instituteId: 'i1' });

        const args = db.userInvite.findMany.mock.calls[0][0];
        expect(args.where).toEqual({ instituteId: 'i1', isActive: true });
        expect(Object.keys(args.select)).not.toContain('tokenHash');
    });

    test('throws when the institute scope is empty, and never queries', async () => {
        await expect(listUserInvites({ instituteId: '' })).rejects.toThrow('Institute scope is required');
        expect(db.userInvite.findMany).not.toHaveBeenCalled();
    });
});

describe('revokeUserInvite (DEC-02)', () => {
    test('claims the revoke on id, institute and pending state in one conditional write', async () => {
        db.userInvite.updateMany.mockResolvedValue({ count: 1 });
        db.userInvite.findFirstOrThrow.mockResolvedValue({ id: 'inv1' });

        await revokeUserInvite({ id: 'inv1', adminId: 'u1', instituteId: 'i1' });

        expect(db.userInvite.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 'inv1', instituteId: 'i1', isActive: true, consumedAt: null },
                data: expect.objectContaining({ isActive: false, updatedBy: 'u1' }),
            })
        );
    });

    test('a foreign, missing, used or revoked invite matches nothing and is reported as not found', async () => {
        db.userInvite.updateMany.mockResolvedValue({ count: 0 });

        await expect(revokeUserInvite({ id: 'inv-of-b', adminId: 'u1', instituteId: 'i1' })).rejects.toThrow(
            'Invite not found'
        );
    });
});

describe('acceptUserInvite (DEC-02)', () => {
    const TOKEN = 'a'.repeat(64);
    const pendingInvite = { id: 'inv1', email: 't@b.com', role: 'ADMIN', instituteId: 'i1' };

    test('looks the invite up by hash, consumes it and creates the user in the invited institute and role', async () => {
        db.userInvite.findFirst.mockResolvedValue(pendingInvite);
        db.userInvite.updateMany.mockResolvedValue({ count: 1 });
        db.user.create.mockResolvedValue({ id: 'u9', email: 't@b.com', role: 'ADMIN', instituteId: 'i1' });

        const user = await acceptUserInvite({ token: TOKEN, password: 'pw-123' });

        const lookup = db.userInvite.findFirst.mock.calls[0][0].where;
        expect(lookup.tokenHash).toBe(sha256(TOKEN));
        expect(lookup.consumedAt).toBeNull();
        expect(lookup.institute).toEqual({ isActive: true });
        expect(db.userInvite.updateMany.mock.calls[0][0].where).toEqual(
            expect.objectContaining({ id: 'inv1', consumedAt: null })
        );
        const created = db.user.create.mock.calls[0][0].data;
        expect(created).toEqual(expect.objectContaining({ email: 't@b.com', role: 'ADMIN', instituteId: 'i1' }));
        expect(created.password).not.toBe('pw-123');
        expect(await bcrypt.compare('pw-123', created.password)).toBe(true);
        expect(user.id).toBe('u9');
    });

    test('an unknown, expired, revoked, used or inactive-institute token is one generic refusal, and creates nothing', async () => {
        db.userInvite.findFirst.mockResolvedValue(null);

        await expect(acceptUserInvite({ token: TOKEN, password: 'pw' })).rejects.toThrow(USER_INVITE_REFUSAL);
        expect(db.userInvite.updateMany).not.toHaveBeenCalled();
        expect(db.user.create).not.toHaveBeenCalled();
    });

    test('losing the conditional claim is refused and rolls back the user write', async () => {
        db.userInvite.findFirst.mockResolvedValue(pendingInvite);
        db.userInvite.updateMany.mockResolvedValue({ count: 0 });

        await expect(acceptUserInvite({ token: TOKEN, password: 'pw' })).rejects.toThrow(USER_INVITE_REFUSAL);
        expect(db.user.create).not.toHaveBeenCalled();
    });

    test('an email that already has an account is refused with the same generic message', async () => {
        db.userInvite.findFirst.mockResolvedValue(pendingInvite);
        db.userInvite.updateMany.mockResolvedValue({ count: 1 });
        db.user.create.mockRejectedValue(
            new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: '6.0.0' })
        );

        await expect(acceptUserInvite({ token: TOKEN, password: 'pw' })).rejects.toThrow(USER_INVITE_REFUSAL);
    });

    test('an unexpected database failure is reported without internal detail', async () => {
        db.userInvite.findFirst.mockRejectedValue(new Error('connection reset by peer'));

        await expect(acceptUserInvite({ token: TOKEN, password: 'pw' })).rejects.toThrow('Failed to accept invite');
    });
});
