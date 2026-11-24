import prisma from '../../config/prisma';
import { cascadeSoftDelete } from '../../utils/softDelete';
import {
    countQuestions,
    createQuestion,
    deleteQuestion,
    getAllQuestions,
    getDimensionQuestions,
} from './question.service';

jest.mock('../../config/prisma', () => ({
    __esModule: true,
    default: {
        dimension: { findFirst: jest.fn() },
        question: {
            findFirst: jest.fn(),
            findMany: jest.fn(),
            count: jest.fn(),
            create: jest.fn(),
        },
    },
}));
jest.mock('../../utils/softDelete', () => ({
    cascadeSoftDelete: jest.fn().mockResolvedValue({}),
}));

const dimMock = prisma.dimension as unknown as { findFirst: jest.Mock };
const qMock = prisma.question as unknown as Record<'findFirst' | 'findMany' | 'count' | 'create', jest.Mock>;

const OWN = 'institute-a';
const OTHER = 'institute-b';
// The chain every question query must carry: dimension active, test active and in the institute.
const chain = (instituteId: string) => ({
    isActive: true,
    dimension: { isActive: true, test: { instituteId, isActive: true } },
});

beforeEach(() => {
    jest.clearAllMocks();
});

describe('question.service tenant scope (SEC-06)', () => {
    describe('createQuestion', () => {
        test('fail closed: no instituteId throws and nothing is written', async () => {
            await expect(createQuestion('dim-a', { text: 'Q' }, '')).rejects.toThrow('Institute scope is required');
            expect(dimMock.findFirst).not.toHaveBeenCalled();
            expect(qMock.create).not.toHaveBeenCalled();
        });

        test('a dimension of another institute is not found and no question is created', async () => {
            dimMock.findFirst.mockResolvedValue(null);
            await expect(createQuestion('dim-b', { text: 'Q' }, OWN)).rejects.toThrow('Dimension not found');
            expect(dimMock.findFirst).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        id: 'dim-b',
                        isActive: true,
                        test: { instituteId: OWN, isActive: true },
                    }),
                })
            );
            expect(qMock.create).not.toHaveBeenCalled();
        });

        test('an own dimension gets the question', async () => {
            dimMock.findFirst.mockResolvedValue({ id: 'dim-a' });
            qMock.create.mockResolvedValue({ id: 'q-a' });
            await createQuestion('dim-a', { text: 'Q', scaleMin: 1, scaleMax: 5 }, OWN);
            expect(qMock.create).toHaveBeenCalledWith(
                expect.objectContaining({ data: expect.objectContaining({ dimensionId: 'dim-a', text: 'Q' }) })
            );
        });

        test('an own dimension still rejects an invalid scale before writing', async () => {
            dimMock.findFirst.mockResolvedValue({ id: 'dim-a' });
            await expect(createQuestion('dim-a', { text: 'Q', scaleMin: 5, scaleMax: 5 }, OWN)).rejects.toThrow(
                'scaleMin must be less than scaleMax'
            );
            expect(qMock.create).not.toHaveBeenCalled();
        });
    });

    describe('getDimensionQuestions', () => {
        test('a dimension of another institute is not found and no question is read', async () => {
            dimMock.findFirst.mockResolvedValue(null);
            await expect(getDimensionQuestions('dim-b', OWN)).rejects.toThrow('Dimension not found');
            expect(qMock.findMany).not.toHaveBeenCalled();
        });

        test('fail closed without an institute', async () => {
            await expect(getDimensionQuestions('dim-a', '')).rejects.toThrow('Institute scope is required');
            expect(dimMock.findFirst).not.toHaveBeenCalled();
        });
    });

    describe('getAllQuestions and countQuestions', () => {
        test('the list is scoped to the requester institute through dimension and test', async () => {
            qMock.findMany.mockResolvedValue([]);
            await getAllQuestions({ page: 1, limit: 10, instituteId: OWN });
            expect(qMock.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: chain(OWN) }));
        });

        test('the count uses the same scope', async () => {
            qMock.count.mockResolvedValue(4);
            expect(await countQuestions(OWN)).toBe(4);
            expect(qMock.count).toHaveBeenCalledWith({ where: chain(OWN) });
        });

        test('fail closed without an institute and never queries', async () => {
            await expect(getAllQuestions({ page: 1, limit: 10, instituteId: '' })).rejects.toThrow(
                'Institute scope is required'
            );
            await expect(countQuestions('')).rejects.toThrow('Institute scope is required');
            expect(qMock.findMany).not.toHaveBeenCalled();
            expect(qMock.count).not.toHaveBeenCalled();
        });
    });

    describe('deleteQuestion', () => {
        test('a question of another institute is not found and the cascade never runs', async () => {
            qMock.findFirst.mockResolvedValue(null);
            await expect(deleteQuestion('q-b', 'u1', OWN)).rejects.toThrow('Question not found');
            expect(qMock.findFirst).toHaveBeenCalledWith({ where: { id: 'q-b', ...chain(OWN) } });
            expect(cascadeSoftDelete).not.toHaveBeenCalled();
        });

        test('an own question is soft deleted through the cascade after the scoped lookup', async () => {
            qMock.findFirst.mockResolvedValue({ id: 'q-a' });
            await deleteQuestion('q-a', 'u1', OWN);
            expect(cascadeSoftDelete).toHaveBeenCalledWith('question', 'q-a', ['response'], 'u1');
        });

        test('fail closed without an institute and nothing is deleted', async () => {
            await expect(deleteQuestion('q-a', 'u1', '')).rejects.toThrow('Institute scope is required');
            expect(qMock.findFirst).not.toHaveBeenCalled();
            expect(cascadeSoftDelete).not.toHaveBeenCalled();
        });

        test('a different institute id does not match an own question', async () => {
            qMock.findFirst.mockResolvedValue(null);
            await expect(deleteQuestion('q-a', 'u1', OTHER)).rejects.toThrow('Question not found');
            expect(qMock.findFirst).toHaveBeenCalledWith({ where: { id: 'q-a', ...chain(OTHER) } });
        });
    });
});
