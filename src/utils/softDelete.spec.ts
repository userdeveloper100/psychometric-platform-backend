import { softDeleteAudit } from './softDelete';

describe('softDeleteAudit (DB-01)', () => {
    test('sets isActive to false and records the acting user in updatedBy', () => {
        const now = new Date('2026-11-24T10:00:00Z');
        expect(softDeleteAudit('user-a', now)).toEqual({
            isActive: false,
            updatedBy: 'user-a',
            updatedAt: now,
        });
    });

    test('defaults updatedAt to the current time', () => {
        const before = Date.now();
        const audit = softDeleteAudit('user-a');
        expect(audit.updatedAt.getTime()).toBeGreaterThanOrEqual(before);
    });
});
