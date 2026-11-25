import prisma from '../../config/prisma';
import logger from '../../config/logger';
import { countInvites, deleteInvite, getAllInvites, getStudentInvites, getTestInvites, inviteStudents } from './invite.service';

jest.mock('../../config/prisma', () => {
    const client: any = {
        psychometricTest: { findFirst: jest.fn() },
        student: { findMany: jest.fn(), findFirst: jest.fn() },
        testInvite: {
            findMany: jest.fn(),
            findFirst: jest.fn(),
            count: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
        },
    };
    // Callback form, as used by the service. The tx client is the same mock.
    client.$transaction = jest.fn(async (fn: (tx: unknown) => unknown) => fn(client));
    return { __esModule: true, default: client };
});
jest.mock('../../config/logger', () => ({
    __esModule: true,
    default: { info: jest.fn(), error: jest.fn() },
}));

const psychometricTest = prisma.psychometricTest as unknown as { findFirst: jest.Mock };
const student = prisma.student as unknown as { findMany: jest.Mock; findFirst: jest.Mock };
const invite = prisma.testInvite as unknown as Record<'findMany' | 'findFirst' | 'count' | 'create' | 'update', jest.Mock>;

const OWN = 'institute-a';
const OTHER = 'institute-b';
const HEX_64 = /^[0-9a-f]{64}$/;

// Every invite read must be scoped to the caller's institute through the invite's test.
const scopeOf = (instituteId: string) => ({ test: { instituteId } });

// The select objects must never ask for the token column.
const selectOf = (call: jest.Mock) => call.mock.calls[0][0].select;

beforeEach(() => {
    jest.clearAllMocks();
});

describe('invite.service (SEC-05)', () => {
    describe('token generation', () => {
        test('each created invite gets a 256-bit hex token from the CSPRNG, and tokens differ', async () => {
            psychometricTest.findFirst.mockResolvedValue({ id: 't1' });
            student.findMany.mockResolvedValue([{ id: 's1' }, { id: 's2' }]);
            // 1st findMany: existing invites (none). 2nd findMany: the invites just created.
            invite.findMany
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([
                    { id: 'i1', studentId: 's1', token: 'x', status: 'PENDING' },
                    { id: 'i2', studentId: 's2', token: 'y', status: 'PENDING' },
                ]);
            invite.create.mockResolvedValue({});

            await inviteStudents('t1', ['s1', 's2'], 'u1', OWN);

            const tokens = invite.create.mock.calls.map((call) => call[0].data.token);
            expect(tokens).toHaveLength(2);
            tokens.forEach((token) => expect(token).toMatch(HEX_64));
            expect(tokens[0]).not.toBe(tokens[1]);
        });

        test('the token is not written to any log entry', async () => {
            psychometricTest.findFirst.mockResolvedValue({ id: 't1' });
            student.findMany.mockResolvedValue([{ id: 's1' }]);
            invite.findMany
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([{ id: 'i1', studentId: 's1', token: 'secret-token', status: 'PENDING' }]);
            invite.create.mockResolvedValue({});

            await inviteStudents('t1', ['s1'], 'u1', OWN);

            const token = invite.create.mock.calls[0][0].data.token;
            const logged = JSON.stringify([
                (logger.info as jest.Mock).mock.calls,
                (logger.error as jest.Mock).mock.calls,
            ]);
            expect(logged).not.toContain(token);
        });
    });

    describe('listings never select the token', () => {
        test('getAllInvites is scoped to the requester institute and selects no token', async () => {
            invite.findMany.mockResolvedValue([]);
            await getAllInvites({ page: 1, limit: 10, instituteId: OWN });

            expect(invite.findMany).toHaveBeenCalledWith(
                expect.objectContaining({ where: expect.objectContaining({ isActive: true, ...scopeOf(OWN) }) })
            );
            expect(selectOf(invite.findMany)).not.toHaveProperty('token');
        });

        test('getAllInvites fails closed without an institute and never queries', async () => {
            await expect(getAllInvites({ page: 1, limit: 10, instituteId: '' })).rejects.toThrow(
                'Institute scope is required'
            );
            expect(invite.findMany).not.toHaveBeenCalled();
        });

        test('countInvites uses the same institute scope', async () => {
            invite.count.mockResolvedValue(2);
            expect(await countInvites(OWN)).toBe(2);
            expect(invite.count).toHaveBeenCalledWith({ where: expect.objectContaining(scopeOf(OWN)) });
        });

        test('countInvites fails closed without an institute', async () => {
            await expect(countInvites('')).rejects.toThrow('Institute scope is required');
            expect(invite.count).not.toHaveBeenCalled();
        });

        test('getTestInvites refuses a test of another institute and selects no token', async () => {
            psychometricTest.findFirst.mockResolvedValue(null);
            await expect(getTestInvites('test-b', OWN)).rejects.toThrow('Test not found or access denied');
            expect(invite.findMany).not.toHaveBeenCalled();
        });

        test('getTestInvites selects no token for an own test', async () => {
            psychometricTest.findFirst.mockResolvedValue({ id: 'test-a' });
            invite.findMany.mockResolvedValue([]);
            await getTestInvites('test-a', OWN);
            expect(selectOf(invite.findMany)).not.toHaveProperty('token');
        });

        test('getStudentInvites refuses a student of another institute and selects no token', async () => {
            student.findFirst.mockResolvedValue(null);
            await expect(getStudentInvites('student-b', OWN)).rejects.toThrow('Student not found or access denied');
            expect(invite.findMany).not.toHaveBeenCalled();
        });

        test('getStudentInvites selects no token for an own student', async () => {
            student.findFirst.mockResolvedValue({ id: 'student-a' });
            invite.findMany.mockResolvedValue([]);
            await getStudentInvites('student-a', OWN);
            expect(selectOf(invite.findMany)).not.toHaveProperty('token');
        });
    });

    describe('revocation (soft delete) is tenant scoped', () => {
        test('a foreign invite is not found and is never updated', async () => {
            invite.findFirst.mockResolvedValue(null);
            await expect(deleteInvite('invite-b', 'u1', OWN)).rejects.toThrow('Invite not found or access denied');
            expect(invite.findFirst).toHaveBeenCalledWith(
                expect.objectContaining({ where: expect.objectContaining({ id: 'invite-b', isActive: true, ...scopeOf(OWN) }) })
            );
            expect(invite.update).not.toHaveBeenCalled();
        });

        test('an own invite is deactivated', async () => {
            invite.findFirst.mockResolvedValue({ id: 'invite-a', status: 'PENDING' });
            invite.update.mockResolvedValue({ id: 'invite-a', isActive: false });
            await deleteInvite('invite-a', 'u1', OWN);
            expect(invite.update).toHaveBeenCalledWith(
                expect.objectContaining({ where: { id: 'invite-a' }, data: expect.objectContaining({ isActive: false }) })
            );
        });

        test('a foreign invite error is logged without the token', async () => {
            invite.findFirst.mockResolvedValue(null);
            await expect(deleteInvite('invite-b', 'u1', OWN)).rejects.toThrow();
            expect(JSON.stringify((logger.error as jest.Mock).mock.calls)).not.toMatch(/token/i);
        });
    });

    // DB-02: re-invitation. The table allows one row per (testId, studentId), so a revoked or expired row is
    // reused with a new token. A completed or duplicate active invite is never reissued.
    describe('re-invitation after revoke, expiry or soft delete (DB-02)', () => {
        const PAST = new Date(Date.now() - 60_000);
        const FUTURE = new Date(Date.now() + 60_000);

        const reinvite = (existing: Record<string, unknown>[], created: Record<string, unknown>[] = []) => {
            psychometricTest.findFirst.mockResolvedValue({ id: 't1' });
            student.findMany.mockResolvedValue([{ id: 's1' }]);
            // Reset the queue first. A call that returns early never reads its second value, so the leftover would leak.
            invite.findMany.mockReset();
            invite.findMany.mockResolvedValueOnce(existing).mockResolvedValueOnce(created);
            return inviteStudents('t1', ['s1'], 'u1', OWN);
        };

        test('a revoked invite is reissued with a new 256-bit token, on the same row, and no second row is inserted', async () => {
            const result = await reinvite(
                [{ id: 'row-1', studentId: 's1', isActive: false, status: 'PENDING', expiresAt: null }],
                [{ id: 'row-1', studentId: 's1', token: 'x', status: 'PENDING' }]
            );

            expect(invite.create).not.toHaveBeenCalled();
            expect(invite.update).toHaveBeenCalledWith({
                where: { id: 'row-1' },
                data: expect.objectContaining({
                    token: expect.stringMatching(/^[0-9a-f]{64}$/),
                    status: 'PENDING',
                    isActive: true,
                    expiresAt: null,
                    updatedBy: 'u1',
                }),
            });
            expect(result.created).toBe(1);
        });

        test('the token is replaced, not added: the existing token is never selected, so it cannot be returned or reused', async () => {
            await reinvite([{ id: 'row-1', studentId: 's1', isActive: false, status: 'PENDING', expiresAt: null }]);
            expect(invite.findMany.mock.calls[0][0].select).not.toHaveProperty('token');
        });

        test('an expired active invite is reissued with a new token and its expiry cleared', async () => {
            await reinvite([{ id: 'row-2', studentId: 's1', isActive: true, status: 'PENDING', expiresAt: PAST }]);
            expect(invite.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 'row-2' },
                    data: expect.objectContaining({ token: expect.stringMatching(/^[0-9a-f]{64}$/), expiresAt: null }),
                })
            );
        });

        test('a duplicate active, unexpired invite is skipped: no write, token unchanged', async () => {
            const result = await reinvite([{ id: 'row-3', studentId: 's1', isActive: true, status: 'PENDING', expiresAt: FUTURE }]);
            expect(invite.update).not.toHaveBeenCalled();
            expect(invite.create).not.toHaveBeenCalled();
            expect(result).toEqual(expect.objectContaining({ created: 0, skipped: 1 }));
        });

        test('a completed invite is never reissued, whether active or revoked', async () => {
            await reinvite([{ id: 'row-4', studentId: 's1', isActive: true, status: 'COMPLETED', expiresAt: PAST }]);
            expect(invite.update).not.toHaveBeenCalled();

            jest.clearAllMocks();
            await reinvite([{ id: 'row-5', studentId: 's1', isActive: false, status: 'COMPLETED', expiresAt: null }]);
            expect(invite.update).not.toHaveBeenCalled();
            expect(invite.create).not.toHaveBeenCalled();
        });

        test('a student with no row gets a new invite with a 256-bit token', async () => {
            await reinvite([], [{ id: 'row-6', studentId: 's1', token: 'x', status: 'PENDING' }]);
            expect(invite.update).not.toHaveBeenCalled();
            expect(invite.create.mock.calls[0][0].data.token).toMatch(/^[0-9a-f]{64}$/);
        });

        test('the re-invitation runs in one transaction', async () => {
            await reinvite([{ id: 'row-1', studentId: 's1', isActive: false, status: 'PENDING', expiresAt: null }]);
            expect(prisma.$transaction).toHaveBeenCalledTimes(1);
        });

        test('a soft-deleted or foreign student is refused with the not-found message, and nothing is read or written', async () => {
            psychometricTest.findFirst.mockResolvedValue({ id: 't1' });
            student.findMany.mockResolvedValue([]);
            await expect(inviteStudents('t1', ['s-b'], 'u1', OWN)).rejects.toThrow('Student not found or access denied');
            expect(invite.findMany).not.toHaveBeenCalled();
            expect(prisma.$transaction).not.toHaveBeenCalled();
        });

        test('a test of another institute is refused before any student is looked up', async () => {
            psychometricTest.findFirst.mockResolvedValue(null);
            await expect(inviteStudents('t-b', ['s1'], 'u1', OWN)).rejects.toThrow('Test not found or access denied');
            expect(student.findMany).not.toHaveBeenCalled();
        });
    });
});
