import type { Config } from 'jest';

/**
 * Pending security regression tests. Each test asserts the SECURE behaviour, so
 * against the current code these tests FAIL. A failure here is evidence of the
 * audit finding named in the test title, not a broken harness.
 * Run with: npm run test:integration:pending
 */
const config: Config = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/src'],
    testMatch: ['<rootDir>/src/integration/**/*.pending.integration.spec.ts'],
    setupFiles: ['<rootDir>/src/test-utils/integration/env.setup.ts'],
    testTimeout: 30000,
    clearMocks: true,
};

export default config;
