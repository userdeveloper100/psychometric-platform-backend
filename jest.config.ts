import type { Config } from 'jest';

const config: Config = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/src'],
    testMatch: ['**/*.spec.ts', '**/*.test.ts'],
    // Integration specs need a real database. They run only via jest.integration.config.ts.
    testPathIgnorePatterns: ['/node_modules/', '<rootDir>/src/integration/'],
    clearMocks: true,
    collectCoverageFrom: [
        'src/**/*.ts',
        '!src/**/*.spec.ts',
        '!src/**/*.test.ts',
        '!src/server.ts',
    ],
    coverageDirectory: 'coverage',
};

export default config;
