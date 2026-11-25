import prisma from '../../config/prisma';
import { assertOwnInstitute, deleteInstitute, getAllInstitutes, getInstituteById, updateInstitute } from './institute.service';

jest.mock('../../config/prisma', () => {
    const models = () => ({ updateMany: jest.fn(), update: jest.fn() });
    const client: any = {
        institute: { findFirst: jest.fn(), findMany: jest.fn(), update: jest.fn() },
        response: models(),
        testInvite: models(),
        question: models(),
        dimension: models(),
        student: models(),
        psychometricTest: models(),
        user: models(),
    };
    client.$transaction = jest.fn(async (fn: (tx: unknown) => unknown) => fn(client));
    return { __esModule: true, default: client };
});

const findFirst = prisma.institute.findFirst as unknown as jest.Mock;
const findMany = prisma.institute.findMany as unknown as jest.Mock;
const update = prisma.institute.update as unknown as jest.Mock;
const cascade = (model: string) => prisma[model as 'user'] as unknown as { updateMany: jest.Mock };

const OWN = 'institute-a';
const OTHER = 'institute-b';

describe('institute.service ownership (SEC-02)', () => {
    describe('assertOwnInstitute', () => {
        test('passes when the id is the requester institute', () => {
            expect(() => assertOwnInstitute(OWN, OWN)).not.toThrow();
        });

        test('throws "Institute not found" for another institute', () => {
            expect(() => assertOwnInstitute(OTHER, OWN)).toThrow('Institute not found');
        });

        test('fails closed when the requester has no institute', () => {
            expect(() => assertOwnInstitute(OWN, '')).toThrow('Institute not found');
        });
    });

    describe('getInstituteById', () => {
        test('returns the requester own institute', async () => {
            findFirst.mockResolvedValue({ id: OWN, name: 'A' });
            await expect(getInstituteById(OWN, OWN)).resolves.toEqual({ id: OWN, name: 'A' });
        });

        test('rejects another institute before any database read', async () => {
            await expect(getInstituteById(OTHER, OWN)).rejects.toThrow('Institute not found');
            expect(findFirst).not.toHaveBeenCalled();
        });
    });

    describe('updateInstitute', () => {
        test('updates the requester own institute', async () => {
            findFirst.mockResolvedValue({ id: OWN });
            update.mockResolvedValue({ id: OWN, name: 'New' });

            await updateInstitute(OWN, { name: 'New' }, 'u1', OWN);

            expect(update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: OWN } }));
        });

        test('rejects another institute before any read or write', async () => {
            await expect(updateInstitute(OTHER, { name: 'Hijack' }, 'u1', OWN)).rejects.toThrow('Institute not found');
            expect(findFirst).not.toHaveBeenCalled();
            expect(update).not.toHaveBeenCalled();
        });
    });

    describe('deleteInstitute (DB-01)', () => {
        test('rejects another institute before the cascade runs', async () => {
            await expect(deleteInstitute(OTHER, 'u1', OWN)).rejects.toThrow('Institute not found');
            expect(findFirst).not.toHaveBeenCalled();
            expect(prisma.$transaction).not.toHaveBeenCalled();
        });

        test('an own institute cascades in one transaction, filtered by the real relation to the institute', async () => {
            findFirst.mockResolvedValue({ id: OWN });
            await deleteInstitute(OWN, 'user-a', OWN);

            expect(prisma.$transaction).toHaveBeenCalledTimes(1);
            expect(cascade('student').updateMany).toHaveBeenCalledWith({
                where: { isActive: true, instituteId: OWN },
                data: expect.objectContaining({ isActive: false, updatedBy: 'user-a' }),
            });
            expect(cascade('psychometricTest').updateMany).toHaveBeenCalledWith({
                where: { isActive: true, instituteId: OWN },
                data: expect.objectContaining({ isActive: false, updatedBy: 'user-a' }),
            });
            expect(cascade('dimension').updateMany).toHaveBeenCalledWith({
                where: { isActive: true, test: { instituteId: OWN } },
                data: expect.objectContaining({ isActive: false, updatedBy: 'user-a' }),
            });
            expect(cascade('question').updateMany).toHaveBeenCalledWith({
                where: { isActive: true, dimension: { test: { instituteId: OWN } } },
                data: expect.objectContaining({ isActive: false, updatedBy: 'user-a' }),
            });
            expect(cascade('testInvite').updateMany).toHaveBeenCalledWith({
                where: {
                    isActive: true,
                    OR: [{ test: { instituteId: OWN } }, { student: { instituteId: OWN } }],
                },
                data: expect.objectContaining({ isActive: false, updatedBy: 'user-a' }),
            });
            expect(cascade('response').updateMany).toHaveBeenCalledWith({
                where: {
                    isActive: true,
                    OR: [
                        { student: { instituteId: OWN } },
                        { question: { dimension: { test: { instituteId: OWN } } } },
                    ],
                },
                data: expect.objectContaining({ isActive: false, updatedBy: 'user-a' }),
            });
            expect(cascade('user').updateMany).toHaveBeenCalledWith({
                where: { isActive: true, instituteId: OWN },
                data: expect.objectContaining({ isActive: false, updatedBy: 'user-a' }),
            });
            expect(update).toHaveBeenCalledWith({
                where: { id: OWN },
                data: expect.objectContaining({ isActive: false, updatedBy: 'user-a' }),
            });
        });

        test('never writes the institute id into updatedBy', async () => {
            findFirst.mockResolvedValue({ id: OWN });
            await deleteInstitute(OWN, 'user-a', OWN);
            const writes = [update, cascade('user').updateMany, cascade('student').updateMany];
            for (const write of writes) {
                for (const call of write.mock.calls) {
                    expect(call[0].data.updatedBy).not.toBe(OWN);
                }
            }
        });
    });

    describe('getAllInstitutes', () => {
        test('scopes the list to the requester institute', async () => {
            findMany.mockResolvedValue([{ id: OWN }]);

            await getAllInstitutes({ page: 1, limit: 10, instituteId: OWN });

            expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { isActive: true, id: OWN } }));
        });

        test('returns nothing without a trusted scope (never an unscoped list)', async () => {
            await expect(getAllInstitutes({ page: 1, limit: 10, instituteId: '' })).resolves.toEqual([]);
            expect(findMany).not.toHaveBeenCalled();
        });
    });
});
