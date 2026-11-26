# Integration Testing

**Status as of 2026-11-26 (DEC-02):** harness in place. Integration tests run against an isolated test database. Fixed findings (SEC-01, SEC-02, SEC-03, SEC-05, SEC-06, SEC-07, SEC-10), the soft-delete cascade defect (DB-01), student re-invitation (DB-02), response integrity (DB-03) and the Step 12 release gate (structured security logging, tenant-scoped lists, route-level role checks, safe error responses) the standardized `/api/v1` routes (DEC-04) and the token-bound candidate flow (DEC-03) and invitation-only onboarding (DEC-02) are promoted to active suites. No pending tests remain. The pending suite is empty, so its script passes with no tests (see section 8).

Related documents: `IMPLEMENTATION_AUDIT.md` (findings and IDs), `FUTURE_IMPLEMENTATION_CHECKLIST.md` (fix tasks), `API_IMPLEMENTATION_MATRIX.md` (endpoints).

---

## 1. Test Architecture

| Layer | Config | Location | Needs a database | Command |
|---|---|---|---|---|
| Unit tests | `jest.config.ts` | `src/**/*.spec.ts` (not `src/integration/`) | No | `npm test` |
| Integration tests (pass today) | `jest.integration.config.ts` | `src/integration/*.integration.spec.ts` | Yes, test database | `npm run test:integration` |
| Pending security regressions (none at present) | `jest.security-pending.config.ts` | `src/integration/*.pending.integration.spec.ts` | Yes, test database | `npm run test:integration:pending` |
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
| Unit tests (333 tests, 28 suites, no database) | `npm test` |
| Integration tests (pass today) | `npm run test:integration` |
| Pending security regressions (none at present; the script passes with no tests) | `npm run test:integration:pending` |
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

Run on 2026-11-26 against `psychometric_test`:

| Suite | Result |
|---|---|
| `npm test` (unit, 29 suites) | 29 of 29 suites, **378 of 378 tests passed** |
| `npm run test:integration` | 15 of 15 suites, **277 of 277 tests passed** |
| `npm run test:integration:pending` | **No pending tests remain.** The script exits 0 with `--passWithNoTests` (see section 8) |
| `npm run build` | Passed, exit 0 |
| `npx prisma validate` | Schema valid |
| `prisma migrate status`, test database | 3 migrations found, schema up to date |
| `prisma migrate status`, development database (read only) | 3 migrations found, schema up to date |

### 7.1 Passing integration tests (277)

**`infrastructure.integration.spec.ts` (9):** guard accepts the test database; refuses a missing URL; refuses the development database name; refuses a non-matching name; refuses a remote host; refuses a non-PostgreSQL scheme; error messages do not contain the connection string; the live connection is the guarded database with migrations applied; cleanup removes rows.

**`test-security.integration.spec.ts` (14):** SEC-01 regression tests, promoted from the pending suite once fixed. Publish and delete are scoped to the caller's institute. A spoofed `instituteId` in the body is ignored. A foreign and a non-existent test return the same 404. STUDENT gets 403 and no token gets 401.

**`institute-security.integration.spec.ts` (16):** SEC-02 regression tests, promoted from the pending suite once fixed. Every institute route requires the ADMIN role (STUDENT gets 403). An ADMIN can act only on their own institute: a foreign institute returns 404 with no data returned and no cascade run. A foreign and a non-existent institute get the same response. A spoofed `instituteId` in the body or query does not widen scope. Unauthenticated requests get 401. Own-institute DELETE is not asserted here. It is covered in soft-delete-cascade.integration.spec.ts (DB-01).

**`response-security.integration.spec.ts` (20):** SEC-03 regression tests, promoted from the pending suite once fixed. The list, the student read, the test read and the delete are ADMIN-only (STUDENT gets 403, no token gets 401). An ADMIN sees and deletes only responses whose student and test both belong to their institute. A student or test of another institute returns 404 and no response data. A foreign and a non-existent response get the same response. A query or body `instituteId` does not widen scope. A token with an empty `instituteId` fails closed (403 on list, 404 on lookups, no rows touched). The student submission flow (`POST /responses/submit`) still returns 201 for the student's own invite.

**`invite-security.integration.spec.ts` (24):** SEC-05 regression tests, promoted from the pending suite once fixed. Every invite route requires the ADMIN role (STUDENT gets 403, no token gets 401). Invite listings (`GET /invites`, the test list and the student list) never return a `token` field or any token value. A token is returned once, in the 201 response to the admin who creates the invite, and it is a 64-character hex value. Admin A sees only institute A invites, and a query `instituteId` is ignored. Listing, creating or revoking against another institute returns 404 with no B data, and a foreign and a non-existent invite get the same response. Revoking an invite makes its token refused on submission. Unknown, expired and already-used tokens are refused with fixed messages, and the sent token is not echoed. A valid, unexpired invite still submits (201).

**`assessment-structure-security.integration.spec.ts` (27):** SEC-06 regression tests, promoted from the pending suite once fixed. Dimension and question writes (create and delete) require ADMIN: STUDENT gets 403, no token gets 401. Admin A creates and deletes dimensions and questions in institute A (201 and 200). Admin A cannot create, list or delete anything in institute B: 404, and institute B rows stay active or unchanged. A dimension of another institute cannot take a question (404). An inactive own test blocks writes (404). Each write checks the full parent chain (test active and in the institute, dimension active, and question's dimension and test) before any write or cascade. Global dimension and question lists are scoped to the institute, and a query `instituteId` is ignored. A token without an institute fails closed (403 on the list, 404 or 403 on the rest). A body `instituteId` does not widen scope.

**`report-security.integration.spec.ts` (21):** SEC-10 regression tests, promoted from the pending suite once fixed, together with the report-parameter functional test. Every report route requires ADMIN: STUDENT gets 403, no token gets 401. The handlers read `:testId` and `:studentId` from the route, so valid requests return 200. The student report route returns one student, not the whole test. An ADMIN of A gets accurate scores from active responses (answer 3 gives score 3). A foreign or non-existent test or student returns the same 404. Inactive students, tests, dimensions, questions and responses are left out: an inactive student or test gets 404 on the single report, an inactive test drops out of the list, and a deactivated response or question does not count toward the score. Query and body `instituteId` values are ignored. A token without an institute fails closed with 403.

**Report access policy.** All report routes are ADMIN-only. Student self-service reports are not offered. DEC-03 identifies a candidate by the invite token, not by an account, and `Student` is still not linked to `User`, so a STUDENT token cannot be matched to a student record. Linking the two would need its own decision.

**`soft-delete-cascade.integration.spec.ts` (18):** DB-01 regression tests, including the own-institute delete that was previously pending. Deleting an own institute returns 200 and soft deletes every dependent row: tests, dimensions, questions, students, invites, responses and users. Each of these has `updatedBy` set to the acting user, never the institute id. Deleting an own test cascades to its dimensions, questions, invites and responses, and leaves the institute and the student active. Deleting an own dimension cascades to its questions and their responses. Deleting an own question cascades to its responses. Deleting an own student cascades to its invites and responses. Cross-tenant deletes return 404 and leave institute B untouched. Deleting the same test twice returns 404 and keeps the first `updatedBy`. No row is ever removed; each cascade sets `isActive` to false.

**`invite-reinvitation.integration.spec.ts` (13):** DB-02 regression tests. A revoked invite is re-issued with a new token on the same row (`testId, studentId` is unique in the schema, so a second row cannot be inserted). The new token submits (201), and the old token is refused (400). An expired invite is re-issued the same way. A duplicate active, unexpired invite is skipped and its token is unchanged. A completed invite is never re-issued, active or revoked. A soft-deleted student's old id gets 404. Deleting a student and re-creating them with the same email, then inviting the new record, works end to end. Re-invite is tenant scoped: a foreign student or a foreign test gets 404 with no row written, and a foreign and a missing student get the same response.

**`response-integrity.integration.spec.ts` (17):** DB-03 regression tests. A valid submission creates responses for the invite's student and marks the invite COMPLETED in one transaction (201). Extra body values (`instituteId`, `testId`, a different `studentId`) do not move a response: the invite decides, and a mismatched `studentId` is refused (400). A question from another test of the same institute, from a test of another institute, a deactivated question, a question under an inactive dimension, and a question of an inactive test are each refused (400) with zero rows written and the invite still open. A payload that mixes a valid and a foreign question writes nothing. Duplicate `questionId` entries, an empty array, a non-array `responses`, a string or fractional answer, and an out-of-scale answer are refused (400) with zero rows. A re-submission for a completed invite is refused (400). Two concurrent submissions for one invite produce exactly one 201 and one 400, with one stored row. A deactivated student's invite is refused with the generic message, and the token is not echoed.

**`release-gate.integration.spec.ts` (15):** Step 12 regression tests. `GET /api/v1/tests` returns only the requester's institute, and a query `instituteId` cannot widen it. A token with no institute gets 403. A STUDENT gets 403 on test create, publish and delete, and nothing changes. `GET /api/v1/auth/users` lists only the requester's institute users, is ADMIN-only (STUDENT 403, no token 401). The security log is checked end to end: an invalid token writes `auth_failed` and the token is not in any logged entry. A denied STUDENT writes `authorization_denied` with the route template. Publishing a test writes `sensitive_admin_action`. A foreign test writes a not-found-in-scope denial. A refused invite writes `invite_validation_failed` with the fixed reason, and neither the submitted token nor a valid invite token is logged.

**`onboarding-invite.integration.spec.ts` (21):** DEC-02 regression tests. Public registration returns 403, creates nothing, and logs `authorization_denied`. An ADMIN issues an invite (201). The token is shown once and stored only as a hash. A STUDENT gets 403 and an anonymous caller gets 401. Listing and revoking are scoped to the institute, so Admin A cannot revoke Institute B's invite (404). An invite is accepted with the token in the body, creates the user in the invited institute and role, and cannot be reused. An unknown, expired, revoked, used, inactive-institute or existing-email invite gets the same 400. A token in the URL is not accepted.

**`candidate-invite-flow.integration.spec.ts` (22):** DEC-03 regression tests. A candidate loads the assessment with the invite token alone (200, no JWT). The payload has the test, the active dimensions and the active questions, and no other tenant data or internal fields. Inactive dimensions and questions are excluded. An unknown, expired, revoked, completed, or inactive-parent token gets one generic 404 with no token in the body, and the refusal logs `invite_validation_failed` without the token. A candidate submits with the token and no JWT (201), then cannot reload or resubmit. A STUDENT JWT gets 403 on the test, dimension and question lists.

**`api-versioning.integration.spec.ts` (19):** DEC-04 regression tests. Each module answers under `/api/v1/<resource>`: auth users, institute by id, the test list, the dimension and question reads, students, invites, responses (list, test read, submit, delete) and reports (test and student). The tenant and role rules still apply on the versioned paths (a STUDENT gets 403, a foreign test gets 404). `GET /health` is served at the root. The old unversioned `/api/v1/...` paths return 404 even with a valid admin token, `/api/v1/health` returns 404, and the duplicated `/responses/responses`, `/reports/reports`, `/dimensions/dimensions` and `/questions/questions` paths return 404. Those 404 requests change no rows.

**Read policy for dimensions and questions (DEC-03).** The test list, the dimension list, the per-test dimension list, the question list and the per-dimension question list are ADMIN-only. A STUDENT token gets 403 on each, and a foreign test or dimension returns 404 to an ADMIN. A candidate reads their assessment only through `POST /api/v1/invites/assessment`, with the invite token. Writes stay ADMIN-only. There are no update (PUT) routes for dimensions or questions, so the update case in the brief has no route to test. None was added.

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
No pending tests remain. Every item from the original pending list has been fixed and promoted to an active suite:

| Audit ID | Promoted to |
|---|---|
| SEC-01 | `test-security.integration.spec.ts` |
| SEC-02 | `institute-security.integration.spec.ts` |
| SEC-03 | `response-security.integration.spec.ts` |
| SEC-05 | `invite-security.integration.spec.ts` |
| SEC-06 | `assessment-structure-security.integration.spec.ts` |
| SEC-07 | `guards.integration.spec.ts`, `src/config/env.process.spec.ts` |
| SEC-10 and the report-parameter defect | `report-security.integration.spec.ts` |
| DB-01 (own-institute delete, and the cascades) | `soft-delete-cascade.integration.spec.ts` |

`security.pending.integration.spec.ts` was deleted once its last test was promoted. The `test:integration:pending` script is kept, with `--passWithNoTests`, so it exits 0 while there are no pending tests. Jest exits 1 on "No tests found" without that flag. The pending config and its `testMatch` stay in place for the next pending regression. DB-02 and DB-03 have no pending tests yet.

### 8.1 Report parameter defect (fixed under SEC-10)

Previously `report.controller.ts` read `req.params.id` while the routes define `:testId` and `:studentId`, so every valid report request returned 400. The student report route also called the test-report handler and so could not return one student. Both are fixed: the handlers read the route parameters, and the student route has its own handler. The regression tests are in `report-security.integration.spec.ts`.

### 8.2 Items that need attention beyond the audit

- **Student re-invitation (DB-02, fixed).** Two blockers. First, `TestInvite` has `@@unique([testId, studentId])`, and the invite service only looked at active rows, so re-inviting after a revoke or expiry hit a unique-constraint error (returned as 400). The fix reuses the existing row with a new token, instead of inserting a second one, and it skips completed and duplicate active invites. No migration was needed. Second, `POST /api/v1/students/AddStudent` required a body `instituteId` that the server never used, so a student could not be re-created. That rule is removed. A soft-deleted student is not restored by id. Re-create the student with the same email instead.

- **Response integrity (DB-03, fixed).** The invite decides the student, the test and the institute. Every submitted question must be active, under an active dimension, of the invited test. The checks, the invite claim and the response insert run in one `prisma.$transaction`, so a refused submission writes no rows. Two more findings. First, refusals for a bad question, a duplicate, or an out-of-scale answer used to fall through to HTTP 500 in the controller. They now return 400. Second, two concurrent submissions for one invite: the loser waits on the invite row lock until the winner commits. That wait exceeded Prisma's default 2 s transaction start window, which surfaced as a 500 ("Unable to start a transaction in the given time"). The transaction now sets `maxWait: 5000` and `timeout: 10000`. With that window the test passes on every run, with exactly one saved response. Partial submission is still allowed, as before: not every active question has to be answered.
- **Institute deletion (DB-01, fixed).** The owning admin's delete used to return 500. The cause was the generic cascade helper, which looked children up through a field-name map with wrong entries: `psychometricTest` and `student` were matched by `testId` and `studentId` instead of `instituteId`, `testInvite` by `studentId` instead of `testId`, and `response` by `questionId` instead of `studentId`. The helper is removed. Each service now writes its cascade explicitly, inside `prisma.$transaction`, using real foreign keys.
- **Users are deactivated with their institute.** This keeps the previous cascade's behaviour. A deleted institute's users cannot use the app. Existing JWTs are not revoked, because JWT verification does not check the database.

### 8.3 Step 12: security logging and release gate

Security events are written by `src/utils/security-logger.ts` at warn level as `security_event`. Each entry has an allowlist of fields only: `event`, `timestamp`, `userId`, `instituteId`, `role`, `resourceType`, `resourceId`, `action` and `reason`. A value that looks like a JWT, or is longer than 128 characters, is dropped. The events are:

- `auth_failed`, with reason `missing`, `malformed`, `expired`, `invalid` or `no_authenticated_user`.
- `authorization_denied`, with reason `role_not_permitted` (403) or `not_found_in_scope` (404 on a sensitive action).
- `invite_validation_failed`, with the fixed refusal message as the reason (unknown, expired, used or foreign invite).
- `sensitive_admin_action`: `publish_test`, `delete_test`, `create_invites`, `revoke_invite`, `delete_institute`, `delete_student`.

Status codes and response bodies do not change. The release-gate checks, with the result at this commit:

1. **Protected routes.** Every write route requires `authenticateJWT` and `authorizeRoles('ADMIN')`. Public routes are login (rate limited), `POST /api/v1/auth/accept-invite` (token in the body, rate limited), and `POST /api/v1/auth/register`, which is always refused with 403 (DEC-02). Routes that need no account are `POST /api/v1/invites/assessment` and `POST /api/v1/responses/submit`, both bound to the invite token (DEC-03). Every other route requires a JWT with the ADMIN role, except `GET /health` and the login route. Fixed in this step: test create, publish and delete, and `GET /api/v1/auth/users`, now have a route-level ADMIN check. The service checks remain.
2. **Tenant identity.** No route trusts a tenant from the query string, the path or the body. The one exception is `POST /api/v1/tests`, whose body `instituteId` must equal the token's institute (403 otherwise). Fixed in this step: `GET /api/v1/tests` and `GET /api/v1/auth/users` returned other institutes' data, and the `getInstituteTests` controller read the tenant from the query. All three are now scoped to `req.user.instituteId` and fail closed.
3. **Tenant-owned lookups.** Every update and delete follows a tenant-scoped lookup. Lookups by id that remain are the login lookup by email (before authentication) and the requester's own institute. The unrouted `deleteUser` is now scoped. Known exception: the unrouted `getInstitutes` search is not scoped and must be removed or scoped before it is routed.
4. **Logs and errors.** No logger call writes a token, a password, an Authorization header or a request body. The error middleware logs the error name, message and status. It logs the stack only outside production. In production a 500 returns `Internal Server Error`. Known: `src/server.ts` logs the startup database error object. It runs before any request, and it was not changed in this step.

### 8.4 DEC-04: standardized /api/v1 routes

Every module router is mounted once, under `/api/v1`, in `src/app.ts`. The unversioned mount is removed, so `/api/...` returns 404. The duplicated segments are removed inside the routers: `/responses/responses/...`, `/reports/reports/...`, `/dimensions/dimensions/...` and `/questions/questions/...` are now `/responses/...`, `/reports/...`, `/dimensions/...` and `/questions/...`. The full old-to-new table is in the README (API Versioning). Health moved to `GET /health` at the root. The Swagger annotations show the real full paths. `POST /api/v1/students/AddStudent` keeps its name, because it is not a duplicate, and renaming it is a separate decision. The audit and gap-analysis documents in `docs/` still describe the pre-DEC-04 paths, because they record the state when they were written.

### 8.5 DEC-03: token-bound candidate access

A candidate has no account. The invite token is the only credential. `POST /api/v1/invites/assessment` takes the token in the body and returns the candidate's `studentId`, the test title and description, the active dimensions and the active questions. The token is in the body, not the URL, so it is not written to URL logs. The endpoint uses `findUsableInvite` (`src/modules/invites/invite-validation.ts`), the same function as submission, so the two cannot drift apart. Every refusal (unknown, revoked, expired, completed, or an inactive test, student or institute) returns one generic 404 and logs `invite_validation_failed` with the fixed reason, never the token.

`POST /api/v1/responses/submit` no longer requires a JWT. The body token and `studentId` are checked as before (DB-03, SEC-05). The integration tests cover the submission with no `Authorization` header.

The internal assessment reads are ADMIN-only, so a STUDENT token gets 403 on them. `GET /api/v1/tests/{id}` does not exist, so there is nothing to lock there.

Covered by `candidate-invite-flow.integration.spec.ts` and the unit tests for the invite service, the invite controller and the response service. The assessment payload is checked for inactive rows, other tenants and internal fields.

### 8.6 DEC-02: invitation-only onboarding

`POST /api/v1/auth/register` is closed. It returns 403 for every request, creates nothing, and logs `authorization_denied` without the body.

An ADMIN issues a user invite with `POST /api/v1/auth/invites`. The institute comes from the verified token, and an `instituteId` in the body is ignored. The token is 256 random bits. Only its SHA-256 hash is stored, in `UserInvite.tokenHash`, and the raw token is returned once, in the creation response. `GET /api/v1/auth/invites` lists the institute's invites without tokens or hashes. `DELETE /api/v1/auth/invites/{id}` revokes a pending invite, and a foreign invite returns 404.

`POST /api/v1/auth/accept-invite` is public and reads `token`, `name` and `password` from the body only. The invite is claimed with a conditional update, and the user is created in the same transaction. So an invite is single use, and a failed user write leaves the invite usable. Every unusable invite (unknown, expired, revoked, used, inactive institute, or an email that already has an account) returns the same 400 and logs `invite_validation_failed` without the token.

Covered by `onboarding-invite.integration.spec.ts` and the unit tests in `auth.service.spec.ts` and `auth.controller.spec.ts`. The migration `20261126120000_add_user_invites` is additive. It adds only the `UserInvite` table. Apply it to the test database with `npm run test:db:setup`, and to `psychometric_db` with `npx prisma migrate deploy`.

---

## 9. Known Limitations

- **Startup configuration (SEC-07) is tested outside the integration suite.** The integration harness always provides a valid `JWT_SECRET`, so startup refusal is covered by `src/config/env.process.spec.ts`, which runs in the unit suite and loads `env.ts` in a fresh Node process. Integration tests cover HTTP 401 for missing, malformed, expired, wrong-secret and tampered tokens (`guards.integration.spec.ts`).
- **No Redis in tests.** `server.ts` is not imported, so `connectRedis` never runs. Global and auth rate limiting, and the dimension cache, are no-ops. Rate-limit behaviour is not covered by integration tests.
- **Sequential only.** `--runInBand` is required. Parallel runs would share one database.
- **Single shared test database.** Suites are isolated by truncation, not by separate schemas.
- **Student identity is not modelled as an account.** `Student` has no link to `User`, and DEC-03 identifies a candidate by the invite token instead. A test for "a student reads their own data" needs a new decision that adds an account link.
- **No institute provisioning API.** Public registration is closed (DEC-02), so no endpoint creates an institute or its first ADMIN. Tests create them with Prisma in `harness.ts`. How production gets its first institute is an open decision.
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
