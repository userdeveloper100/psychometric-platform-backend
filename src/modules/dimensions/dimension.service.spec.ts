import prisma from '../../config/prisma';
import { countDimensions, createDimension, deleteDimension, getAllDimensions, getTestDimensions } from './dimension.service';

jest.mock('../../config/prisma', () => {
    const client: any = {
        psychometricTest: { findFirst: jest.fn() },
        dimension: {
            findFirst: jest.fn(),
            findMany: jest.fn(),
            count: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            updateMany: jest.fn(),
        },
        question: { updateMany: jest.fn() },
        response: { updateMany: jest.fn() },
    };
    client.$transaction = jest.fn(async (fn: (tx: unknown) => unknown) => fn(client));
    return { __esModule: true, default: client };
});
jest.mock('../../utils/cache', () => ({
    withCache: jest.fn((_key: string, load: () => Promise<unknown>) => load()),
    cacheDelete: jest.fn().mockResolvedValue(undefined),
}));

const testMock = prisma.psychometricTest as unknown as { findFirst: jest.Mock };
const dimMock = prisma.dimension as unknown as Record<'findFirst' | 'findMany' | 'count' | 'create' | 'update', jest.Mock>;
const questionMock = prisma.question as unknown as { updateMany: jest.Mock };
const responseMock = prisma.response as unknown as { updateMany: jest.Mock };

const OWN = 'institute-a';
const OTHER = 'institute-b';
const scope = (instituteId: string) => ({ test: { instituteId, isActive: true } });

beforeEach(() => {
    jest.clearAllMocks();
});

describe('dimension.service tenant scope (SEC-06)', () => {
    describe('createDimension', () => {
        test('fail closed: no instituteId throws and nothing is written', async () => {
            await expect(createDimension('test-a', { name: 'N', description: 'D' }, '')).rejects.toThrow(
                'Institute scope is required'
            );
            expect(testMock.findFirst).not.toHaveBeenCalled();
            expect(dimMock.create).not.toHaveBeenCalled();
        });

        test('a test of another institute is not found and no dimension is created', async () => {
            testMock.findFirst.mockResolvedValue(null);
            await expect(createDimension('test-b', { name: 'N', description: 'D' }, OWN)).rejects.toThrow('Test not found');
            expect(testMock.findFirst).toHaveBeenCalledWith(
                expect.objectContaining({ where: { id: 'test-b', instituteId: OWN, isActive: true } })
            );
            expect(dimMock.create).not.toHaveBeenCalled();
        });

        test('an own active test gets the dimension', async () => {
            testMock.findFirst.mockResolvedValue({ id: 'test-a' });
            dimMock.create.mockResolvedValue({ id: 'dim-a' });
            await createDimension('test-a', { name: 'N', description: 'D' }, OWN);
            expect(dimMock.create).toHaveBeenCalledWith(
                expect.objectContaining({ data: expect.objectContaining({ testId: 'test-a', name: 'N' }) })
            );
        });
    });

    describe('getTestDimensions', () => {
        test('a test of another institute is not found and no dimension is read', async () => {
            testMock.findFirst.mockResolvedValue(null);
            await expect(getTestDimensions('test-b', OWN)).rejects.toThrow('Test not found');
            expect(dimMock.findMany).not.toHaveBeenCalled();
        });

        test('fail closed without an institute', async () => {
            await expect(getTestDimensions('test-a', '')).rejects.toThrow('Institute scope is required');
            expect(testMock.findFirst).not.toHaveBeenCalled();
        });
    });

    describe('getAllDimensions and countDimensions', () => {
        test('the list is scoped to the requester institute through the parent test', async () => {
            dimMock.findMany.mockResolvedValue([]);
            await getAllDimensions({ page: 1, limit: 10, instituteId: OWN });
            expect(dimMock.findMany).toHaveBeenCalledWith(
                expect.objectContaining({ where: expect.objectContaining({ isActive: true, ...scope(OWN) }) })
            );
        });

        test('the count uses the same scope', async () => {
            dimMock.count.mockResolvedValue(2);
            expect(await countDimensions(OWN)).toBe(2);
            expect(dimMock.count).toHaveBeenCalledWith({ where: expect.objectContaining(scope(OWN)) });
        });

        test('fail closed without an institute and never queries', async () => {
            await expect(getAllDimensions({ page: 1, limit: 10, instituteId: '' })).rejects.toThrow(
                'Institute scope is required'
            );
            await expect(countDimensions('')).rejects.toThrow('Institute scope is required');
            expect(dimMock.findMany).not.toHaveBeenCalled();
            expect(dimMock.count).not.toHaveBeenCalled();
        });
    });

    describe('deleteDimension', () => {
        test('a dimension of another institute is not found and the cascade never runs', async () => {
            dimMock.findFirst.mockResolvedValue(null);
            await expect(deleteDimension('dim-b', 'u1', OWN)).rejects.toThrow('Dimension not found');
            expect(dimMock.findFirst).toHaveBeenCalledWith({
                where: { id: 'dim-b', isActive: true, ...scope(OWN) },
            });
            expect(prisma.$transaction).not.toHaveBeenCalled();
            expect(dimMock.update).not.toHaveBeenCalled();
        });

        test('an own dimension cascades in one transaction: responses, then questions, then the dimension', async () => {
            dimMock.findFirst.mockResolvedValue({ id: 'dim-a', testId: 'test-a' });
            await deleteDimension('dim-a', 'u1', OWN);

            expect(prisma.$transaction).toHaveBeenCalledTimes(1);
            expect(responseMock.updateMany).toHaveBeenCalledWith({
                where: { isActive: true, question: { dimensionId: 'dim-a' } },
                data: expect.objectContaining({ isActive: false, updatedBy: 'u1' }),
            });
            expect(questionMock.updateMany).toHaveBeenCalledWith({
                where: { isActive: true, dimensionId: 'dim-a' },
                data: expect.objectContaining({ isActive: false, updatedBy: 'u1' }),
            });
            expect(dimMock.update).toHaveBeenCalledWith({
                where: { id: 'dim-a' },
                data: expect.objectContaining({ isActive: false, updatedBy: 'u1' }),
            });
        });

        test('fail closed without an institute and nothing is deleted', async () => {
            await expect(deleteDimension('dim-a', 'u1', '')).rejects.toThrow('Institute scope is required');
            expect(dimMock.findFirst).not.toHaveBeenCalled();
            expect(prisma.$transaction).not.toHaveBeenCalled();
        });
    });
});
