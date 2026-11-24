import { assertSafeTestDatabase } from '../test-utils/integration/db-guard';
import { prisma, verifyConnectedTestDatabase, resetTestDatabase } from '../test-utils/integration/harness';

const TEST_URL = 'postgresql://user:pw@localhost:5433/psychometric_test?schema=public';
const DEV_URL = 'postgresql://user:pw@localhost:5433/psychometric_db?schema=public';

describe('integration test database guard (pure rules)', () => {
    test('accepts a dedicated local test database', () => {
        expect(assertSafeTestDatabase(TEST_URL, DEV_URL).name).toBe('psychometric_test');
    });

    test('refuses when TEST_DATABASE_URL is missing, with no fallback to DATABASE_URL', () => {
        expect(() => assertSafeTestDatabase(undefined, DEV_URL)).toThrow(/TEST_DATABASE_URL is required/);
    });

    test('refuses the development database name', () => {
        expect(() => assertSafeTestDatabase(DEV_URL, undefined)).toThrow(/development database/);
    });

    test('refuses a database name that does not look like a test database', () => {
        const url = 'postgresql://user:pw@localhost:5433/customers?schema=public';
        expect(() => assertSafeTestDatabase(url, DEV_URL)).toThrow(/must name a database matching/);
    });

    test('refuses a remote host', () => {
        const url = 'postgresql://user:pw@db.example.com:5432/psychometric_test';
        expect(() => assertSafeTestDatabase(url, DEV_URL)).toThrow(/local host/);
    });

    test('refuses a non-PostgreSQL scheme', () => {
        expect(() => assertSafeTestDatabase('mysql://user:pw@localhost:3306/psychometric_test', DEV_URL)).toThrow(
            /postgresql:\/\/ scheme/
        );
    });

    test('error messages never contain the connection string', () => {
        const url = 'postgresql://secretuser:secretpass@db.example.com:5432/psychometric_test';
        try {
            assertSafeTestDatabase(url, DEV_URL);
            throw new Error('expected guard to refuse');
        } catch (error) {
            expect((error as Error).message).not.toContain('secretpass');
            expect((error as Error).message).not.toContain('secretuser');
        }
    });
});

describe('integration test database connection (live)', () => {
    test('the live connection is the guarded test database and migrations are applied', async () => {
        await expect(verifyConnectedTestDatabase()).resolves.toBeUndefined();
    });

    test('cleanup removes rows and leaves the schema in place', async () => {
        await resetTestDatabase();
        expect(await prisma.institute.count()).toBe(0);
        expect(await prisma.user.count()).toBe(0);
    });
});
