import { MIN_JWT_SECRET_LENGTH, parseEnv, EnvValidationError } from './env';

const VALID_SECRET = 'a'.repeat(MIN_JWT_SECRET_LENGTH + 16);
const base = (overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv => ({
    DATABASE_URL: 'postgresql://user:pw@localhost:5433/psychometric_db',
    JWT_SECRET: VALID_SECRET,
    ...overrides,
});

describe('parseEnv: JWT_SECRET validation', () => {
    test('accepts a secret of at least 32 characters', () => {
        expect(parseEnv(base({ JWT_SECRET: 'b'.repeat(32) })).JWT_SECRET).toBe('b'.repeat(32));
    });

    test('refuses a missing JWT_SECRET', () => {
        const { JWT_SECRET, ...without } = base();
        expect(() => parseEnv(without)).toThrow(EnvValidationError);
        expect(() => parseEnv(without)).toThrow(/JWT_SECRET is missing or empty/);
    });

    test('refuses an empty or whitespace-only JWT_SECRET', () => {
        expect(() => parseEnv(base({ JWT_SECRET: '' }))).toThrow(/JWT_SECRET is missing or empty/);
        expect(() => parseEnv(base({ JWT_SECRET: '      ' }))).toThrow(/JWT_SECRET is missing or empty/);
    });

    test('refuses a secret shorter than 32 characters and reports only the length', () => {
        const weak = 'short-but-secret-123';
        let message = '';
        try {
            parseEnv(base({ JWT_SECRET: weak }));
        } catch (error) {
            message = (error as Error).message;
        }
        expect(message).toMatch(/JWT_SECRET must be at least 32 characters \(current length: 20\)/);
        expect(message).not.toContain(weak);
    });

    test('refuses the .env.example placeholder even when it is long enough', () => {
        const placeholder = 'CHANGE_ME_replace_with_random_value_of_at_least_32_chars';
        expect(() => parseEnv(base({ JWT_SECRET: placeholder }))).toThrow(/placeholder value/);
        expect(() => parseEnv(base({ JWT_SECRET: placeholder }))).not.toThrow(/CHANGE_ME_replace/);
    });

    test('trims surrounding whitespace before measuring the secret', () => {
        const padded = `   ${'c'.repeat(31)}   `;
        expect(() => parseEnv(base({ JWT_SECRET: padded }))).toThrow(/current length: 31/);
    });
});

describe('parseEnv: other settings', () => {
    test('refuses a missing DATABASE_URL', () => {
        const { DATABASE_URL, ...without } = base();
        expect(() => parseEnv(without)).toThrow(/DATABASE_URL is missing or empty/);
    });

    test('refuses an invalid PORT', () => {
        expect(() => parseEnv(base({ PORT: 'abc' }))).toThrow(/PORT must be an integer/);
        expect(() => parseEnv(base({ PORT: '70000' }))).toThrow(/PORT must be an integer/);
    });

    test('applies documented defaults when optional values are absent', () => {
        const parsed = parseEnv(base());
        expect(parsed).toEqual({
            NODE_ENV: 'development',
            PORT: 5001,
            DATABASE_URL: 'postgresql://user:pw@localhost:5433/psychometric_db',
            REDIS_URL: 'redis://localhost:6379',
            JWT_SECRET: VALID_SECRET,
            JWT_EXPIRES_IN: '1d',
            CORS_ORIGINS: '*',
        });
    });

    test('reports every problem at once, without any secret value', () => {
        let message = '';
        try {
            parseEnv({ JWT_SECRET: 'weak-value', PORT: 'x' });
        } catch (error) {
            message = (error as Error).message;
        }
        expect(message).toContain('JWT_SECRET must be at least 32 characters');
        expect(message).toContain('DATABASE_URL is missing or empty');
        expect(message).toContain('PORT must be an integer');
        expect(message).not.toContain('weak-value');
    });
});
