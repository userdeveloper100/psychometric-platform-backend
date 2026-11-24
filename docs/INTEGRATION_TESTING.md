# Integration Testing

**Status as of 2026-11-24 (SEC-11):** harness in place. Integration tests run against an isolated test database. Security regression tests are written but **pending**: they fail against the current code on purpose, and that failure is the evidence for each audit finding.

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
| Unit tests (106 tests, 13 suites, no database) | `npm test` |
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
| `npm test` (unit, 13 suites) | 13 of 13 suites, **106 of 106 tests passed** |
| `npm run test:integration` | 2 of 2 suites, **23 of 23 tests passed** |
| `npm run test:integration:pending` | **21 of 21 failed, as designed** (see section 8) |
| `npm run build` | Passed, exit 0 |
| `npx prisma validate` | Schema valid |
| `prisma migrate status`, test database | 3 migrations found, schema up to date |
| `prisma migrate status`, development database (read only) | 3 migrations found, schema up to date |

### 7.1 Passing integration tests (23)

**`infrastructure.integration.spec.ts` (9):** guard accepts the test database; refuses a missing URL; refuses the development database name; refuses a non-matching name; refuses a remote host; refuses a non-PostgreSQL scheme; error messages do not contain the connection string; the live connection is the guarded database with migrations applied; cleanup removes rows.

**`guards.integration.spec.ts` (14):** these are regression guards. They pass today and must keep passing. They are not evidence that an audit finding is fixed.

| Area | What is guarded |
|---|---|
| Harness | App-issued JWT accepted on a protected route; no token gives 401 |
| Students (SEC-09 area) | Admin of A sees A students only |
| Test publish (SEC-01 area) | Own test publishes (200); another institute's test without a body id is refused (403); STUDENT cannot publish (403) |
| Institutes (SEC-02 area) | No token gives 401; admin reads own institute (200) |
| Responses (SEC-03 area) | No token gives 401 on a test-response read |
| Invites (SEC-05 area) | Admin sees own test invite tokens; another institute's invites are denied and do not expose the token |
| Dimensions (SEC-06 area) | Admin adds a dimension to own test (201); STUDENT cannot add one (403) |
| Reports (SEC-10 area) | STUDENT cannot read a test report (403) |

---

## 8. Pending Security Regression Tests

These tests assert the **secure** behaviour. Against the current code they fail. A failure is evidence of the finding named in the test title. Nothing is skipped and no assertion has been weakened. A test turns green only when a real production fix is made.

Run them with `npm run test:integration:pending`.

| Audit ID | Scenario | Observed today | Status |
|---|---|---|---|
| SEC-01 | Admin of A publishes B test by sending B `instituteId` in body | **200**, B test becomes PUBLISHED | Vulnerability confirmed |
| SEC-01 | Admin of A deletes B test by sending B `instituteId` in body | **200** | Vulnerability confirmed |
| SEC-02 | STUDENT creates an institute | **201** | Vulnerability confirmed |
| SEC-02 | STUDENT reads another institute | **200** | Vulnerability confirmed |
| SEC-02 | Admin of A renames institute B | **200** | Vulnerability confirmed |
| SEC-02 | Admin of A soft deletes institute B | **500**: Prisma error inside the cascade (`softDelete.ts:72`) | Denial missing. Failure is also the cascade defect (DB-01). |
| SEC-03 | STUDENT lists all responses | **200** | Vulnerability confirmed |
| SEC-03 | Admin of A deletes a response of B | **200** | Vulnerability confirmed |
| SEC-03 | Admin of A reads the responses of B test | **200**, with B data | Vulnerability confirmed |
| SEC-03 | STUDENT reads responses of another student | **200** | Vulnerability confirmed |
| SEC-05 | Admin of A lists all invites: B token present | **200**, B token in body | Vulnerability confirmed |
| SEC-05 | STUDENT reads invite tokens of a student record | **200**, token in body | Vulnerability confirmed |
| SEC-06 | Admin of A adds a dimension to B test | **201** | Vulnerability confirmed |
| SEC-06 | Admin of A adds a question to B dimension | **201** | Vulnerability confirmed |
| SEC-06 | Admin of A soft deletes B dimension | **200** | Vulnerability confirmed |
| SEC-06 | Admin of A soft deletes B question | **200** | Vulnerability confirmed |
| SEC-10 | Admin of A reads B test report | **400** (functional defect, see below) | **Inconclusive**: the leak cannot be shown until the defect is fixed |
| SEC-10 | Admin of A reads B student report | **400** (functional defect) | **Inconclusive** |
| SEC-10 | Same-tenant student report returns one student | **400** (functional defect) | Functional failure |
| SEC-07 | Token from `utils/jwt` verified by `authenticateJWT` without `JWT_SECRET` in environment | **Rejected** (signing and verifying modules use different fallback secrets) | Vulnerability confirmed |
| FUNCTIONAL-DEFECT | Admin gets own test report | **400** (see below) | Functional defect, not a security finding |

Counting: 21 pending tests in total, of which 20 are security regressions and 1 is the functional defect.

### 8.1 Functional defect that blocks SEC-10 evidence

`src/modules/reports/report.routes.ts` declares `'/reports/test/:testId'` (and the student route with `:studentId` and `:testId`), but `src/modules/reports/report.controller.ts` reads `req.params.id`. Every valid report request therefore returns 400 `Test ID is required`. The student report route uses the same handler, so it also cannot return a student report.

This is not a security finding and it was not fixed here, because production code must not change in this task. Until it is fixed, the SEC-10 cross-tenant tests cannot show whether the tenant check is missing. They fail on the 400 before any check runs.

### 8.2 Items that need attention beyond the audit

- **Institute deletion returns 500** for a foreign admin. The cause is a Prisma invocation error in the cascade helper. Institute deletion may fail for every caller. This has not been tested with the owning admin, so the scope is unverified.

---

## 9. Known Limitations

- **Startup configuration (SEC-07) is only partly testable.** The harness sets `JWT_SECRET` for each test file, so the normal suite cannot see a missing secret. The pending test checks the mismatch in isolated modules. It does not test that the server refuses to start without the variable. That needs a separate process-level test, planned in SEC-07.
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
