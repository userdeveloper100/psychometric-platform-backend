/**
 * Centralized, validated environment configuration.
 *
 * Every module reads configuration from `env` instead of `process.env`. Validation
 * runs once, when this module is first imported, so a missing or weak JWT_SECRET
 * stops the server before it accepts any request.
 *
 * Error messages name the variable but never include its value.
 */

import { config as loadDotenv } from 'dotenv';

export const MIN_JWT_SECRET_LENGTH = 32;

// Marker used by the .env.example placeholder. A copied placeholder must not pass validation.
const PLACEHOLDER_MARKER = 'CHANGE_ME';

export interface AppEnv {
    NODE_ENV: string;
    PORT: number;
    DATABASE_URL: string;
    REDIS_URL: string;
    JWT_SECRET: string;
    JWT_EXPIRES_IN: string;
    CORS_ORIGINS: string;
}

export class EnvValidationError extends Error {
    constructor(problems: string[]) {
        super(`Invalid environment configuration:\n  - ${problems.join('\n  - ')}`);
        this.name = 'EnvValidationError';
    }
}

const readTrimmed = (source: NodeJS.ProcessEnv, key: string): string => (source[key] ?? '').trim();

/**
 * Validates a set of environment variables and returns typed configuration.
 * Pure function: it does not read .env and does not touch process.env.
 */
export const parseEnv = (source: NodeJS.ProcessEnv): AppEnv => {
    const problems: string[] = [];

    // JWT_SECRET: required, not a placeholder, at least MIN_JWT_SECRET_LENGTH characters.
    const jwtSecret = readTrimmed(source, 'JWT_SECRET');
    if (jwtSecret.length === 0) {
        problems.push('JWT_SECRET is missing or empty. Set it in .env (see .env.example).');
    } else if (jwtSecret.includes(PLACEHOLDER_MARKER)) {
        problems.push(
            `JWT_SECRET still contains the placeholder value. Replace it with a random value of at least ${MIN_JWT_SECRET_LENGTH} characters.`
        );
    } else if (jwtSecret.length < MIN_JWT_SECRET_LENGTH) {
        problems.push(
            `JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters (current length: ${jwtSecret.length}). ` +
                'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"'
        );
    }

    // DATABASE_URL: required.
    const databaseUrl = readTrimmed(source, 'DATABASE_URL');
    if (databaseUrl.length === 0) {
        problems.push('DATABASE_URL is missing or empty. Set it in .env (see .env.example).');
    }

    // PORT: optional, defaults to 5001, must be a valid TCP port.
    const portRaw = readTrimmed(source, 'PORT');
    const port = portRaw === '' ? 5001 : Number(portRaw);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        problems.push('PORT must be an integer between 1 and 65535.');
    }

    if (problems.length > 0) {
        throw new EnvValidationError(problems);
    }

    return {
        NODE_ENV: readTrimmed(source, 'NODE_ENV') || 'development',
        PORT: port,
        DATABASE_URL: databaseUrl,
        REDIS_URL: readTrimmed(source, 'REDIS_URL') || 'redis://localhost:6379',
        JWT_SECRET: jwtSecret,
        JWT_EXPIRES_IN: readTrimmed(source, 'JWT_EXPIRES_IN') || '1d',
        CORS_ORIGINS: readTrimmed(source, 'CORS_ORIGINS') || '*',
    };
};

// Load .env from the working directory. dotenv never overrides variables that are already set,
// so values from the real environment (and from tests) take precedence over .env.
loadDotenv();

export const env: AppEnv = parseEnv(process.env);
