# Implementation Audit: Psychometric Platform Backend

**Audit date:** 2026-11-24
**Branch / HEAD:** `chore/untrack-env-add-env-template` / `1b0430d`
**Written for:** the backend team and tech lead.

---

## 1. Executive Summary

- **All nine planned modules exist in code** (Auth, Institutes, Tests, Dimensions, Questions, Students, Invites, Responses, Reports). Each follows routes → controller → service → Prisma. There are 38 HTTP endpoints, 8 Prisma models, 3 migrations and 13 unit-test suites.
- **The backend is not safe to expose.** The dominant problem is authorization, not missing features. Several endpoints let an authenticated user read or change another institute's data, and some let a `STUDENT` do admin actions. Section 8 lists the findings.
- **The core workflow exists in code** (admin creates test → dimensions → questions → students → invite → student submits → report). It has not been exercised end-to-end, because no database was reachable during this audit. The report logic and the soft-delete cascades contain defects.
- **Status:** 0 of 9 modules fully implemented, 9 partially implemented, 0 missing. Estimated functional completeness is about **49%** of the counted scope (range 44% to 54%; method in section 13 of `IMPLEMENTATION_GAP_ANALYSIS.md`). The prior audit in `_bmad-output/backend-audit-report.md` estimated 65% and says "no test coverage" and "no Redis or rate limiting". Both claims are now out of date.
- **Scope conflict:** the PRD and epics describe a multi-tenant recruiting SaaS (7 RBAC roles, ATS/HRMS integrations, AI). The code, README and this audit's brief describe an institute/student psychometric platform with 2 roles. This needs a business decision before roadmap work is committed (see `IMPLEMENTATION_GAP_ANALYSIS.md`, section 10).
- **Recommendation:** freeze new features. Fix tenant isolation and role enforcement first (P0), then the data-integrity defects, then add an integration test harness that proves tenant isolation.

---

## 2. Method and Verified Commands

**Evidence rules used:** source code is primary evidence. Documentation is treated as intent only. Findings are labelled as one of:
- **Verified (executed):** run in this audit.
- **Verified (code reading):** confirmed by reading the cited lines. Not run, because no database was available.
- **Assumption:** inferred, needs confirmation.

| Command | Result |
|---|---|
| `npm run build` (`tsc`) | Passed, exit 0 |
| `npx jest` | 13 suites, 106 tests, all passed |
| `npx prisma validate` | Schema valid |
| `npx prisma migrate status` | **Blocked:** `P1001 Can't reach database server at localhost:5433`. Docker Desktop is not running. |
| In-process JWT check (compiled `dist/` modules, no DB, no server) | **Verified (executed):** a token signed by `utils/jwt.ts` is rejected by `middleware/auth.middleware.ts` when `JWT_SECRET` is not in the process environment. Accepted when it is. Secrets were not printed. |

Not run: `npm install` (not required, dependencies present), `npm run test:coverage` (would write `coverage/`), any database command, any server start. No application code, Prisma schema, migrations, `package.json` or Docker configuration was modified. `npm run build` rewrote `dist/`, which is git-ignored.

---

## 3. Existing Architecture (as implemented)

**Stack:** Node 22 (local), Express 4, TypeScript 5 (strict), Prisma 6 on PostgreSQL 16, Redis 7 (`redis` v5), `jsonwebtoken`, `bcryptjs` (and also `bcrypt`, see section 11), `express-validator` (used once), `swagger-jsdoc` / `swagger-ui-express`, Jest 30 + ts-jest, supertest (installed, unused).

**Request pipeline** (`src/app.ts`):

1. CORS (`app.ts:17-38`). Defaults to reflecting any origin with credentials when `CORS_ORIGINS` is unset.
2. `express.json()`.
3. Swagger UI at `/api-docs` (`app.ts:43`), publicly reachable.
4. Global rate limiter on `/api`, 100 requests per minute per IP (`app.ts:46`, `rateLimit.middleware.ts:118-122`).
5. Routes mounted at `/api/*` (`src/routes/index.ts:231-239`). **Not** `/api/v1/*`, which the README and Swagger describe.
6. Error middleware (`error.middleware.ts`).

**Layering:** the folder structure is consistent. Controllers still hold business rules (role and institute checks, status-code mapping by string comparison). Services mostly throw plain `Error`s whose messages the controllers match on. Prisma is called directly from services and, in several places, from controllers.

**Auth model:** a JWT carries `{ userId, role, instituteId }`. `authenticateJWT` verifies it and sets `req.user`. Role checks use `authorizeRoles('ADMIN')` on some routes. Institute scoping relies on `req.user.instituteId`, but only some services apply it.

---

## 4. Codebase Overview

| Item | Count / state |
|---|---|
| Modules under `src/modules/` | 9 (+ `auth`) |
| HTTP endpoints registered | 38 (see `API_IMPLEMENTATION_MATRIX.md`) |
| Prisma models | 8: Institute, User, PsychometricTest, Dimension, Question, Student, TestInvite, Response |
| Prisma enums | 3: Role (ADMIN, STUDENT), TestStatus (DRAFT, PUBLISHED), InviteStatus (PENDING, COMPLETED) |
| Migrations | 3 (`prisma/migrations/`) |
| Unit test suites / tests | 13 / 106 (all pass) |
| Integration (supertest) test files | 0 |
| Non-spec `any` occurrences in `src/` | 73 |
| Source lines, `src/` + `prisma/` | about 8,300 including specs |

---

## 5. Module-by-Module Status

Status key: IMPLEMENTED / PARTIALLY IMPLEMENTED / NOT IMPLEMENTED / NEEDS VALIDATION / BLOCKED (as defined in the brief).

| Module | Status | What works (code evidence) | What is missing or defective |
|---|---|---|---|
| **Auth** | PARTIALLY IMPLEMENTED | Register creates institute and ADMIN in one transaction, bcrypt hashing (`auth.service.ts:31-57`). Login verifies bcrypt and issues JWT (`auth.service.ts:79-119`). Login and register are rate limited (`auth.routes.ts:119, 221`). | JWT secret is not loaded at runtime, so tokens fail verification unless the variable is exported (verified). Deactivated users and inactive institutes can still log in (`auth.service.ts:82-94`). No refresh, logout, password reset, MFA, lockout or password policy. `GET /users` lists users across all institutes (`auth.service.ts:121-143`). |
| **Institutes** | PARTIALLY IMPLEMENTED | Create, paginated list with search, get by id, update name, soft delete (`institute.service.ts`). | Every endpoint is open to any authenticated user, including `STUDENT` (`institute.routes.ts:49-230`). Soft-delete cascade uses wrong lookup fields and leaves students and tests active (`softDelete.ts:29-37`, `institute.service.ts:189`). No activation toggle. The duplicate-email branch (`institute.service.ts:40-46`) can never trigger because `Institute.email` is not unique. |
| **Tests / Assessments** | PARTIALLY IMPLEMENTED | Create as DRAFT with ADMIN and tenant checks in the service (`test.service.ts:53-103`). Publish once, DRAFT to PUBLISHED (`test.service.ts:183-235`). Soft delete (`test.service.ts:239-271`). | Publish and delete take `instituteId` from the request body and compare against it, so one institute can publish or delete another's test (verified by code reading, critical). Invite cascade on delete uses the wrong lookup field (`test.service.ts:264`). No edit, schedule, duration, availability, versioning or archive. |
| **Dimensions** | PARTIALLY IMPLEMENTED | Create, list per test (Redis-cached, 5 min), soft delete with question cascade (`dimension.service.ts`). | `description` is accepted and dropped (`dimension.service.ts:21`, no column in schema). No tenant check on create or delete, so an admin can change another institute's test (`dimension.service.ts:19-49, 93-116`). Test list is readable by any user (`dimension.routes.ts:168`). No update, weights, order or scoring config. |
| **Questions** | PARTIALLY IMPLEMENTED | Create with scale validation (`question.service.ts:132-165`), list per dimension, soft delete with response cascade. | No tenant check on create or delete (`question.service.ts:132-227`). Question bank is only reachable through a dimension. No update, question types, difficulty, ordering, reuse or versioning. |
| **Students** | PARTIALLY IMPLEMENTED | Paginated, tenant-scoped list with search (`student.service.ts:253-310`). Single create with express-validator (`student.routes.ts:143-147`). Duplicate check per institute in code. Tenant taken from the token. | No DB unique constraint on `(instituteId, email)` (`schema.prisma:104-122`), so duplicates can occur under concurrency. Bulk upload has no size limit and `skipDuplicates` does nothing without a unique index (`student.service.ts:396-405`). Delete cascade skips responses (`student.service.ts:449` → `softDelete.ts:35`). No update, activation, or profile management. |
| **Invitations** | PARTIALLY IMPLEMENTED | Creates invites with `randomUUID()` tokens inside a transaction, tenant-scoped test and student checks (`invite.service.ts:26-137`). Lists per test and per student. Soft delete, blocked for COMPLETED. | Re-inviting a student after their invite was soft deleted fails on the unique `(testId, studentId)` index (`schema.prisma:143`, `invite.service.ts:91-105`). `expiresAt` exists but is never set or checked. No email delivery, resend, or "start" step. Invites can be created for DRAFT tests. `GET /api/invites` returns every tenant's invite tokens (`invite.service.ts:235-249`). `GET /api/invites/students/:studentId/invites` lets any user read the tokens of students in the same institute (`invite.routes.ts:203`). |
| **Responses** | PARTIALLY IMPLEMENTED | Transactional submit: checks invite, status, student match, question validity, answer range, saves responses, marks invite COMPLETED (`response.service.ts:321-422`). Completed invites cannot be resubmitted. | Read and delete endpoints have no role or ownership check, so any user can read or delete any student's or test's responses (`response.routes.ts:36, 121, 162, 191`). Submit is not bound to the caller's identity, so any authenticated user with a token can submit for that student (`response.routes.ts:80`). Questions are not checked to belong to the invite's test (`response.service.ts:353-370`). No unique `(studentId, questionId)`, so duplicate entries in one request are saved (`response.service.ts:387-396`). Answers are not checked to be integers. Race between two submits (`response.service.ts:344`, no row lock). No save, resume, autosave or timer. |
| **Reports** | PARTIALLY IMPLEMENTED | Per-student, per-dimension mean score (`report.service.ts:29-99`). Per-test aggregate across invited students (`report.service.ts:101-140`). ADMIN-only routes. | The "student report" route is wired to the test-report handler (`report.routes.ts:92-95`). The test report has no tenant check (`report.service.ts:101-140`, `report.controller.ts:37-53`), so an admin can read another institute's scores. Soft-deleted dimensions and questions are included (`report.service.ts:35-44`). Score is an unweighted mean. No interpretation, no institute-level report, no history, no PDF or Excel, and N+1 queries per student. `GET /api/reports` lists tests, not reports. |

**Module totals:** 0 IMPLEMENTED, 9 PARTIALLY IMPLEMENTED, 0 NOT IMPLEMENTED, 0 BLOCKED. Every module also needs runtime validation, because no integration test or database run exists (NEEDS VALIDATION for end-to-end behaviour).

---

## 6. API Audit (summary)

Full inventory with auth, status and evidence is in `API_IMPLEMENTATION_MATRIX.md`.

- **38 endpoints** are mounted. The test-report handler is wired to two routes: `/api/reports/reports/test/:testId` (`report.routes.ts:139`) and, by mistake, `/api/reports/reports/student/:studentId/test/:testId` (`report.routes.ts:92`).
- **Auth enforcement:** of 38 endpoints, 35 require a JWT. Three are public: `register`, `login` and `health`. Role checks (`authorizeRoles('ADMIN')`) appear on 15 routes. Institute, test, response, and most read endpoints have no role check. Swagger UI is also public, outside the 38.
- **Paths:** the mounted paths include doubled segments, for example `/api/responses/responses/submit`, `/api/reports/reports/test/:testId`, `/api/dimensions/dimensions/:id`. Mounts and route prefixes repeat each other. The README promises `/api/v1/*`.
- **Swagger drift:** Auth's Swagger is accurate. Institutes use a generic template (`/api/v1/`, "Create resource (/)"). Most other modules document `/api/v1/...` paths that do not exist, and some are duplicated (for example `dimension.routes.ts` documents both `/api/dimensions/...` and `/api/v1/...`). Swagger does not prove an endpoint works.
- **Response envelope:** three shapes are in use: `{ success, message, data, meta }` from `response-helpers.ts`, `{ success: false, message }` from `error.middleware.ts`, and `{ message }` or `{ message, errors }` from the auth, role and validation middleware.
- **Pagination:** page and limit are validated in controllers (`validatePagination`), but the `getAll*` service functions use the requested limit without a cap. Only `getInstitutes` and the student list cap at 100.
- **Error messages:** `serverErrorResponse` returns `error.message` to the client (for example `auth.controller.ts:224, 245`), and `error.middleware.ts:40-43` returns `err.message` for every error. Internal and Prisma messages can leak.

---

## 7. Database Audit

**Entities:** 8 models, all with `createdBy`, `createdAt`, `updatedBy`, `updatedAt`, `isActive` (added by migration `20260314095101_add_audit_fields`). Naming is camelCase with `Id` suffixes, and the audit fields are plain strings with **no foreign key** to `User`, so their values are not referentially checked.

**Relationships and constraints (verified in `schema.prisma` and migrations):**

| Area | Finding | Severity |
|---|---|---|
| Soft-delete cascade | `modelFieldMap` in `softDelete.ts:29-37` is keyed only by the child model, so the same child needs a different lookup depending on the parent. `student → studentId` and `testInvite → studentId` are wrong when the parent is an institute or a test. Result: institute delete leaves students and tests active, test delete leaves invites active, student delete leaves responses active. | HIGH |
| Re-invite after soft delete | `@@unique([testId, studentId])` (`schema.prisma:143`) includes inactive rows. A student whose invite was soft-deleted cannot be re-invited. | HIGH |
| Response integrity | No unique `(studentId, questionId)`. No check that a question belongs to the invite's test. Duplicate entries in one request are saved. | HIGH |
| Published-test edits | Dimensions and questions can be added or deleted after a test is PUBLISHED (no status check in `dimension.service.ts:19-49`, `question.service.ts:132-165`). Business rule needed. | MEDIUM |
| Student uniqueness | No unique `(instituteId, email)`. Duplicate protection is application-only. | MEDIUM |
| Institute email | Not unique (`schema.prisma:13`). The `P2002` branch in `institute.service.ts:40-46` is unreachable. | LOW |
| Global user email | `User.email` is globally unique, including inactive users. A deactivated user's email can never be reused. Business question. | LOW |
| Invite expiry | `TestInvite.expiresAt` (added in `20260316063002_improve_relations`) is never set or read. | MEDIUM |
| Dimension description | Accepted by the API, no column (`schema.prisma:65-81`). | LOW |
| Soft-delete reads | `getStudentReport` reads dimensions and questions without `isActive` (`report.service.ts:35-44`). Deleted content still scores. | MEDIUM |
| Migration `20260314095101` | Adds `updatedAt` as `NOT NULL` without a default to 8 tables. The migration's own warnings say it fails on non-empty tables. Safe only on empty databases. Whether any non-empty database exists is unknown (assumption). | MEDIUM |
| Migration `20260316063002` | Adds `Response.studentId` foreign key, which the init migration lacked. Adds indexes and the invite unique constraint. Fixing the constraint requires a new migration. | Info |
| Migration status | **BLOCKED.** `prisma migrate status` could not reach the database, so the migrations vs. schema match is NEEDS VALIDATION. | BLOCKED |

**Transactions:** `submitResponses` and `cascadeSoftDelete` are transactional. `inviteStudents` uses a transaction. Bulk student insert, `deleteInvite` and most single writes are not. No row locking exists on invite status.

**Indexes:** present on the `instituteId`, `testId`, `dimensionId`, `studentId`, `questionId` foreign keys and on `TestInvite.token` (unique). Missing: unique `(instituteId, email)` on Student, unique `(studentId, questionId)` on Response, and `isActive` indexes for the frequent filters (low priority).

**Missing entities for the planned scope (not in schema):** audit log, refresh-token or session store, assessment session or attempt, scoring configuration, report snapshot, institute settings, question bank (questions are only reachable through a dimension), email or notification log, role-permission model, subscription or license.

---

## 8. Security Audit

Classification: CRITICAL / HIGH / MEDIUM / LOW. "Verified" means code reading or an executed check, as stated. No secret values are reproduced in this document.

### 8.1 Critical findings

| ID | Finding | Evidence | Basis |
|---|---|---|---|
| SEC-C1 | **Cross-tenant publish and delete of tests.** `instituteId` comes from `req.body`, not the token. The service only checks the role, then compares the test's institute with the body value. Any ADMIN can publish or delete any institute's test by sending that institute's id. | `test.controller.ts:137-212` (body at 140-142, 180-182), `test.service.ts:183-271` (role checked at 190-192 and 246-248, instituteId compared at 208 and 251-257). | Verified (code reading) |
| SEC-C2 | **Institute endpoints open to any authenticated user,** including `STUDENT`. Anyone with a token can list all institutes, read any institute, update it, or soft delete it, and the delete cascades to users. | `institute.routes.ts:49, 99, 138, 189, 230`. | Verified (code reading) |
| SEC-C3 | **Response read and delete without authorization.** Any authenticated user can list all responses, read any student's or any test's responses, and delete any response. | `response.routes.ts:36, 121, 162, 191`, `response.service.ts:424-541`. | Verified (code reading) |
| SEC-C4 | **Invite tokens exposed across tenants and usable to submit for another student.** `GET /api/invites` returns every tenant's invites, including tokens. Any user can read tokens for students in their institute. Submit is not bound to the caller, so a token plus a student id is enough to submit answers for that student. | `invite.service.ts:235-249` (no tenant filter, token returned), `invite.routes.ts:203` (no role check), `response.service.ts:321-349` (no caller check). | Verified (code reading) |
| SEC-C5 | **Cross-tenant writes to dimensions and questions.** Create and delete take the test or dimension id from the URL and never check the caller's institute. An ADMIN of one institute can add or delete dimensions and questions of another's tests. | `dimension.service.ts:19-49, 93-116`, `question.service.ts:132-165, 207-227`, routes `dimension.routes.ts:326, 450`, `question.routes.ts:141, 188`. | Verified (code reading) |
| SEC-C6 | **JWT secret falls back to a known value, and the configured value is not loaded at runtime.** Signing uses `dev-secret` (`utils/jwt.ts:9`), verification uses `your_jwt_secret` (`auth.middleware.ts:4`), and `config/index.ts` (the only `dotenv.config()` call) is not imported anywhere. If `JWT_SECRET` is not exported, a token signed with the published fallback string is accepted as any role and any institute. Verified in-process: a token from `generateToken` is rejected unless `JWT_SECRET` is in the environment. | `utils/jwt.ts:9`, `auth.middleware.ts:4`, `config/index.ts:10`. | Verified (executed) for the mismatch. Forgery follows from the known fallback string (code reading). |

### 8.2 High findings

| ID | Finding | Evidence |
|---|---|---|
| SEC-H1 | Test report reads any institute's test and student scores (ADMIN role only, no tenant check). | `report.routes.ts:139`, `report.service.ts:101-140`, `report.controller.ts:37-53` |
| SEC-H2 | `GET /api/auth/users` lists every user's email and role across institutes. | `auth.service.ts:121-143`, `auth.controller.ts:86-115`, `auth.routes.ts:351` |
| SEC-H3 | `GET /api/tests` lists every institute's tests (titles and descriptions), for any authenticated user. | `test.service.ts:165-179`, `test.routes.ts:105` |
| SEC-H4 | Dimensions and questions of any test are readable by any authenticated user, including students who are about to take the test. Breaks test integrity. | `dimension.routes.ts:168`, `question.routes.ts:84`, `dimension.service.ts:51-75`, `question.service.ts:167-189` |
| SEC-H5 | Deactivated users and inactive institutes can log in, and an already-issued token keeps working until expiry. No user or institute status check at login or in `authenticateJWT`. | `auth.service.ts:79-94`, `auth.middleware.ts:10-27` |
| SEC-H6 | Response data integrity: submit accepts questions from other tests, duplicate question entries, and non-integer answers. Affects report correctness. | `response.service.ts:353-396`, `response.service.ts:379` |
| SEC-H7 | Institute list and get endpoints are readable by `STUDENT` users. Covered by SEC-C2; listed here for the data-exposure angle: institute names and emails. | `institute.routes.ts:99, 138` |

### 8.3 Medium findings

| ID | Finding | Evidence |
|---|---|---|
| SEC-M1 | Stale tokens: JWT default lifetime is 1 day (`utils/jwt.ts:11-12`) and there is no revocation. Config default is 1 hour, which conflicts. | `utils/jwt.ts:11-12`, `config/index.ts:9` |
| SEC-M2 | Error detail leakage: `error.middleware.ts` returns `err.message` for all errors. Controllers pass service and Prisma messages to 500 responses. | `error.middleware.ts:36-43`, `auth.controller.ts:224, 245` |
| SEC-M3 | Rate limiting is fail-open when Redis is down (`rateLimit.middleware.ts:78-81`). Brute-force protection on login disappears when Redis is down. | `rateLimit.middleware.ts:78-81`, `auth.routes.ts:221` |
| SEC-M4 | The global rate limiter runs before `authenticateJWT`, so `req.user` is never set and the "per user" key is always the IP. | `app.ts:46`, `rateLimit.middleware.ts:69-72` |
| SEC-M5 | CORS reflects any origin with credentials when `CORS_ORIGINS` is unset. Safe only for local development. | `app.ts:17-36` |
| SEC-M6 | No password policy. Only non-empty is checked. Email format is not checked on register. | `auth.controller.ts:189-196` |
| SEC-M7 | Public self-service registration creates an institute and an ADMIN, with no email verification. Whether this is intended is NEEDS BUSINESS CONFIRMATION. | `auth.routes.ts:119`, `auth.service.ts:24-77` |
| SEC-M8 | The seed script creates a default admin account with a hard-coded password. Dangerous if seeded outside local development. | `prisma/seed.ts` (credential value not reproduced) |
| SEC-M9 | Input validation is mostly absent. Only student create uses express-validator. Bulk upload has no size limit (DoS). Answers are not type-checked. | `student.routes.ts:198-202`, `student.controller.ts:99-107` |
| SEC-M10 | The local `.env` JWT secret is 14 characters, far below a sensible minimum for HS256. Value not reproduced. | local `.env` (checked for length only) |

### 8.4 Low findings

| ID | Finding | Evidence |
|---|---|---|
| SEC-L1 | Student emails are logged at info level (PII). | `student.service.ts:319, 330-332` |
| SEC-L2 | Swagger UI is public at `/api-docs`. Acceptable in dev; NEEDS BUSINESS CONFIRMATION for production. | `app.ts:43` |
| SEC-L3 | No security headers middleware (for example helmet). | `app.ts` (not present) |
| SEC-L4 | Health endpoint reports `ok` without checking the database or Redis. | `routes/index.ts:242` |

### 8.5 Injection, XSS and other checks

- **SQL injection:** Prisma parameterizes queries. The only raw SQL is in migrations. No `$queryRaw` usage found. Low risk.
- **XSS:** the API returns JSON only. Risk depends on the front end, not in scope here.
- **Brute force:** login and register are limited to 10 per minute per IP (`rateLimit.middleware.ts:125-129`), but this is fail-open and keyed by IP only.
- **Secrets in code:** the JWT fallback strings (SEC-C6) and the seed password (SEC-M8) are hard-coded. `compose.yaml` contains a local-only Postgres password. Local dev only, but document it.
- **File upload:** none implemented. Not applicable yet.

### 8.6 IDOR summary

Confirmed insecure direct object references (object id from request, no ownership or tenant check): tests publish and delete (SEC-C1), dimensions create and delete (SEC-C5), questions create and delete (SEC-C5), dimension and question reads by id (SEC-H4), test report (SEC-H1), student responses by `studentId` (SEC-C3), test responses by `testId` (SEC-C3), response delete (SEC-C3), institute get, update and delete (SEC-C2), student invites by `studentId` (same institute only, SEC-C4), submit with a supplied `studentId` (SEC-C4).

Correctly tenant-scoped: student list, student delete (`student.service.ts:436-441`), invite by test (`invite.service.ts:36-39`), invite delete (`invite.service.ts:261-266`), test create (`test.service.ts:61-68`).

---

## 9. Infrastructure Audit

**Docker (`compose.yaml`):**
- PostgreSQL `postgres:16-alpine` on `127.0.0.1:5433`, named volume, `pg_isready` healthcheck, `restart: unless-stopped`.
- Redis `redis:7-alpine` on `127.0.0.1:6379`, AOF on, `redis-cli ping` healthcheck, named volume, no password.
- The Postgres password is a hard-coded local development value. Acceptable for local use, must not be reused elsewhere.
- No application container, no Dockerfile, no production compose, no `.dockerignore`.
- Docker Desktop was **not running** during this audit, so container health, volumes and connectivity are **BLOCKED** (not verified).

**PostgreSQL:** the `.env.example` template and the fallback template in `scripts/ensure-env.js:14` both target the compose port 5433. Connection pooling is not configured (FR21 not implemented). Migration status is BLOCKED (see section 7).

**Redis:** actual uses in code:
- Dimension list cache, read-through with 5-minute TTL, invalidated on create and delete (`dimension.service.ts:42, 65, 109`, `cache.ts:240-251`).
- Global rate limiter and auth rate limiter (`rateLimit.middleware.ts`).

Connection handling: `connectRedis` is non-fatal, retries up to 5 times with backoff, and clears the ready flag on error or end (`config/redis.ts:134-168`). Shutdown is graceful for SIGTERM and SIGINT (`server.ts:74-83`).

Not implemented, despite the README listing them: OTP, password-reset tokens, session state, assessment session state, distributed locks, background job coordination. `cacheDeleteByPattern` uses `KEYS` and is unused (`cache.ts:222-233`).

**Development workflow (`package.json`):**
- `postinstall` runs `ensure-env.js` and `prisma generate`. `predev` and `prestart` run `ensure-env.js`. `ensure-env.js` creates `.env` from `.env.example` if missing and warns about `CHANGE_ME` values. It does not fail on them.
- `dev` runs `ts-node-dev --transpile-only`. `build` runs `tsc`. `start` runs `dist/server.js`. `test`, `test:watch`, `test:coverage`, `swagger:generate` exist.
- Missing: migration scripts (the README uses the Prisma CLI directly), `lint`, `format`, `typecheck` (build is the only check), a CI workflow (`.github/` has only skills), a Dockerfile.
- Environment is not validated at startup (no schema for env vars). `config/index.ts` is dead code.
- Logging is `console` plus a small `logger` used only in services. No request logging, no structured logs, no error tracking.

---

## 10. Testing Audit

**What exists:** 13 Jest suites and 106 tests, all passing. Test files are colocated with source. ts-jest preset, node environment.

| Test type | Present? | Evidence |
|---|---|---|
| Controller unit tests | Yes, 9 specs | `*.controller.spec.ts` (service layer mocked; 11 spec files use `jest.mock`) |
| Utility unit tests | Yes | `cache.spec.ts`, `jwt.spec.ts`, `response-helpers.spec.ts` |
| Middleware unit tests | Partial | `rateLimit.middleware.spec.ts` only. No auth or role middleware tests. |
| Service unit tests | **No** | No `*.service.spec.ts` files |
| API integration tests (supertest) | **No** | supertest is a dev dependency and no spec imports it |
| Database integration tests | **No** | No test database, no fixtures, no migration-based setup |
| Authorization tests | Minimal | 3 specs mention 403 |
| Tenant-isolation tests | **No** | No spec tests cross-institute access. None would have caught SEC-C1 to SEC-C5. |
| Validation tests | Partial | Student create and bulk upload controller specs |
| Error-handling tests | Partial | Several specs assert 400, 404, 409 mappings |
| Test data and fixtures | **No** | Mocks inline |

**Coverage:** not measured in this audit (`test:coverage` would write `coverage/`). NEEDS VALIDATION.

**Minimum recommended for a production release (recommendation, not a requirement):**
1. An integration harness that runs the real app against a disposable Postgres (and Redis), with migrations applied and fixtures for two institutes, one ADMIN and one STUDENT in each.
2. A role-by-tenant authorization matrix test for every one of the 38 endpoints. Each cell asserts allow or deny. Starts with the endpoints in section 8.
3. Service-level tests for the invite, submit and report workflows, including duplicate, expired and cross-test cases.
4. Tests for the soft-delete cascade that assert the child rows change.
5. Unit coverage target for `src/modules/*/*.service.ts` and `src/middleware/` of at least 80% lines, measured in CI.

---

## 11. Code Quality and Architecture Findings

**Architecture (consistent with plan, with gaps):**
- Module boundaries are clear. No circular imports were observed on the paths reviewed (assumption: not verified with a dependency-graph tool, which was not installed).
- Controllers are not thin. Role and institute checks and error-to-HTTP mapping live in controllers (`test.controller.ts:25-45, 152-166`).
- Services signal errors by message string, and controllers compare strings (`institute.controller.ts:317-355`). Fragile. No typed error classes.
- Route files are large because Swagger blocks dominate (`dimension.routes.ts` is 456 lines).
- Config is not centralized. JWT secret is read in two modules; CORS and port are read in several places. `config/index.ts` is unused.
- Environment variables are not validated at startup.

**Duplication and dead code:**
- Pagination logic repeated in about nine `getAll*` services and their controllers.
- `getUserId` helper duplicated (`institute.controller.ts:133-135`, `response.controller.ts:17-19`), with different fallbacks (`'system'`).
- `scoring.ts` (`calculateDimensionScores`) is unused. The report service recomputes its own averages.
- `performSoftDelete` (`softDelete.ts:39-75`) and `auth.service.deleteUser` (`auth.service.ts:146-163`) are unused. `deleteUser` has no route.
- `getInstituteTests` (`test.controller.ts:57-110`) is unrouted.
- `cacheDeleteByPattern` is unused and uses `KEYS`.
- `uuid` and `pg` are listed in `dependencies` but not imported. `bcrypt` (native) is used only by the seed, while the app uses `bcryptjs`.

**Type safety:** `tsconfig.json` enables `strict`. The codebase has 73 `any` uses in non-test source, mostly `(req as any).user` (`institute.controller.ts:324-327`, `test.controller.ts:23`, several others). `AuthRequest` exists in `auth.middleware.ts` but is not used consistently. Each controller re-types the user payload.

**Async and errors:** controllers wrap handlers in try/catch, so unhandled rejections are unlikely in the routes reviewed. `server.ts` catches startup failures. No memory leak pattern found.

**Naming:** route segments mix styles (`/AddStudent` versus `/bulk-upload`). File names mix camelCase (`rateLimit.middleware.ts`, `softDelete.ts`) with kebab-case (`response-helpers.ts`). Swagger tag names differ from route names.

**Mis-declared dependency:** `package.json` declares `"prisma"` config as the seed command. The Prisma CLI warns it is deprecated for Prisma 7 (seen during `prisma validate`).

---

## 12. Critical Findings (summary)

1. Cross-tenant publish and delete of tests (SEC-C1).
2. Institute endpoints available to all authenticated users (SEC-C2).
3. Unrestricted response reads and deletes (SEC-C3).
4. Invite tokens exposed across tenants; submit not bound to caller (SEC-C4).
5. Cross-tenant writes to dimensions and questions (SEC-C5).
6. JWT secret fallback and missing runtime env load; currently breaks protected routes and, if the fallback is used, allows token forgery (SEC-C6).
7. Soft-delete cascade is broken for institute, test and student parents (DB, HIGH).
8. Invites cannot be re-issued after deletion because of the unique constraint (DB, HIGH).
9. Response integrity: no test binding, no uniqueness, no integer check (DB and SEC-H6).

Full list with IDs is in section 8. Ordered task list is in `FUTURE_IMPLEMENTATION_CHECKLIST.md`.

---

## 13. Documentation Consistency (summary)

Detailed conflicts are in `IMPLEMENTATION_GAP_ANALYSIS.md`, section 10. Most important:
- README and Swagger describe `/api/v1`; the code mounts `/api`.
- PRD and epics describe a recruiting SaaS with 7 RBAC roles; the code has 2 roles.
- `_bmad-output/backend-audit-report.md` says there is no test coverage, no Redis integration, and no rate limiting. All three are now present in part.
- `epics.md` claims "All 31 stories created" but contains six story headings (1.1 to 1.6).
- `docs/context/project-context.md` is an empty file.

---

## 14. Known Blockers and Assumptions

**Blockers:**
- Docker Desktop not running. Blocks: migration status, schema-to-database comparison, any end-to-end API run, Redis behaviour checks, container checks.
- No integration harness. Blocks: verifying the tenant and role findings by request instead of by reading code.

**Assumptions (to confirm):**
- `dotenv` is not loaded by Prisma or Node at runtime. Based on code reading. If the developer exports `JWT_SECRET` in their shell, SEC-C6's functional break does not occur, but the fallback risk still applies when the variable is missing.
- The intended product is the institute/student platform described by the README and this brief. The PRD's recruiting scope is treated as aspirational until confirmed.
- Public self-service registration is intended (SEC-M7).
- No non-empty production database exists yet (migration `20260314095101`).

**Not assessed:** front-end integration, performance under load, Swagger rendering, Redis failover in practice.
