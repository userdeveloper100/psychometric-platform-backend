/**
 * Jest setupFiles entry for unit tests.
 *
 * Several unit specs import modules that validate configuration when they load
 * (src/config/env.ts). This gives them a valid test JWT_SECRET before any import.
 * It does not read or modify .env. Values already set in the real environment are kept
 * for DATABASE_URL. Unit tests never connect to the database.
 */

import { randomBytes } from 'crypto';

process.env.JWT_SECRET = randomBytes(48).toString('hex');
process.env.DATABASE_URL ??= 'postgresql://unit-test-placeholder@localhost:5432/unit_test_placeholder';
