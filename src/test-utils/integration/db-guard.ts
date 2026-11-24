/**
 * Safety guard for integration tests.
 *
 * Pure functions only (no database access), so the rules can be unit-tested.
 * Integration tests may only run against a database that:
 *   - is named explicitly by TEST_DATABASE_URL (never falls back to DATABASE_URL),
 *   - has a name matching TEST_DB_NAME_PATTERN (e.g. psychometric_test),
 *   - is not the development database, and is not the same database as DATABASE_URL,
 *   - is on a local host.
 *
 * Error messages never include the connection string, so credentials cannot leak into test output.
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

export const TEST_DB_NAME_PATTERN = /^psychometric_test(_[a-z0-9]+)?$/;
export const DEV_DB_NAME = 'psychometric_db';
const LOCAL_HOSTS = ['localhost', '127.0.0.1'];

export interface TargetDatabase {
    host: string;
    port: string;
    name: string;
}

export const parseDatabaseUrl = (url: string, label: string): TargetDatabase => {
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        throw new Error(`${label} is not a valid connection URL.`);
    }
    if (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:') {
        throw new Error(`${label} must use the postgresql:// scheme.`);
    }
    return {
        host: parsed.hostname,
        port: parsed.port || '5432',
        name: decodeURIComponent(parsed.pathname.replace(/^\//, '')),
    };
};

/**
 * Throws unless testUrl is a safe, dedicated integration-test database.
 * devUrl is the development DATABASE_URL (may be undefined when unset).
 * Returns the parsed target on success.
 */
export const assertSafeTestDatabase = (
    testUrl: string | undefined,
    devUrl: string | undefined
): TargetDatabase => {
    if (!testUrl) {
        throw new Error(
            'TEST_DATABASE_URL is required for integration tests. Integration tests never fall back to DATABASE_URL.'
        );
    }

    const target = parseDatabaseUrl(testUrl, 'TEST_DATABASE_URL');

    if (target.name === DEV_DB_NAME) {
        throw new Error('TEST_DATABASE_URL names the development database. Refusing to run.');
    }
    if (!TEST_DB_NAME_PATTERN.test(target.name)) {
        throw new Error(
            `TEST_DATABASE_URL must name a database matching ${TEST_DB_NAME_PATTERN}. Refusing to run.`
        );
    }
    if (!LOCAL_HOSTS.includes(target.host)) {
        throw new Error('TEST_DATABASE_URL must point to a local host (localhost or 127.0.0.1). Refusing to run.');
    }

    if (devUrl) {
        const dev = parseDatabaseUrl(devUrl, 'DATABASE_URL');
        if (dev.name === target.name) {
            throw new Error('TEST_DATABASE_URL uses the same database name as DATABASE_URL. Refusing to run.');
        }
        if (dev.host === target.host && dev.port === target.port && dev.name === target.name) {
            throw new Error('TEST_DATABASE_URL points at the same database as DATABASE_URL. Refusing to run.');
        }
    }

    return target;
};

/**
 * Reads one KEY=value line from the project's .env file without printing it.
 * Returns undefined when the file or key is absent.
 */
export const readDotEnvValue = (key: string, cwd: string = process.cwd()): string | undefined => {
    const file = join(cwd, '.env');
    if (!existsSync(file)) return undefined;
    const line = readFileSync(file, 'utf8')
        .split(/\r?\n/)
        .find((candidate) => candidate.startsWith(`${key}=`));
    if (!line) return undefined;
    return line
        .slice(key.length + 1)
        .trim()
        .replace(/^["']|["']$/g, '');
};
