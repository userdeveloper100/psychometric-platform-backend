import prisma from '../../config/prisma';
import { cascadeSoftDelete } from '../../utils/softDelete';
import { publishTest, deleteTest, UserRole } from './test.service';

jest.mock('../../config/prisma', () => ({
    __esModule: true,
    default: {
        psychometricTest: {
            findFirst: jest.fn(),
            update: jest.fn(),
        },
    },
}));
jest.mock('../../utils/softDelete', () => ({
    cascadeSoftDelete: jest.fn().mockResolvedValue({}),
}));

const findFirst = prisma.psychometricTest.findFirst as unknown as jest.Mock;
const update = prisma.psychometricTest.update as unknown as jest.Mock;

const admin = { role: UserRole.ADMIN, instituteId: 'institute-a' };
const student = { role: UserRole.STUDENT, instituteId: 'institute-a' };

describe('test.service publishTest (SEC-01)', () => {
    test('looks the test up scoped to the requesting institute', async () => {
        findFirst.mockResolvedValue({ id: 't1', status: 'DRAFT', instituteId: 'institute-a' });
        update.mockResolvedValue({ id: 't1', status: 'PUBLISHED' });

        await publishTest({ testId: 't1', requestedBy: admin });

        expect(findFirst).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 't1', instituteId: 'institute-a', isActive: true },
            })
        );
    });

    test('publishes the institute own test', async () => {
        findFirst.mockResolvedValue({ id: 't1', status: 'DRAFT', instituteId: 'institute-a' });
        update.mockResolvedValue({ id: 't1', status: 'PUBLISHED' });

        const result = await publishTest({ testId: 't1', requestedBy: admin });

        expect(update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 't1' }, data: { status: 'PUBLISHED' } }));
        expect(result).toEqual({ id: 't1', status: 'PUBLISHED' });
    });

    test('another institute test is reported as "Test not found" (no existence leak)', async () => {
        // The scoped query finds nothing for a test that belongs to institute B.
        findFirst.mockResolvedValue(null);

        await expect(publishTest({ testId: 'test-of-b', requestedBy: admin })).rejects.toThrow('Test not found');
        expect(update).not.toHaveBeenCalled();
    });

    test('a STUDENT is rejected before any lookup', async () => {
        await expect(publishTest({ testId: 't1', requestedBy: student })).rejects.toThrow(
            'Only ADMIN users can publish tests'
        );
        expect(findFirst).not.toHaveBeenCalled();
        expect(update).not.toHaveBeenCalled();
    });

    test('an already published test is rejected with a conflict message', async () => {
        findFirst.mockResolvedValue({ id: 't1', status: 'PUBLISHED', instituteId: 'institute-a' });

        await expect(publishTest({ testId: 't1', requestedBy: admin })).rejects.toThrow('Test is already published');
        expect(update).not.toHaveBeenCalled();
    });
});

describe('test.service deleteTest (SEC-01)', () => {
    test('looks the test up scoped to the requesting institute', async () => {
        findFirst.mockResolvedValue({ id: 't1', instituteId: 'institute-a' });

        await deleteTest({ testId: 't1', requestedBy: admin });

        expect(findFirst).toHaveBeenCalledWith({
            where: { id: 't1', isActive: true, instituteId: 'institute-a' },
        });
    });

    test('deletes the institute own test and cascades', async () => {
        findFirst.mockResolvedValue({ id: 't1', instituteId: 'institute-a' });

        const result = await deleteTest({ testId: 't1', requestedBy: admin });

        expect(result).toEqual({ success: true });
        expect(cascadeSoftDelete).toHaveBeenCalledWith('psychometricTest', 't1', ['dimension', 'testInvite'], 'institute-a');
    });

    test('another institute test is reported as "Test not found" and nothing is deleted', async () => {
        findFirst.mockResolvedValue(null);

        await expect(deleteTest({ testId: 'test-of-b', requestedBy: admin })).rejects.toThrow('Test not found');
        expect(cascadeSoftDelete).not.toHaveBeenCalled();
    });

    test('a STUDENT is rejected before any lookup', async () => {
        await expect(deleteTest({ testId: 't1', requestedBy: student })).rejects.toThrow('Only ADMIN users can delete tests');
        expect(findFirst).not.toHaveBeenCalled();
    });
});
