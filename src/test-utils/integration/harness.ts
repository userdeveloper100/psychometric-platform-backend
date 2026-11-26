/**
 * Reusable integration-test harness: app and Prisma wiring, database
 * verification and cleanup, two-tenant fixtures, JWT helpers and HTTP helpers.
 *
 * Import this only from integration specs. env.setup.ts has already pointed
 * DATABASE_URL at the verified test database by the time this module loads.
 */

import { randomUUID } from 'crypto';
import request, { Test } from 'supertest';
import type { Dimension, Institute, PsychometricTest, Question, Response, Student, TestInvite, User } from '@prisma/client';
import app from '../../app';
import prisma from '../../config/prisma';
import { generateToken } from '../../utils/jwt';

export { app, prisma };

// Placeholder for the non-null User.password column. Fixtures authenticate with
// generated JWTs, so this value is never used to log in.
const FIXTURE_PASSWORD_PLACEHOLDER = 'integration-fixture-not-a-login';

// ─── Database verification and cleanup ───────────────────────────────────────

/** Confirms the live connection is the guarded test database and migrations exist. */
export const verifyConnectedTestDatabase = async (): Promise<void> => {
    const expected = process.env.INTEGRATION_TEST_DB_NAME;
    if (!expected) {
        throw new Error('Integration environment not initialised: INTEGRATION_TEST_DB_NAME is missing.');
    }

    const [current] = await prisma.$queryRaw<{ name: string }[]>`SELECT current_database() AS name`;
    if (current?.name !== expected) {
        throw new Error('Connected database does not match the guarded test database. Refusing to continue.');
    }

    const [migrationsTable] = await prisma.$queryRaw<{ regclass: string | null }[]>`
        SELECT to_regclass('"_prisma_migrations"')::text AS regclass`;
    if (!migrationsTable?.regclass) {
        throw new Error('Test database has no migrations applied. Run: npm run test:db:setup');
    }
};

/** Removes all application rows from the verified test database. Keeps the schema. */
export const resetTestDatabase = async (): Promise<void> => {
    await verifyConnectedTestDatabase();
    await prisma.$executeRawUnsafe(
        'TRUNCATE TABLE "Response", "TestInvite", "UserInvite", "Question", "Dimension", "Student", ' +
            '"PsychometricTest", "User", "Institute" RESTART IDENTITY CASCADE'
    );
};

// ─── Fixtures ────────────────────────────────────────────────────────────────

export interface TenantFixture {
    institute: Institute;
    admin: User;
    studentUser: User;
    student: Student;
    test: PsychometricTest;
    dimension: Dimension;
    question: Question;
    invite: TestInvite;
    response: Response;
    adminToken: string;
    studentToken: string;
}

export interface TwoTenantFixture {
    a: TenantFixture;
    b: TenantFixture;
}

/** Signs a token with the app's own generateToken and the process JWT secret. */
export const tokenFor = (user: Pick<User, 'id' | 'role' | 'instituteId'>): string =>
    generateToken({ userId: user.id, role: user.role, instituteId: user.instituteId });

const createTenant = async (label: string): Promise<TenantFixture> => {
    const institute = await prisma.institute.create({
        data: { name: `${label} institute`, email: `${label}-institute@integration.test` },
    });

    const admin = await prisma.user.create({
        data: {
            email: `admin-${label}@integration.test`,
            password: FIXTURE_PASSWORD_PLACEHOLDER,
            role: 'ADMIN',
            instituteId: institute.id,
        },
    });

    const studentUser = await prisma.user.create({
        data: {
            email: `student-user-${label}@integration.test`,
            password: FIXTURE_PASSWORD_PLACEHOLDER,
            role: 'STUDENT',
            instituteId: institute.id,
        },
    });

    const student = await prisma.student.create({
        data: { name: `${label} student`, email: `student-${label}@integration.test`, instituteId: institute.id },
    });

    const test = await prisma.psychometricTest.create({
        data: { title: `${label} test`, description: `${label} description`, instituteId: institute.id },
    });

    const dimension = await prisma.dimension.create({
        data: { name: `${label} dimension`, testId: test.id },
    });

    const question = await prisma.question.create({
        data: { text: `${label} question`, dimensionId: dimension.id, scaleMin: 1, scaleMax: 5 },
    });

    const invite = await prisma.testInvite.create({
        data: { testId: test.id, studentId: student.id, token: `invite-${label}-${randomUUID()}` },
    });

    const response = await prisma.response.create({
        data: { questionId: question.id, studentId: student.id, answer: 3 },
    });

    return {
        institute,
        admin,
        studentUser,
        student,
        test,
        dimension,
        question,
        invite,
        response,
        adminToken: tokenFor(admin),
        studentToken: tokenFor(studentUser),
    };
};

/** Resets the database and seeds two fully separate institutes, A and B. */
export const seedTwoTenants = async (): Promise<TwoTenantFixture> => {
    await resetTestDatabase();
    const a = await createTenant('a');
    const b = await createTenant('b');
    return { a, b };
};

// ─── HTTP helpers ────────────────────────────────────────────────────────────

const withAuth = (req: Test, token?: string): Test =>
    token ? req.set('Authorization', `Bearer ${token}`) : req;

export const api = {
    get: (path: string, token?: string) => withAuth(request(app).get(path), token),
    post: (path: string, token?: string) => withAuth(request(app).post(path), token),
    put: (path: string, token?: string) => withAuth(request(app).put(path), token),
    patch: (path: string, token?: string) => withAuth(request(app).patch(path), token),
    delete: (path: string, token?: string) => withAuth(request(app).delete(path), token),
};

/**
 * Statuses that mean "the request was refused". 404 is included on purpose:
 * a cross-tenant lookup that reports "not found" does not reveal another tenant's data.
 */
export const DENIED_STATUSES = [401, 403, 404];

/** Serialises a response body so tests can check that a value does not appear anywhere in it. */
export const bodyText = (res: { body: unknown }): string => JSON.stringify(res.body ?? {});
