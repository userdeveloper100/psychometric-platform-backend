/**
 * Process-level startup checks for src/config/env.ts.
 *
 * Each case loads env.ts in a fresh Node process, the same way the server does at
 * startup, and checks the exit code and output. The child runs with cwd set to src/,
 * which has no .env file, so dotenv cannot supply values from the developer's .env.
 */
import { spawnSync } from 'child_process';
import { join } from 'path';

const SRC_DIR = join(__dirname, '..');
const ENV_MODULE = join(__dirname, 'env.ts');
const TS_NODE_REGISTER = require.resolve('ts-node/register/transpile-only');

const VALID_SECRET = 'd'.repeat(48);

// Start from the parent environment without any configuration variables this module reads.
const cleanEnv = (): NodeJS.ProcessEnv => {
    const env: NodeJS.ProcessEnv = { ...process.env };
    for (const key of ['JWT_SECRET', 'DATABASE_URL', 'REDIS_URL', 'PORT', 'CORS_ORIGINS', 'NODE_ENV', 'JWT_EXPIRES_IN']) {
        delete env[key];
    }
    return env;
};

// A `null` override removes the variable from the child environment.
const loadEnvInChild = (overrides: Record<string, string | null>) => {
    const script = `require(${JSON.stringify(ENV_MODULE)}); console.log('ENV_LOADED');`;
    const env: NodeJS.ProcessEnv = {
        ...cleanEnv(),
        DATABASE_URL: 'postgresql://user:pw@localhost:5433/psychometric_db',
    };
    for (const [key, value] of Object.entries(overrides)) {
        if (value === null) delete env[key];
        else env[key] = value;
    }
    const result = spawnSync(process.execPath, ['-r', TS_NODE_REGISTER, '-e', script], {
        cwd: SRC_DIR,
        env,
        encoding: 'utf8',
        timeout: 60000,
    });
    return {
        status: result.status,
        output: `${result.stdout ?? ''}${result.stderr ?? ''}`,
    };
};

describe('server startup configuration (process-level)', () => {
    test('starts when JWT_SECRET is at least 32 characters', () => {
        const result = loadEnvInChild({ JWT_SECRET: VALID_SECRET });
        expect(result.status).toBe(0);
        expect(result.output).toContain('ENV_LOADED');
    }, 60000);

    test('exits non-zero when JWT_SECRET is missing', () => {
        const result = loadEnvInChild({ JWT_SECRET: null });
        expect(result.status).not.toBe(0);
        expect(result.output).toContain('JWT_SECRET is missing or empty');
        expect(result.output).not.toContain('ENV_LOADED');
    }, 60000);

    test('exits non-zero when JWT_SECRET is shorter than 32 characters, without echoing it', () => {
        const weak = 'weak-secret-value-1234';
        const result = loadEnvInChild({ JWT_SECRET: weak });
        expect(result.status).not.toBe(0);
        expect(result.output).toContain('JWT_SECRET must be at least 32 characters');
        expect(result.output).not.toContain(weak);
    }, 60000);

    test('exits non-zero when JWT_SECRET is still the placeholder', () => {
        const result = loadEnvInChild({ JWT_SECRET: 'CHANGE_ME_replace_with_random_value_of_at_least_32_chars' });
        expect(result.status).not.toBe(0);
        expect(result.output).toContain('placeholder value');
    }, 60000);
});
