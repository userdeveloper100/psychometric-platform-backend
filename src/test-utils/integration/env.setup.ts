/**
 * Jest setupFiles entry for integration tests. Runs before each test file's
 * imports, so the app and Prisma client are created against the test database.
 *
 * Steps:
 *   1. Validate TEST_DATABASE_URL against the development database (fail-fast).
 *   2. Point DATABASE_URL at the test database for this process only.
 *   3. Give the process a random JWT secret, so tokens are signed and verified
 *      with the same value the app reads at import time.
 *
 * Nothing here writes to .env or any other file.
 */

import { randomBytes } from 'crypto';
import { assertSafeTestDatabase, readDotEnvValue } from './db-guard';

// Keep the development URL from the first setup run. Later test files in the
// same worker see DATABASE_URL already overwritten, so the saved value is needed.
const devUrl =
    process.env.INTEGRATION_ORIGINAL_DATABASE_URL ??
    process.env.DATABASE_URL ??
    readDotEnvValue('DATABASE_URL');

if (devUrl && process.env.INTEGRATION_ORIGINAL_DATABASE_URL === undefined) {
    process.env.INTEGRATION_ORIGINAL_DATABASE_URL = devUrl;
}

const target = assertSafeTestDatabase(process.env.TEST_DATABASE_URL, devUrl);

process.env.INTEGRATION_TEST_DB_NAME = target.name;
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.JWT_SECRET = randomBytes(48).toString('hex');
process.env.NODE_ENV = 'test';
