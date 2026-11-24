# Integration Testing

**Status as of 2026-11-24 (SEC-10):** harness in place. Integration tests run against an isolated test database. Fixed findings (SEC-01, SEC-02, SEC-03, SEC-05, SEC-06, SEC-07, SEC-10) are promoted to active suites. The only remaining pending test is the DB-01 cascade defect, which fails against the current code on purpose.

Related documents: `IMPLEMENTATION_AUDIT.md` (findings and IDs), `FUTURE_IMPLEMENTATION_CHECKLIST.md` (fix tasks), `API_IMPLEMENTATION_MATRIX.md` (endpoints).

---

## 1. Test Architecture

| Layer | Config | Location | Needs a database | Command |
|---|---|---|---|---|
| Unit tests | `jest.config.ts` | `src/**/*.spec.ts` (not `src/integration/`) | No | `npm test` |
| Integration tests (pass today) | `jest.integration.config.ts` | `src/integration/*.integration.spec.ts` | Yes, test database | `npm run test:integration` |
| Pending security regressions | `jest.security-pending.config.ts` | `src/integration/*.pending.integration.spec.ts` | Yes, test database | `npm run test:integration:pending` |
| Database setup | `scripts/integration-db-setup.ts` | n/a | Yes, applies migrations | `npm run test:db:setup` |

Shared helpers live in `src/test-utils/integration/`:

| File | Purpose |
|---|---|
| `db-guard.ts` | Pure safety rules for `TEST_DATABASE_URL`. No database access. |
| `env.setup.ts` | Jest `setupFiles` entry. Validates the guard, points `DATABASE_URL` at the test database for the Jest process, and sets a random `JWT_SECRET`. |
| `harness.ts` | Imports the real Express app and Prisma client, verifies and resets the database, builds two-tenant fixtures, signs tokens with the app's `generateToken`, and exposes HTTP helpers built on supertest. |

The app is loaded as-is (`src/app.ts`). Nothing in production source was changed. Redis is not connected in integration tests (`server.ts` is not imported), so rate limiting and caching are no-ops, which keeps results deterministic.

---

## 2. Environment Variables

| Variable | Required | Used by | Notes |
|---|---|---|---|
| `TEST_DATABASE_URL` | **Yes** for integration tests and `test:db:setup` | `db-guard.ts`, `env.setup.ts`, `integration-db-setup.ts` | Must name a database matching `^psychometric_test(_[a-z0-9]+)?$`, on `localhost` or `127.0.0.1`. Never falls back to `DATABASE_URL`. |
| `DATABASE_URL` | No | Development app and Prisma CLI | Read only for comparison, so the guard can refuse the same database. Integration tests overwrite it in their own process only. Never written to `.env`. |
| `JWT_SECRET` | No | App | Integration tests set a random value per run. Do not rely on it for other purposes. |
| `NODE_ENV` | No | App | Set to `test` by the harness. |

Do not put `TEST_DATABASE_URL` in `.env`, in a committed file, or in any log. The guard's error messages do not include the connection string.

---

## 3. Test Database Setup

The development database is `psychometric_db`. The test database is a separate database on the same Postgres container. It is named `psychometric_test`, and the name is set explicitly here.

### 3.1 Create the database (once)

The container's own environment supplies the user, so no password is typed:

```bash
docker exec psychometric-postgres sh -c 'psql -U "$POSTGRES_USER" -d postgres -c "CREATE DATABASE psychometric_test;"'
```

Check it exists:

```bash
docker exec psychometric-postgres sh -c 'psql -U "$POSTGRES_USER" -d postgres -Atc "SELECT datname FROM pg_database ORDER BY 1"'
```

The setup script does not create databases. If the database is missing, it fails and points here.

### 3.2 Set the connection string (each shell)

The user and password are those of the local Postgres container (see `compose.yaml`, service `postgres`). Build the URL from the container's environment rather than typing the password:

**Bash:**

```bash
export TEST_DATABASE_URL="postgresql://$(docker exec psychometric-postgres printenv POSTGRES_USER):$(docker exec psychometric-postgres printenv POSTGRES_PASSWORD)@localhost:5433/psychometric_test?schema=public"
```

**PowerShell** (builds the same URL):

```powershell
$u = docker exec psychometric-postgres printenv POSTGRES_USER
$p = docker exec psychometric-postgres printenv POSTGRES_PASSWORD
$env:TEST_DATABASE_URL = "postgresql://${u}:${p}@localhost:5433/psychometric_test?schema=public"
```

Use your own credentials if your local container differs. Do not save the URL to a file in the repository.

### 3.3 Apply migrations

```bash
npm run test:db:setup
```

What it does:
1. Checks `TEST_DATABASE_URL` with the same guard as the tests.
2. Connects and confirms `current_database()` is `psychometric_test`.
3. Runs `prisma migrate deploy` with `DATABASE_URL` overridden to the test URL for that child process only.
4. Runs `prisma migrate status` against the same database.

It never runs `prisma migrate reset`, never drops or truncates anything, and never writes to `.env`.

Expected last lines: `Database schema is up to date!` followed by `[integration-db] Test database is ready.`

---

## 4. How to Run

| Goal | Command |
|---|---|
| Build (type check of production code) | `npm run build` |
| Unit tests (269 tests, 24 suites, no database) | `npm test` |
| Integration tests (pass today) | `npm run test:integration` |
| Pending security regressions (expected to fail today) | `npm run test:integration:pending` |
| Apply migrations to the test database | `npm run test:db:setup` |
| Migration status, test database | `DATABASE_URL="$TEST_DATABASE_URL" npx prisma migrate status` |
| Migration status, development database (read only) | `npx prisma migrate status` (reads `.env`) |

Integration commands run with `--runInBand`, so only one suite touches the database at a time. Without `TEST_DATABASE_URL` set, the integration commands fail at startup with a message that names the variable and does not fall back to the development database.

---

## 5. Fixtures and Cleanup

**Cleanup.** Before each test, `seedTwoTenants()` runs `TRUNCATE ... RESTART IDENTITY CASCADE` on the application tables (`Response`, `TestInvite`, `Question`, `Dimension`, `Student`, `PsychometricTest`, `User`, `Institute`). `_prisma_migrations` and the schema are not touched. Every test starts from an empty database.

**Fixtures.** `seedTwoTenants()` creates two fully separate institutes, `a` and `b`. Each has:
- one `ADMIN` user and one `STUDENT` user (both with `instituteId` set),
- one `Student` record,
- one `PsychometricTest`, one `Dimension`, one `Question` (scale 1 to 5),
- one `TestInvite` with a unique token,
- one `Response` linked to the student and question.

**Tokens.** `tokenFor(user)` calls the app's own `generateToken` with `{ userId, role, instituteId }`. The secret is the process `JWT_SECRET`, which the same app code reads when it verifies. Fixture users are never logged in with a password.

**HTTP.** `api.get/post/put/patch/delete(path, token?)` wrap supertest against the real app. `DENIED_STATUSES = [401, 403, 404]`. A cross-tenant lookup that answers 404 does not reveal another tenant's data, so 404 counts as denial.

---

## 6. Database Safety Protections

Applied in order, each one fail-fast:

1. **Required:** `TEST_DATABASE_URL` must be set. There is no fallback to `DATABASE_URL`.
2. **Scheme:** `postgresql://` or `postgres://` only.
3. **Development name:** a database named `psychometric_db` is refused.
4. **Name pattern:** the database name must match `^psychometric_test(_[a-z0-9]+)?$`.
5. **Local host:** `localhost` or `127.0.0.1` only.
6. **Not the development database:** refused if the name equals `DATABASE_URL`'s name, or if host, port and name all match. `DATABASE_URL` comes from the process environment, or from `.env` when the variable is unset.
7. **Live check:** before every reset, `SELECT current_database()` must equal the guarded name. The name is stored in `INTEGRATION_TEST_DB_NAME` during setup.
8. **Migrations present:** `_prisma_migrations` must exist, so the database was prepared with `migrate deploy`.
9. **No reset command:** the only Prisma commands used are `migrate deploy` and `migrate status`. `migrate reset` is not used anywhere.
10. **No secrets in output:** guard errors and the setup script print the database name and host, never the URL or password.

Verified: after the integration runs, the development database contains 0 `User` rows and 0 `Institute` rows with `@integration.test` addresses.

Items 1 to 5 are covered by pure-rule tests in `src/integration/infrastructure.integration.spec.ts`. Items 7 and 8 are covered by the live tests in the same file. Item 6 (same host, port and name as `DATABASE_URL`) is implemented but has no dedicated test yet. Adding one is a follow-up.

---

## 7. Current Results

Run on 2026-11-24 against `psychometric_test`:

| Suite | Result |
|---|---|
| `npm test` (unit, 24 suites) | 24 of 24 suites, **269 of 269 tests passed** |
| `npm run test:integration` | 8 of 8 suites, **152 of 152 tests passed** |
| `npm run test:integration:pending` | **1 of 1 failed, as designed** (DB-01, see section 8) |
| `npm run build` | Passed, exit 0 |
| `npx prisma validate` | Schema valid |
| `prisma migrate status`, test database | 3 migrations found, schema up to date |
| `prisma migrate status`, development database (read only) | 3 migrations found, schema up to date |

### 7.1 Passing integration tests (152)

**`infrastructure.integration.spec.ts` (9):** guard accepts the test database; refuses a missing URL; refuses the development database name; refuses a non-matching name; refuses a remote host; refuses a non-PostgreSQL scheme; error messages do not contain the connection string; the live connection is the guarded database with migrations applied; cleanup removes rows.

**`test-security.integration.spec.ts` (14):** SEC-01 regression tests, promoted from the pending suite once fixed. Publish and delete are scoped to the caller's institute. A spoofed `instituteId` in the body is ignored. A foreign and a non-existent test return the same 404. STUDENT gets 403 and no token gets 401.

**`institute-security.integration.spec.ts` (16):** SEC-02 regression tests, promoted from the pending suite once fixed. Every institute route requires the ADMIN role (STUDENT gets 403). An ADMIN can act only on their own institute: a foreign institute returns 404 with no data returned and no cascade run. A foreign and a non-existent institute get the same response. A spoofed `instituteId` in the body or query does not widen scope. Unauthenticated requests get 401. Own-institute DELETE is not asserted here (see the DB-01 pending entry in section 8).

**`response-security.integration.spec.ts` (20):** SEC-03 regression tests, promoted from the pending suite once fixed. The list, the student read, the test read and the delete are ADMIN-only (STUDENT gets 403, no token gets 401). An ADMIN sees and deletes only responses whose student and test both belong to their institute. A student or test of another institute returns 404 and no response data. A foreign and a non-existent response get the same response. A query or body `instituteId` does not widen scope. A token with an empty `instituteId` fails closed (403 on list, 404 on lookups, no rows touched). The student submission flow (`POST /responses/submit`) still returns 201 for the student's own invite.

**`invite-security.integration.spec.ts` (24):** SEC-05 regression tests, promoted from the pending suite once fixed. Every invite route requires the ADMIN role (STUDENT gets 403, no token gets 401). Invite listings (`GET /invites`, the test list and the student list) never return a `token` field or any token value. A token is returned once, in the 201 response to the admin who creates the invite, and it is a 64-character hex value. Admin A sees only institute A invites, and a query `instituteId` is ignored. Listing, creating or revoking against another institute returns 404 with no B data, and a foreign and a non-existent invite get the same response. Revoking an invite makes its token refused on submission. Unknown, expired and already-used tokens are refused with fixed messages, and the sent token is not echoed. A valid, unexpired invite still submits (201).

**`assessment-structure-security.integration.spec.ts` (27):** SEC-06 regression tests, promoted from the pending suite once fixed. Dimension and question writes (create and delete) require ADMIN: STUDENT gets 403, no token gets 401. Admin A creates and deletes dimensions and questions in institute A (201 and 200). Admin A cannot create, list or delete anything in institute B: 404, and institute B rows stay active or unchanged. A dimension of another institute cannot take a question (404). An inactive own test blocks writes (404). Each write checks the full parent chain (test active and in the institute, dimension active, and question's dimension and test) before any write or cascade. Global dimension and question lists are scoped to the institute, and a query `instituteId` is ignored. A token without an institute fails closed (403 on the list, 404 or 403 on the rest). A body `instituteId` does not widen scope.

**`report-security.integration.spec.ts` (21):** SEC-10 regression tests, promoted from the pending suite once fixed, together with the report-parameter functional test. Every report route requires ADMIN: STUDENT gets 403, no token gets 401. The handlers read `:testId` and `:studentId` from the route, so valid requests return 200. The student report route returns one student, not the whole test. An ADMIN of A gets accurate scores from active responses (answer 3 gives score 3). A foreign or non-existent test or student returns the same 404. Inactive students, tests, dimensions, questions and responses are left out: an inactive student or test gets 404 on the single report, an inactive test drops out of the list, and a deactivated response or question does not count toward the score. Query and body `instituteId` values are ignored. A token without an institute fails closed with 403.

**Report access policy.** All report routes are ADMIN-only. Student self-service reports are not offered, because `Student` is not linked to `User` (DEC-03 is still open), so a STUDENT token cannot be matched to a student record. Revisit this when DEC-03 is decided.

**Read policy for dimensions and questions.** Reads are not restricted to ADMIN. Any authenticated user may read the dimensions and questions of their own institute. A STUDENT of institute A can read an A test's dimensions (200), and a foreign test or dimension returns 404. The reason is that a STUDENT is not yet linked to a test (DEC-03), so an ADMIN-only read would remove the only read path students have. Writes stay ADMIN-only. There are no update (PUT) routes for dimensions or questions, so the update case in the brief has no route to test. None was added.

**`guards.integration.spec.ts` (21):** these are regression guards. They pass today and must keep passing. They are not evidence that an audit finding is fixed.

| Area | What is guarded |
|---|---|
| Harness | App-issued JWT accepted on a protected route; no token gives 401 |
| Students (SEC-09 area) | Admin of A sees A students only |
| Test publish (SEC-01 area) | Own test publishes (200); STUDENT cannot publish (403). Cross-institute cases are in test-security.integration.spec.ts |
| Institutes (SEC-02 area) | No token gives 401; admin reads own institute (200); STUDENT cannot list institutes (403) |
| Responses (SEC-03 area) | No token gives 401 on a test-response read. Full SEC-03 coverage is in response-security.integration.spec.ts |
| Invites (SEC-05 area) | Admin sees own test invites with no token; another institute's test invites are denied and do not expose the token. Full SEC-05 coverage is in invite-security.integration.spec.ts |
| Dimensions (SEC-06 area) | Admin adds a dimension to own test (201); STUDENT cannot add one (403). Full SEC-06 coverage is in assessment-structure-security.integration.spec.ts |
| Reports (SEC-10 area) | STUDENT cannot read a test report (403). Full SEC-10 coverage is in report-security.integration.spec.ts |

---

## 8. Pending Security Regression Tests

These tests assert the **secure** behaviour. Against the current code they fail. A failure is evidence of the finding named in the test title. Nothing is skipped and no assertion has been weakened. A test turns green only when a real production fix is made.

Run them with `npm run test:integration:pending`.

| Audit ID | Scenario | Observed today | Status |
|---|---|---|---|
| DB-01 | Admin of A soft deletes their own institute | **500** (cascade lookup defect) | Pending until DB-01 is fixed |

Counting: 1 pending test in total: the DB-01 cascade defect that blocks the own-institute delete. SEC-01, SEC-02, SEC-03, SEC-05, SEC-06, SEC-07 and SEC-10 were fixed and promoted to active suites (`test-security.integration.spec.ts`, `institute-security.integration.spec.ts`, `response-security.integration.spec.ts`, `invite-security.integration.spec.ts`, `assessment-structure-security.integration.spec.ts`, `report-security.integration.spec.ts`, `guards.integration.spec.ts`, `src/config/env.process.spec.ts`).

### 8.1 Report parameter defect (fixed under SEC-10)

Previously `report.controller.ts` read `req.params.id` while the routes define `:testId` and `:studentId`, so every valid report request returned 400. The student report route also called the test-report handler and so could not return one student. Both are fixed: the handlers read the route parameters, and the student route has its own handler. The regression tests are in `report-security.integration.spec.ts`.

### 8.2 Items that need attention beyond the audit

- **Institute deletion returns 500 for the owning admin.** A foreign admin gets 404 (SEC-02). The owning admin's delete reaches the cascade helper, which fails with a Prisma invocation error (DB-01). This is the one remaining pending test.

---

## 9. Known Limitations

- **Startup configuration (SEC-07) is tested outside the integration suite.** The integration harness always provides a valid `JWT_SECRET`, so startup refusal is covered by `src/config/env.process.spec.ts`, which runs in the unit suite and loads `env.ts` in a fresh Node process. Integration tests cover HTTP 401 for missing, malformed, expired, wrong-secret and tampered tokens (`guards.integration.spec.ts`).
- **No Redis in tests.** `server.ts` is not imported, so `connectRedis` never runs. Global and auth rate limiting, and the dimension cache, are no-ops. Rate-limit behaviour is not covered by integration tests.
- **Sequential only.** `--runInBand` is required. Parallel runs would share one database.
- **Single shared test database.** Suites are isolated by truncation, not by separate schemas.
- **Student identity is not modelled.** `Student` has no link to `User`, so STUDENT-role tests use a `User` with no matching `Student` record. Tests for "a student reads their own data" cannot be written until DEC-03 is decided.
- **No load or timing tests.** Report performance (N+1 queries) is not measured.
- **Swagger is not tested.** Path drift is documented in `API_IMPLEMENTATION_MATRIX.md` but not asserted.
- **Console noise.** The app logs every request's business events and error details to the console during tests.
- **supertest is imported but was not in use before SEC-11.** It is now used by `harness.ts`. It is a dev dependency already in `package.json`, so no new dependency was added.

---

## 10. Adding a Regression Test

1. Write the test in `src/integration/` with the matching `.integration.spec.ts` name if it should pass now, or `.pending.integration.spec.ts` if it asserts behaviour the code does not yet have.
2. Use `seedTwoTenants()` in `beforeEach`, and the `api` helpers with the right token.
3. Assert the denial with `DENIED_STATUSES` and check the database for no side effects. Do not assert only the status.
4. Never loosen an assertion to make a pending test pass. Fix the production code, then move the test to the normal suite.
