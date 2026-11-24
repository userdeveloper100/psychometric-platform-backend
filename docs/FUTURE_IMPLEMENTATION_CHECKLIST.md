# Future Implementation Checklist

**Audit date:** 2026-11-24
**Written for:** the backend team, to pick up tasks in order.
**Priority:** P0 = security, data integrity or a core workflow that is broken. P1 = needed for the MVP. P2 = after MVP. P3 = optional or future.
**Items marked BLOCKED** need a decision in `IMPLEMENTATION_GAP_ANALYSIS.md` section 12 (the question number is given) before work starts.

**Ground rules for every task:**
- Every fix that changes authorization must come with an integration test that fails before the fix and passes after it (see `SEC-11`).
- Schema changes go in a **new** migration. Existing migrations are not edited.
- No task removes a route without a decision recorded in `API_IMPLEMENTATION_MATRIX.md`.

---

## Traceability to Audit Findings

| Checklist task | Resolves audit finding(s) in `IMPLEMENTATION_AUDIT.md` |
|---|---|
| SEC-01 | SEC-C1 (cross-tenant publish and delete) |
| SEC-02 | SEC-C2 (institute endpoints open to all roles), SEC-H7 |
| SEC-03 | SEC-C3 (response read and delete) |
| SEC-04 | SEC-C4 (submit not bound to caller), SEC-H6 (submission integrity) |
| SEC-05 | SEC-C4 (invite tokens exposed) |
| SEC-06 | SEC-C5 (cross-tenant dimension and question writes), SEC-H4 |
| SEC-07 | SEC-C6 (JWT secret fallback), SEC-M1 (config default conflict) |
| SEC-08 | SEC-H5 (deactivated users can log in) |
| SEC-09 | SEC-H2 (users list), SEC-H3 (tests list), SEC-H4 (reads) |
| SEC-10 | SEC-H1 (test report cross-tenant) |
| SEC-11, SEC-12 | Proof for every CRITICAL and HIGH finding |
| DB-01 | Soft-delete cascade defect (`IMPLEMENTATION_AUDIT.md` section 7) |
| DB-02 | Invite unique constraint blocks re-invite (section 7) |
| DB-03 | Response integrity (SEC-H6; section 7) |
| AUTH-02 | SEC-M6 (password policy, email format) |
| AUTH-03 | SEC-M4 (global limiter never per user) |
| AUTH-04 | SEC-M3 (fail-open rate limit) |
| INF-08 | SEC-M5 (CORS default), SEC-L2 (public Swagger), SEC-L3 (no security headers) |
| INF-09 | SEC-M2 (error detail leakage) |
| INF-13 | SEC-M8 (default seed admin) |
| INF-03 | SEC-M10 (short JWT secret), section 9 (no env validation) |
| STU-03, STU-04 | SEC-M9 (validation, bulk size) |
| STU-07 | SEC-L1 (PII in logs) |
| ARC-03 | Section 6 (uncapped `getAll*` limits) |

Findings not yet mapped to a task: SEC-M7 (public signup; decision DEC-02), SEC-L4 (health without dependencies; INF-02 covers it).

## Suggested Order

1. **Test harness first:** `SEC-11`, `INF-01`. Nothing else can be proven without it.
2. **Stop the bleeding (P0 security):** `SEC-07`, `SEC-01`, `SEC-02`, `SEC-03`, `SEC-05`, `SEC-06`, `SEC-09`, `SEC-10`, `SEC-08`.
3. **P0 data integrity:** `DB-01`, `DB-02`, `DB-03`.
4. **Decisions** (ask the product owner): `DEC-01` to `DEC-04`.
5. **MVP core workflow:** invitations, sessions, submission, reports (P1 items).
6. **Hardening and platform:** P1 infrastructure and documentation.
7. **P2 and P3** after the MVP is accepted.

---

## Decisions Required First

- [ ] **DEC-01 · P0 · BLOCKED on Q1 and Q2.** Confirm product scope and the role model (2 roles or 7). *Why first:* the role check in `SEC-02`, `SEC-03` and `AUTH-07` depends on it.
  - Acceptance: a written decision in `IMPLEMENTATION_GAP_ANALYSIS.md` section 12, with the chosen roles listed.
- [ ] **DEC-02 · P0 · Q3 and Q5.** Confirm whether public signup is intended, and the invite expiry rule.
  - Acceptance: decision recorded; `INV-01` and `AUTH-08` unblocked.
- [ ] **DEC-03 · P0 · Architecture decision.** How does a student authenticate to submit answers? Today a `Student` has **no link to a `User`** (`schema.prisma:104-122`), and submission relies only on the invite token. Options:
  - (a) keep token-only submission, make the route public, rate limit by token, and make tokens single-use and expiring;
  - (b) add a `userId` to `Student` and require a `STUDENT` login bound to the invite.
  - Acceptance: option chosen and written up; `SEC-04` scoped accordingly.
- [ ] **DEC-04 · P1.** API prefix: `/api` or `/api/v1` (`API_IMPLEMENTATION_MATRIX.md` section 5). Recommendation: `/api/v1`.
  - Acceptance: `routes/index.ts` and README agree; Swagger regenerated (`INF-15`).

---

## Phase 0: Foundation and Test Safety

### Security harness and config

- [ ] **SEC-11 · P0.** Integration test harness that runs the real Express app against a disposable PostgreSQL (and Redis), applies migrations, and seeds two institutes with one ADMIN and one STUDENT each.
  - Files: new `jest.integration.config.ts`, `src/test-utils/` fixtures, `compose.yaml` (test profile or a separate database name), `package.json` script `test:integration`.
  - Depends on: nothing.
  - Acceptance: `npm run test:integration` runs against Docker Postgres on a database that is never `psychometric_db`, resets between suites, and passes on a clean checkout.
- [ ] **SEC-12 · P0.** Authorization matrix test: for each of the 38 endpoints, assert the allowed and denied outcome for `ADMIN` of institute A, `ADMIN` of B, `STUDENT`, and no token.
  - Files: `src/**/*.integration.spec.ts`.
  - Depends on: SEC-11, DEC-01.
  - Acceptance: matrix covers all 38 endpoints; every row documented in `API_IMPLEMENTATION_MATRIX.md` matches a test.
- [ ] **SEC-07 · P0.** Load configuration once at bootstrap. Import `dotenv` in the server entry before any module reads `process.env`. Remove all JWT fallbacks. Use one config module for `utils/jwt.ts` and `middleware/auth.middleware.ts`.
  - Files: `src/server.ts`, `src/config/index.ts`, `src/utils/jwt.ts:9-12`, `src/middleware/auth.middleware.ts:4`.
  - Depends on: nothing.
  - Acceptance: starting the server without `JWT_SECRET` exits non-zero with a message that names the variable and not its value; with `.env` set, login and a protected route both succeed without exporting the variable; a token signed with `dev-secret` or `your_jwt_secret` is rejected.
- [ ] **INF-03 · P1.** Validate all environment variables at startup (PORT, DATABASE_URL, JWT_SECRET minimum 32 characters, JWT_EXPIRES_IN, REDIS_URL, CORS_ORIGINS, NODE_ENV).
  - Files: `src/config/index.ts`, `scripts/ensure-env.js`.
  - Depends on: SEC-07.
  - Acceptance: a short `JWT_SECRET` fails startup; `CHANGE_ME` placeholders fail startup outside development.

### Tenant isolation fixes (P0)

- [ ] **SEC-01 · P0.** Publish and delete take the institute only from the JWT. Remove `req.body.instituteId`.
  - Files: `src/modules/tests/test.controller.ts:137-212`, `src/modules/tests/test.service.ts:183-271`, `src/modules/tests/test.routes.ts:160, 192`.
  - Depends on: SEC-11.
  - Acceptance: ADMIN of A calling publish or delete on B's test gets 404 (not 200, and not a leak of B's title). Body `instituteId` is ignored. Role check moved to `authorizeRoles('ADMIN')` at route level.
- [ ] **SEC-02 · P0.** Institute endpoints: restrict create, list, update and delete to the platform role. Scope get and update to the caller's own institute.
  - Files: `src/modules/institute/institute.routes.ts:49-230`, `institute.controller.ts`, `institute.service.ts:161-192`.
  - Depends on: DEC-01.
  - Acceptance: STUDENT receives 403 on all five routes. ADMIN of A receives 404 for B's institute. Delete does not run for institutes the caller does not own.
- [ ] **SEC-03 · P0.** Response read and delete scoped to the caller's institute. List-all restricted to platform role. Delete restricted to ADMIN of the same institute and blocked for COMPLETED invites.
  - Files: `src/modules/responses/response.routes.ts:36, 121, 162, 191`, `response.service.ts:424-541`.
  - Depends on: DEC-01, SEC-11.
  - Acceptance: cross-tenant read returns 404; STUDENT cannot list or delete; deleting a response of a completed invite returns 409.
- [ ] **SEC-05 · P0.** Stop returning invite tokens except to the invited student or to the ADMIN who issued them in the same institute. Restrict `GET /api/invites` to the platform role.
  - Files: `src/modules/invites/invite.routes.ts:37, 203`, `invite.service.ts:189-249`.
  - Depends on: DEC-01, DEC-03.
  - Acceptance: a tenant ADMIN cannot see other tenants' invites; a STUDENT or another student cannot read a student's token; tokens are not in list responses that the caller does not own.
- [ ] **SEC-04 · P0 · BLOCKED on DEC-03.** Bind submission to the invited student's identity, per the decision.
  - Files: `src/modules/responses/response.routes.ts:80`, `response.controller.ts:21-44`, `response.service.ts:321-349`.
  - Depends on: DEC-03, SEC-11.
  - Acceptance: a token used by someone other than the invited student is rejected with 403; a replayed token after completion is rejected with 409.
- [ ] **SEC-06 · P0.** Tenant checks on dimension and question create, delete and read. Load the test or dimension, compare its institute with the token's institute before any write.
  - Files: `src/modules/dimensions/dimension.service.ts:19-49, 93-116, 51-75`, `dimension.routes.ts:168, 326, 450`, `src/modules/questions/question.service.ts:132-165, 167-189, 207-227`, `question.routes.ts:84, 141, 188`.
  - Depends on: SEC-11.
  - Acceptance: cross-tenant create or delete returns 404; STUDENT cannot read dimensions or questions of tests outside an active invite (see SEC-09 for the student rule).
- [ ] **SEC-09 · P0.** Scope all list endpoints to the token's institute: tests list, users list, dimensions list, questions list, responses list, invites list, reports list.
  - Files: `test.service.ts:165-179`, `auth.service.ts:121-143`, `dimension.service.ts:77-91`, `question.service.ts:191-205`, `response.service.ts:489-510`, `invite.service.ts:235-249`, `report.service.ts:142-163`.
  - Depends on: DEC-01, SEC-11.
  - Acceptance: list responses contain only the caller's institute rows; platform role lists all rows only if DEC-01 grants it.
- [ ] **SEC-10 · P0.** Test report and student report: check the test belongs to the caller's institute; fix the student route to call a real student-report handler.
  - Files: `src/modules/reports/report.routes.ts:92-95, 139-142`, `report.controller.ts:37-53`, `report.service.ts:29-140`.
  - Depends on: SEC-11.
  - Acceptance: cross-tenant read returns 404; `GET /reports/reports/student/:studentId/test/:testId` returns one student's data, not all students. The handler fix itself is tracked in `RPT-01`.

### Account and session

- [ ] **SEC-08 · P0.** Reject login for inactive users and inactive institutes. Reject tokens for users that became inactive after issue.
  - Files: `src/modules/auth/auth.service.ts:79-119`, `src/middleware/auth.middleware.ts:10-27`.
  - Depends on: AUTH-06 (for a deactivation route to test against), SEC-11.
  - Acceptance: after deactivating a user, login returns 401 and an existing token returns 401 on the next request (DB lookup in the middleware, or a documented short token life if DB lookup is rejected for performance).

### Data integrity (P0)

- [ ] **DB-01 · P0.** Fix soft-delete cascade. Replace the child-only `modelFieldMap` with explicit `{ childModel, foreignKey }` pairs per parent.
  - Files: `src/utils/softDelete.ts:29-104`, `src/modules/institute/institute.service.ts:189`, `src/modules/tests/test.service.ts:264`, `src/modules/students/student.service.ts:449`.
  - Depends on: SEC-11.
  - Acceptance: integration test: deleting an institute deactivates its users, students, tests, dimensions, questions, invites and responses. Deleting a test deactivates its dimensions, questions, invites and responses. Deleting a student deactivates its invites and responses. Also fix the `updatedBy` value that is passed as the institute id in `test.service.ts:264`.
- [ ] **DB-02 · P0.** Re-invite after deletion. Replace the unconditional unique `(testId, studentId)` with a partial unique index `WHERE "isActive" = true`, via a new migration (raw SQL in the migration file, since Prisma cannot express it).
  - Files: new `prisma/migrations/<timestamp>_invite_active_unique/migration.sql`, `prisma/schema.prisma:143`, `invite.service.ts:91-105`.
  - Depends on: DEC-02 (whether re-invite is allowed), a check that no duplicate active rows exist first.
  - Acceptance: after deleting an invite, re-inviting the same student succeeds; two active invites for the same pair are still rejected.
- [ ] **DB-03 · P0.** Response integrity on submit: every `questionId` must belong to the invite's test (join through dimension); reject duplicate `questionId` in one payload; require integer answers within scale. Add unique `(studentId, questionId)` via migration after a duplicate check.
  - Files: `src/modules/responses/response.service.ts:353-396`, `prisma/schema.prisma:148-166`, new migration.
  - Depends on: SEC-11.
  - Acceptance: submitting a question from another test returns 400; duplicates return 400; `2.5` returns 400; a repeated submit returns 409.

---

## Phase 1: Security and Access Management

- [ ] **SEC-02b · P1.** Route-level role checks for tests list, publish and delete (move from service and controller to `authorizeRoles`). Covered by SEC-01 for scope.
  - Files: `test.routes.ts:105, 160, 192`.
  - Acceptance: STUDENT receives 403 at the route, before the controller runs.
- [ ] **ARC-01 · P1.** Central authorization policy: one function per resource that answers "can this user act on this resource?" Controllers and services call it, not inline checks.
  - Files: new `src/policies/`, then controllers in all modules.
  - Depends on: SEC-01 to SEC-10 (the fixes define the rules).
  - Acceptance: every tenant check in `src/modules/` calls the policy; a grep for `instituteId` comparisons outside `src/policies/` returns only repository-level filters.
- [ ] **AUTH-01 · P1.** Refresh tokens with rotation and logout (revocation list in Redis, with the DB as fallback for durability).
  - Files: `auth.routes.ts`, `auth.service.ts`, new `src/modules/auth/session.*`, `config/redis.ts`.
  - Depends on: SEC-08, PRD FR-5.1 confirmation.
  - Acceptance: logout invalidates the refresh token; refresh rotates it; a reused refresh token revokes the family; access tokens stay short-lived.
- [ ] **AUTH-02 · P1.** Password policy (minimum length, not matching email) and email format validation on register and user creation. Use express-validator on the routes.
  - Files: `auth.routes.ts`, new `auth.validation.ts`, `auth.controller.ts:189-196`.
  - Acceptance: a password under the minimum returns 400 with a field-level error; an invalid email returns 400.
- [ ] **AUTH-06 · P1.** Deactivate a user: wire `auth.service.deleteUser` to `PATCH /api/auth/users/:id/status` (ADMIN, same institute).
  - Files: `auth.service.ts:146-163`, `auth.routes.ts`, `auth.controller.ts`.
  - Acceptance: deactivated user cannot log in (SEC-08); cannot deactivate a user of another institute.
- [ ] **AUTH-03 · P1.** Rate limiter keyed correctly: apply per-user after authentication on protected routes; keep per-IP on login and register.
  - Files: `app.ts:46`, `rateLimit.middleware.ts:69-72`.
  - Acceptance: a user cannot exhaust another user's quota; the limit is applied on routes that are authenticated.
- [ ] **AUTH-04 · P2.** Decide and implement login behaviour when Redis is down (fail-open vs fail-closed for login only).
  - Files: `rateLimit.middleware.ts:78-81`.
  - Depends on: DEC-01 (security sign-off).
- [ ] **INF-08 · P1.** Security headers (helmet), CORS default closed outside development, Swagger UI disabled or protected outside development.
  - Files: `src/app.ts:17-43`, `package.json` (new dependency: decide with owner).
  - Acceptance: CORS with `CORS_ORIGINS` unset rejects cross-origin credentialed requests when `NODE_ENV=production`; `/api-docs` returns 404 in production.
- [ ] **INF-09 · P1.** One error response shape, and never return internal messages on 500.
  - Files: `src/middleware/error.middleware.ts:36-43`, `src/utils/response-helpers.ts`, `src/middleware/auth.middleware.ts:17-25`, `role.middleware.ts`, `validate.middleware.ts:12-16`.
  - Acceptance: all error responses use the same envelope; a forced 500 returns a generic message and a request id; the stack and Prisma message appear only in logs.
- [ ] **INF-13 · P1.** Seed script refuses to run when `NODE_ENV=production`, and does not create a fixed-password admin unless an explicit dev flag is set.
  - Files: `prisma/seed.ts`.
  - Acceptance: seed exits with a message under production; dev seed generates a random password printed once to the console.
- [ ] **AUTH-07 · P2 · BLOCKED on DEC-01.** Role model (7 roles, permission matrix) if confirmed.
  - Files: `prisma/schema.prisma:168-171`, `src/middleware/role.middleware.ts`.
  - Acceptance: permission matrix in code and in docs; each route declares required permissions.
- [ ] **AUTH-08 · P2 · BLOCKED on DEC-02.** Invite-only user creation, or keep public signup with email verification.
  - Acceptance: per the decision.
- [ ] **AUTH-05 · P2 · BLOCKED on email (INV-05).** Password reset flow with single-use, expiring tokens.
  - Acceptance: reset token expires after the configured window and cannot be reused.

---

## Phase 2: Core Assessment Management

### Institutes
- [ ] **INS-01 · P1.** Activate and deactivate institutes: `PATCH /api/institutes/:id/status` (platform role). Inactive institute blocks login (SEC-08).
  - Files: `institute.routes.ts`, `institute.service.ts`, `institute.controller.ts`.
  - Acceptance: inactive institute users get 401 on login; reactivating restores access without data change.
- [ ] **INS-02 · P1 · BLOCKED on Q25.** Fix the unreachable duplicate-email branch. If `Institute.email` is unique, add a migration; if not, remove the `P2002` branch.
  - Files: `institute.service.ts:40-46`, `schema.prisma:10-24`.
  - Acceptance: duplicate institute email behaves as documented.

### Tests
- [ ] **TST-01 · P1.** Edit test metadata: `PATCH /api/tests/:id` for title and description, DRAFT only.
  - Files: `test.routes.ts`, `test.service.ts`, `test.controller.ts`.
  - Depends on: SEC-01.
  - Acceptance: editing a PUBLISHED test returns 409; cross-tenant edit returns 404.
- [ ] **TST-02 · P1.** Publish guard: a test must have at least one dimension, and each dimension at least one question, before publish.
  - Files: `test.service.ts:183-235`.
  - Acceptance: publishing an empty test returns 422 with a clear message.
- [ ] **TST-03 · P1 · BLOCKED on DEC-02 / Q18.** Lock published test structure: reject dimension and question changes after PUBLISHED.
  - Files: `dimension.service.ts`, `question.service.ts`.
  - Acceptance: per decision; test covers create, update and delete after publish.
- [ ] **TST-04 · P2.** Archive status for tests (new enum value via migration). Archived tests reject new invites.
  - Files: `schema.prisma:173-176`, new migration, `test.service.ts`.
- [ ] **TST-05 · P2 · BLOCKED on Q8.** Test versioning. Results reference the version used.
- [ ] **TST-06 · P2 · BLOCKED on Q10 and Q9.** Duration, availability window and scheduling.
- [ ] **TST-07 · P3.** Remove `getInstituteTests` (`test.controller.ts:57-110`) or route it with tenant scope. It is unrouted today.

### Dimensions and questions
- [ ] **DQ-01 · P1.** Update dimension and question (name, text, scale). DRAFT-only if DEC-02 locks structure.
  - Files: `dimension.routes.ts`, `question.routes.ts`, services and controllers.
  - Acceptance: cross-tenant update returns 404; updating scale that invalidates existing responses returns 409.
- [ ] **DQ-02 · P1.** Stop silently dropping `description` on dimension create: store it (migration) or reject the field.
  - Files: `dimension.service.ts:21`, `schema.prisma:65-81`.
- [ ] **DQ-03 · P2.** Question ordering (`sortOrder`) and ordered read. Migration needed.
  - Files: `question.service.ts:181-184`, `schema.prisma:83-102`.
- [ ] **DQ-04 · P2 · BLOCKED on Q9.** Question types beyond scale.
- [ ] **DQ-05 · P3 · BLOCKED on Q9.** Question bank reuse across dimensions (many-to-many join table).

### Students
- [ ] **STU-01 · P1.** Update student (name, email) with per-institute uniqueness check.
  - Files: `student.routes.ts`, `student.service.ts`, `student.validation.ts`.
  - Acceptance: changing to an existing email in the same institute returns 409.
- [ ] **STU-02 · P1.** Activate and deactivate student: `PATCH /api/students/:id/status`. Inactive student cannot start or submit an invite.
  - Acceptance: submit for inactive student returns 403.
- [ ] **STU-03 · P1.** Bulk upload: row limit per request (number to confirm), per-row validation, in-batch de-duplication, and a per-row result list (created, skipped with reason, invalid with reason).
  - Files: `student.service.ts:357-424`, `student.controller.ts:99-140`, `student.routes.ts:199-202`.
  - Acceptance: 1,001 rows with a limit of 1,000 returns 413 or 400; duplicates inside the file are reported; response lists every skipped row.
- [ ] **STU-04 · P1.** Consistent validation: express-validator for bulk upload and every write route. Drop the unused `instituteId` body rule (tenant comes from token).
  - Files: `student.validation.ts`, `student.routes.ts`.
- [ ] **STU-05 · P1.** Unique `(instituteId, email)` on Student after de-duplicating existing data. Needs Q22 for the uniqueness scope.
  - Files: `schema.prisma:104-122`, new migration.
- [ ] **STU-06 · P2.** CSV upload (multipart) with file-type and size validation.
  - Depends on: a file storage decision (architecture "File Storage"), not yet recorded.
- [ ] **STU-07 · P2.** Remove student email from info logs (SEC-L1). Mask PII.
  - Files: `student.service.ts:319, 330-332`.
  - Depends on: a decision on which PII fields may appear in logs (PRD FR-5.2 "PII masking in logs").

### Invitations
- [ ] **INV-01 · P1 · BLOCKED on Q5 (DEC-02).** Invite expiry: set `expiresAt` from configuration on create; reject start and submit after expiry with 410.
  - Files: `invite.service.ts`, `schema.prisma:132`, `config`.
  - Acceptance: expired invite returns 410 on start and submit; status shows EXPIRED or a derived state.
- [ ] **INV-02 · P1 · BLOCKED on Q6.** Re-invite policy implemented (depends on DB-02).
- [ ] **INV-03 · P1 · BLOCKED on Q23.** Only allow invites to PUBLISHED tests, or allow and document.
  - Files: `invite.service.ts:26-137`.
- [ ] **INV-04 · P1.** Token start endpoint: `GET /api/invites/token/:token` returns test title, instructions, expiry and invite status (no other student data). Public, rate limited.
  - Depends on: DEC-03.
  - Acceptance: returns 404 for unknown token, 410 for expired, 409 for completed.
- [ ] **INV-05 · P2 · BLOCKED on Q4.** Email delivery through a provider, with an outbox table and retry.
  - Files: new `src/modules/notifications/`, `schema.prisma` (outbox), `config`.
- [ ] **INV-06 · P2.** Resend and reminder jobs (requires INV-05 and a job runner, see INF-12).

---

## Phase 3: Assessment Execution Engine

- [ ] **RSP-01 · P1.** Assessment session model (attempt): id, inviteId, studentId, startedAt, deadline, status (IN_PROGRESS, SUBMITTED, EXPIRED), lastSavedAt. Migration.
  - Files: `schema.prisma`, new migration, new `src/modules/sessions/`.
  - Depends on: DEC-03, DB-02.
  - Acceptance: one active session per invite; starting twice returns the existing session.
- [ ] **RSP-02 · P1.** Start endpoint: creates the session and sets `deadline = startedAt + test time limit` (time limit from TST-06).
  - Acceptance: second start returns the same deadline; start after expiry returns 410.
- [ ] **RSP-03 · P1.** Autosave endpoint: upsert draft answers for the session in one transaction. Answers are validated like submit (DB-03) but not finalized.
  - Acceptance: autosave after deadline returns 410; autosave never sets invite COMPLETED.
- [ ] **RSP-04 · P1.** Resume endpoint: returns saved answers, remaining seconds, next unanswered question.
- [ ] **RSP-05 · P1 · BLOCKED on Q24.** Server-side timer enforced at submit. The server decides the deadline, not the client.
- [ ] **RSP-06 · P1 · BLOCKED on Q7.** Completeness rule on submit (all questions or partial allowed).
- [ ] **RSP-07 · P1.** Make submission the only path to COMPLETED and to final response rows. Drafts live on the session, not in `Response`, until submit. Removes the risk of partial rows.
  - Files: `response.service.ts`, `schema.prisma`.
  - Acceptance: a student who never submits produces no `Response` rows.
- [ ] **RSP-08 · P1.** Immutability after completion: responses cannot be edited or deleted after the invite is COMPLETED (remove or guard `DELETE /api/responses/responses/:id`, see SEC-03).
- [ ] **RSP-09 · P2.** Student's own responses endpoint (`GET /api/responses/my`), ownership checked against STU linkage from DEC-03.
- [ ] **RSP-10 · P2.** Concurrency control on submit: lock the session row (SELECT ... FOR UPDATE) so two submits cannot both succeed.
  - Files: `response.service.ts:331-346`.
  - Acceptance: parallel submit test returns exactly one 2xx and one 409.

---

## Phase 4: Psychometric Scoring

- [ ] **RPT-01 · P0.** Real student report handler: `getStudentReport` wired to `GET /api/reports/reports/student/:studentId/test/:testId`.
  - Files: `report.routes.ts:92-95`, `report.controller.ts`, `report.service.ts:29-99`.
  - Depends on: SEC-10.
- [ ] **RPT-02 · P1.** Exclude soft-deleted dimensions, questions and responses in all report queries. Replace per-student queries with one grouped query per test (remove N+1).
  - Files: `report.service.ts:35-44, 46-61, 101-140`.
  - Acceptance: deleting a dimension removes its score from reports; query count for a test with 200 students is constant (checked by a test that counts Prisma calls).
- [ ] **RPT-03 · P1 · BLOCKED on Q10.** Scoring specification and single implementation. Use or replace `src/utils/scoring.ts` (currently unused). One function computes scores, used by reports.
  - Acceptance: a fixture with known answers produces the documented scores; the spec is in `docs/`.
- [ ] **RPT-04 · P2 · BLOCKED on Q10.** Reverse-scored items and dimension weights.
- [ ] **RPT-05 · P2 · BLOCKED on Q10.** Normative scoring and percentiles against an institute benchmark.
- [ ] **RPT-06 · P2.** Persist result snapshot at completion with scoring version, so later changes to questions do not change past results.
  - Files: new `schema.prisma` model `ReportSnapshot`, migration.
- [ ] **RPT-07 · P2 · BLOCKED on Q11.** Institute-level report: per-test summary and dimension distribution, admin scope only.
- [ ] **RPT-08 · P2 · BLOCKED on Q12.** CSV export of test results (streamed, not in memory).
- [ ] **RPT-09 · P3 · BLOCKED on Q12.** PDF export through a background job (queue, see INF-12).
- [ ] **RPT-10 · P3 · BLOCKED on Q13.** AI-assisted interpretation, with governance review per architecture "AI Governance".

---

## Phase 5: Reporting, Notifications and Exports

- [ ] **RPT-11 · P2.** Report caching for test-level report with invalidation on new submit (Redis, key per test, TTL plus invalidation).
  - Files: `cache.ts`, `report.service.ts`, `response.service.ts`.
- [ ] **INV-07 · P2.** Notifications: in-app or email for completed assessments to ADMIN (depends on INV-05).
- [ ] **DB-09 · P1.** Migration safety: document that `20260314095101` only applies to empty tables; add a CI check that applies migrations to an empty database and fails on error. Run `npx prisma migrate status` once the database is up and record the result.
  - Depends on: INF-01 (Docker running).
  - Acceptance: CI job green on a clean database; status recorded in `IMPLEMENTATION_AUDIT.md` section 7.

---

## Phase 6: Production Readiness and Platform

### Infrastructure and observability
- [ ] **INF-01 · P1.** CI workflow (GitHub Actions): install, `npm run build`, unit tests, integration tests with Postgres and Redis service containers, migrations applied, Prisma validate.
  - Files: new `.github/workflows/ci.yml`.
  - Depends on: SEC-11.
  - Acceptance: a pull request fails when a test fails or the build breaks.
- [ ] **INF-02 · P1.** Split health into liveness (`/api/health`) and readiness (`/api/health/ready`, checks Postgres with `SELECT 1` and Redis with `PING`, returns 503 if Postgres is down).
  - Files: `src/routes/index.ts:242`.
- [ ] **INF-04 · P2.** Lint and typecheck scripts (`eslint`, `tsc --noEmit`) added to `package.json`. Needs approval for new dev dependencies.
- [ ] **INF-05 · P2.** Migration scripts in `package.json` (`db:migrate:dev`, `db:migrate:deploy`, `db:status`).
- [ ] **INF-06 · P2.** Dockerfile for the API and a production compose file (app plus Postgres plus Redis, secrets from environment).
- [ ] **INF-07 · P2.** Structured logging (JSON, request id, level from env) and error tracking. Choose the tool with the owner.
  - Files: `src/config/logger.ts`, `src/app.ts`.
- [ ] **INF-10 · P2.** Remove unused dependencies (`uuid`, `pg`), use one bcrypt library (`bcryptjs` in the app; the seed can use it too), remove dead code (`performSoftDelete`, `cacheDeleteByPattern`, `config/index.ts` once INF-03 lands).
  - Files: `package.json`, `softDelete.ts`, `cache.ts`, `prisma/seed.ts`.
- [ ] **INF-11 · P3.** Move Prisma configuration out of `package.json` into `prisma.config.ts` before Prisma 7.
- [ ] **INF-12 · P2.** Background job runner (BullMQ or similar, needs Redis persistence) for exports, email and reminders. Decision with owner.
- [ ] **INF-14 · P2.** Redis in production requires a password and TLS; document fail-open behaviour in the README.
- [ ] **INF-15 · P1 · Depends on DEC-04.** Regenerate Swagger from route annotations. Remove duplicate blocks. Make every documented path exist in the code, and add a test that loads the spec and checks every route is documented.
  - Files: all `src/modules/*/*.routes.ts`, `src/config/swagger.ts`, `scripts/add-swagger-to-routes.js`.
- [ ] **INF-16 · P2.** Backup and restore procedure (scheduled `pg_dump`, restore drill), documented in `README.md`.
- [ ] **INF-17 · P2.** Connection pool configuration (`connection_limit` in `DATABASE_URL`, documented defaults).

### Documentation
- [ ] **DOC-01 · P1.** Update README: API prefix (DEC-04), accurate Redis use cases, environment variables table, and the Docker status requirement for tests.
- [ ] **DOC-02 · P1.** Mark `_bmad-output/backend-audit-report.md` as superseded by this audit (add a header line, do not delete).
- [ ] **DOC-03 · P1.** Fix the epic numbering and story-count claims in `_bmad-output/planning-artifacts/epics.md` (D3, D4).
- [ ] **DOC-04 · P3.** Populate or remove the empty `docs/context/project-context.md`.

---

## Architecture and Code Quality

- [ ] **ARC-02 · P2.** Typed application errors (`AppError` with `status` and `code`). Replace string-matching in controllers (`test.controller.ts:152-166`, `institute.controller.ts:317-355`, `response.controller.ts:31-37`).
- [ ] **ARC-03 · P1.** Cap `limit` at 100 in every `getAll*` service and every list controller (currently uncapped in most services).
  - Files: `auth.service.ts:121-143`, `institute.service.ts:115-129`, `test.service.ts:165-179`, `dimension.service.ts:77-91`, `question.service.ts:191-205`, `invite.service.ts:235-249`, `response.service.ts:489-510`, `report.service.ts:142-163`.
- [ ] **ARC-04 · P2.** Pagination helper shared by all lists (removes about nine copies).
- [ ] **ARC-05 · P2.** Type `req.user` once (`AuthRequest`) and remove `(req as any).user` (73 `any` uses in `src/`).
- [ ] **ARC-06 · P2.** Move business rules out of controllers into services (for example `test.controller.ts:25-45` role and institute checks, now replaced by ARC-01).
- [ ] **ARC-07 · P3.** Move large Swagger blocks out of route files (`dimension.routes.ts` is 456 lines).
- [ ] **ARC-08 · P3.** Naming: normalise route segments (`/AddStudent` to `/students`), and file naming style. Breaking change: needs DEC-04 and a changelog entry.

---

## Testing

- [ ] **TST-UNIT-01 · P1.** Service unit tests for invites, responses, reports and softDelete. Target 70% line coverage of `src/modules/*/*.service.ts` (architecture target).
  - Acceptance: `npm run test:coverage` shows at least 70% for service files; coverage gate in CI.
- [ ] **TST-UNIT-02 · P1.** Unit tests for `authenticateJWT`, `authorizeRoles`, `validateRequest` and the rate limiter's per-user keying (SEC-M4).
- [ ] **TST-E2E-01 · P1.** Happy path integration test: register, create test, dimension, question, publish, create student, invite, start, submit, student report and test report.
  - Depends on: SEC-11, DB-01 to DB-03.
- [ ] **TST-E2E-02 · P1.** Concurrency test: parallel submits, parallel invites for the same student (depends on DB-02 and RSP-10).
- [ ] **TST-E2E-03 · P1.** Migration test: apply all migrations to an empty database, then roll forward the new migrations on a database with seed data.
- [ ] **TST-LOAD-01 · P3.** Load test for the report endpoint at 200 students per test (NFR1 target to be confirmed).

---

## Items Explicitly Out of MVP Scope

Do not start these before the MVP is accepted and the scope decisions are recorded (`IMPLEMENTATION_GAP_ANALYSIS.md` sections 5.2 and 12):

- AI interpretation, question generation, recommendations, predictive analytics (FR22-25, FR6).
- Coding assessments and auto-evaluation (FR31-34).
- Proctoring, live monitoring, webcam, behavioural biometrics (FR35-40). High privacy risk; legal review first.
- ATS and HRMS integrations, public API with API keys, webhooks (FR26-30).
- Multilingual support, accessibility programme (Phase 2-3).
- Billing, subscription and licensing (FR-3.3).
- Session recording (FR43).
