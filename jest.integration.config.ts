import type { Config } from 'jest';

/**
 * Integration tests: run against the isolated test database (TEST_DATABASE_URL).
 * Pending security regression tests live in *.pending.integration.spec.ts and run
 * only through jest.security-pending.config.ts.
 */
const config: Config = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/src'],
    testMatch: ['<rootDir>/src/integration/**/*.integration.spec.ts'],
    testPathIgnorePatterns: ['/node_modules/', '\\.pending\\.integration\\.spec\\.ts$'],
    setupFiles: ['<rootDir>/src/test-utils/integration/env.setup.ts'],
    testTimeout: 30000,
    clearMocks: true,
};

export default config;
