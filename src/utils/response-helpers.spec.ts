import {
    calculatePagination,
    calculateSkip,
    validatePagination,
    handlePrismaError,
} from './response-helpers';
import { ErrorCode } from '../types/api-response.types';

describe('response-helpers', () => {
    describe('calculatePagination', () => {
        test('computes totalPages and navigation flags for a middle page', () => {
            const meta = calculatePagination(2, 10, 25);
            expect(meta).toEqual({
                page: 2,
                limit: 10,
                total: 25,
                totalPages: 3,
                hasNextPage: true,
                hasPreviousPage: true,
            });
        });

        test('first page has no previous, last page has no next', () => {
            expect(calculatePagination(1, 10, 25).hasPreviousPage).toBe(false);
            expect(calculatePagination(3, 10, 25).hasNextPage).toBe(false);
        });

        test('clamps page to >= 1 and limit to <= 100', () => {
            const meta = calculatePagination(0, 500, 10);
            expect(meta.page).toBe(1);
            expect(meta.limit).toBe(100);
        });

        test('zero total yields zero pages', () => {
            const meta = calculatePagination(1, 10, 0);
            expect(meta.totalPages).toBe(0);
            expect(meta.hasNextPage).toBe(false);
        });
    });

    describe('calculateSkip', () => {
        test('page 1 skips nothing', () => {
            expect(calculateSkip(1, 10)).toBe(0);
        });

        test('page 3 with limit 10 skips 20', () => {
            expect(calculateSkip(3, 10)).toBe(20);
        });

        test('accepts string inputs', () => {
            expect(calculateSkip('2', '15')).toBe(15);
        });
    });

    describe('validatePagination', () => {
        test('accepts valid params', () => {
            expect(validatePagination(1, 10)).toEqual({ valid: true });
        });

        test('rejects non-positive page', () => {
            expect(validatePagination(0, 10).valid).toBe(false);
        });

        test('rejects non-numeric limit', () => {
            expect(validatePagination(1, 'abc').valid).toBe(false);
        });

        test('rejects limit over 100', () => {
            const result = validatePagination(1, 101);
            expect(result.valid).toBe(false);
            expect(result.error).toMatch(/100/);
        });
    });

    describe('handlePrismaError', () => {
        test('maps P2002 to DUPLICATE_ENTRY with field name', () => {
            const result = handlePrismaError({ code: 'P2002', meta: { target: ['email'] } });
            expect(result.code).toBe(ErrorCode.DUPLICATE_ENTRY);
            expect(result.message).toMatch(/email/);
        });

        test('maps P2025 to RESOURCE_NOT_FOUND', () => {
            expect(handlePrismaError({ code: 'P2025', meta: {} }).code).toBe(
                ErrorCode.RESOURCE_NOT_FOUND
            );
        });

        test('maps P2003 to INVALID_INPUT', () => {
            expect(handlePrismaError({ code: 'P2003' }).code).toBe(ErrorCode.INVALID_INPUT);
        });

        test('defaults unknown errors to INTERNAL_SERVER_ERROR', () => {
            expect(handlePrismaError({ code: 'UNKNOWN' }).code).toBe(
                ErrorCode.INTERNAL_SERVER_ERROR
            );
        });
    });
});
