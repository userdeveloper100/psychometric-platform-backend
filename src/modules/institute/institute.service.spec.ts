import prisma from '../../config/prisma';
import { cascadeSoftDelete } from '../../utils/softDelete';
import { assertOwnInstitute, deleteInstitute, getAllInstitutes, getInstituteById, updateInstitute } from './institute.service';

jest.mock('../../config/prisma', () => ({
    __esModule: true,
    default: {
        institute: {
            findFirst: jest.fn(),
            findMany: jest.fn(),
            update: jest.fn(),
        },
    },
}));
jest.mock('../../utils/softDelete', () => ({
    cascadeSoftDelete: jest.fn().mockResolvedValue({}),
}));

const findFirst = prisma.institute.findFirst as unknown as jest.Mock;
const findMany = prisma.institute.findMany as unknown as jest.Mock;
const update = prisma.institute.update as unknown as jest.Mock;

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

    describe('deleteInstitute', () => {
        test('rejects another institute before the cascade runs', async () => {
            await expect(deleteInstitute(OTHER, 'u1', OWN)).rejects.toThrow('Institute not found');
            expect(findFirst).not.toHaveBeenCalled();
            expect(cascadeSoftDelete).not.toHaveBeenCalled();
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
