/* eslint-disable no-console */
/**
 * Prepares the integration-test database by applying the existing Prisma migrations.
 *
 * Safety:
 *   - Requires TEST_DATABASE_URL; never falls back to DATABASE_URL.
 *   - Runs the same guard as the Jest setup (name, local host, not the dev database).
 *   - Confirms the live connection is the guarded database before doing anything.
 *   - Uses `prisma migrate deploy` only. It never runs `migrate reset`, and it never creates the database.
 *
 * Run with: npm run test:db:setup
 */

import { spawnSync } from 'child_process';
import { Client } from 'pg';
import { assertSafeTestDatabase, readDotEnvValue } from '../src/test-utils/integration/db-guard';

const runPrisma = (args: string[], databaseUrl: string): void => {
    const result = spawnSync('npx', ['prisma', ...args], {
        env: { ...process.env, DATABASE_URL: databaseUrl },
        stdio: 'inherit',
        shell: true,
    });
    if (result.status !== 0) {
        throw new Error(`prisma ${args.join(' ')} failed with exit code ${result.status}.`);
    }
};

const main = async (): Promise<void> => {
    const testUrl = process.env.TEST_DATABASE_URL;
    const devUrl = process.env.DATABASE_URL ?? readDotEnvValue('DATABASE_URL');
    const target = assertSafeTestDatabase(testUrl, devUrl);

    const client = new Client({ connectionString: testUrl });
    try {
        await client.connect();
    } catch {
        throw new Error(
            `Cannot connect to database "${target.name}" on ${target.host}:${target.port}. ` +
                'Check that the Postgres container is running and that the database exists. ' +
                'See docs/INTEGRATION_TESTING.md, "Create the test database".'
        );
    }

    try {
        const { rows } = await client.query<{ name: string }>('SELECT current_database() AS name');
        if (rows[0]?.name !== target.name) {
            throw new Error('Connected database does not match the guarded test database. Refusing to continue.');
        }
    } finally {
        await client.end();
    }

    console.log(`[integration-db] Target database: ${target.name} (${target.host}:${target.port})`);
    runPrisma(['migrate', 'deploy'], testUrl as string);
    runPrisma(['migrate', 'status'], testUrl as string);
    console.log('[integration-db] Test database is ready.');
};

main().catch((error: Error) => {
    console.error(`[integration-db] ${error.message}`);
    process.exit(1);
});
