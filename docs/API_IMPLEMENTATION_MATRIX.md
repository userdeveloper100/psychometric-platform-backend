# API Implementation Matrix

**Audit date:** 2026-11-24
**Written for:** backend developers and the QA lead.
**Source of truth:** route files in `src/modules/*/*.routes.ts`, mounted in `src/routes/index.ts:231-239`. Swagger is compared, not trusted.

**Status key**
- **Implemented:** the business path works by code reading and is correctly guarded for its intended role and tenant.
- **Partial:** the happy path exists, but a security, scope, or business-rule defect is present (see ID).
- **Missing:** planned but no endpoint exists.
- **Runtime status for all rows: NEEDS VALIDATION.** No integration run was possible (no database). "Implemented" means "code path present and reviewed", not "tested".

**Auth column:** `Public` = no token. `JWT` = any valid token. `JWT+ADMIN` = `authorizeRoles('ADMIN')`. `JWT+ADMIN (svc)` = role checked inside the service only.

**Tenant column:** `Token` = institute taken from the JWT and enforced. `Body` = institute taken from the request body (unsafe). `None` = no institute check. `Same-institute` = checked against the token's institute.

---

## 1. Full Inventory

Base path for every row: `/api` (the README's `/api/v1` is not implemented).

| # | Module | Method | Endpoint | Purpose | Auth | Tenant | Status | Swagger | Evidence |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Auth | POST | `/api/auth/register` | Create institute and first ADMIN | Public (IP rate limit 10/min) | n/a | Partial (no password policy, no email verification, SEC-M6/M7) | Accurate | `auth.routes.ts:119`, `auth.service.ts:24-77` |
| 2 | Auth | POST | `/api/auth/login` | Issue JWT | Public (IP rate limit 10/min) | n/a | Partial (deactivated users and institutes can log in, SEC-H5; JWT secret not loaded, SEC-C6) | Accurate | `auth.routes.ts:221`, `auth.service.ts:79-119` |
| 3 | Auth | GET | `/api/auth/users` | List users (paginated) | JWT+ADMIN (controller) | None (SEC-H2) | Partial | Accurate | `auth.routes.ts:351`, `auth.controller.ts:86-115`, `auth.service.ts:121-143` |
| 4 | Institutes | POST | `/api/institutes` | Create institute | JWT (any role, SEC-C2) | n/a | Partial | Generic template (`/api/v1/`) | `institute.routes.ts:49` |
| 5 | Institutes | GET | `/api/institutes` | List institutes, search | JWT (any role, SEC-C2) | None (global list) | Partial | Generic template | `institute.routes.ts:99` |
| 6 | Institutes | GET | `/api/institutes/:id` | Get one institute | JWT (any role, SEC-C2) | None | Partial | Generic template | `institute.routes.ts:138` |
| 7 | Institutes | PUT | `/api/institutes/:id` | Update institute name | JWT (any role, SEC-C2) | None | Partial | Generic template | `institute.routes.ts:189` |
| 8 | Institutes | DELETE | `/api/institutes/:id` | Soft delete institute and cascade | JWT (any role, SEC-C2) | None | Partial (cascade defect, DB-01) | Generic template | `institute.routes.ts:230`, `institute.service.ts:180-192` |
| 9 | Tests | POST | `/api/tests` | Create DRAFT test | JWT, role checked in service | Token | Implemented | Accurate | `test.routes.ts:53`, `test.service.ts:53-103` |
| 10 | Tests | GET | `/api/tests` | List tests (paginated) | JWT (any role) | None (SEC-H3) | Partial | Accurate | `test.routes.ts:105`, `test.service.ts:165-179` |
| 11 | Tests | PATCH | `/api/tests/:id/publish` | DRAFT to PUBLISHED | JWT, role checked in service | **Body** (SEC-C1) | Partial | Drift (`/api/v1/{id}/publish`) | `test.routes.ts:160`, `test.controller.ts:137-175`, `test.service.ts:183-235` |
| 12 | Tests | DELETE | `/api/tests/:id` | Soft delete test and cascade | JWT, role checked in service | **Body** (SEC-C1) | Partial (cascade defect, DB-01) | Drift (`/api/v1/{id}`) | `test.routes.ts:192`, `test.controller.ts:177-212`, `test.service.ts:239-271` |
| 13 | Dimensions | GET | `/api/dimensions` | List all dimensions (paginated) | JWT (any role) | None | Partial | Duplicate entries, drift | `dimension.routes.ts:37` |
| 14 | Dimensions | GET | `/api/dimensions/tests/:testId/dimensions` | List dimensions of a test (cached) | JWT (any role) | None (SEC-H4) | Partial | Duplicate entries, drift | `dimension.routes.ts:168`, `dimension.service.ts:51-75` |
| 15 | Dimensions | POST | `/api/dimensions/tests/:testId/dimensions` | Create dimension | JWT+ADMIN | None (SEC-C5) | Partial | Duplicate entries, drift | `dimension.routes.ts:326`, `dimension.service.ts:19-49` |
| 16 | Dimensions | DELETE | `/api/dimensions/dimensions/:id` | Soft delete dimension and questions | JWT+ADMIN | None (SEC-C5) | Partial | Duplicate entries, drift | `dimension.routes.ts:450`, `dimension.service.ts:93-116` |
| 17 | Questions | GET | `/api/questions` | List all questions (paginated) | JWT (any role) | None | Partial | Accurate path (`/api/questions`) | `question.routes.ts:37`, `question.service.ts:191-205` |
| 18 | Questions | GET | `/api/questions/dimensions/:dimensionId/questions` | List questions of a dimension | JWT (any role, SEC-H4) | None | Partial | Drift (`/api/v1/dimensions/...`) | `question.routes.ts:84`, `question.service.ts:167-189` |
| 19 | Questions | POST | `/api/questions/dimensions/:dimensionId/questions` | Create question (scale 1-5 default) | JWT+ADMIN | None (SEC-C5) | Partial | Drift | `question.routes.ts:141`, `question.service.ts:132-165` |
| 20 | Questions | DELETE | `/api/questions/questions/:id` | Soft delete question and responses | JWT+ADMIN | None (SEC-C5) | Partial | Drift | `question.routes.ts:188`, `question.service.ts:207-227` |
| 21 | Students | GET | `/api/students` | List students of own institute (paginated, search) | JWT+ADMIN | Token | Implemented | Accurate | `student.routes.ts:64-67`, `student.service.ts:253-310` |
| 22 | Students | POST | `/api/students/AddStudent` | Create one student | JWT+ADMIN, express-validator | Token | Implemented | Accurate path (`/api/students/AddStudent`) | `student.routes.ts:143-147`, `student.service.ts:314-353` |
| 23 | Students | POST | `/api/students/bulk-upload` | Bulk create students | JWT+ADMIN, no validation | Token | Partial (no size limit, no dedupe in batch, SEC-M9) | Drift (`/api/v1/bulk-upload`) | `student.routes.ts:199-202`, `student.service.ts:357-424` |
| 24 | Students | DELETE | `/api/students/:id` | Soft delete student and invites (responses missed) | JWT+ADMIN | Token | Partial (cascade defect, DB-01) | Drift (`/api/v1/{id}`) | `student.routes.ts:252-255`, `student.service.ts:428-461` |
| 25 | Invites | GET | `/api/invites` | List all invites (returns tokens) | JWT+ADMIN | **None** (SEC-C4) | Partial (critical) | Accurate path (`/api/invites`) | `invite.routes.ts:37-40`, `invite.service.ts:235-249` |
| 26 | Invites | POST | `/api/invites/tests/:testId/invite` | Invite students to a test (bulk) | JWT+ADMIN | Token | Partial (re-invite after delete fails, DB-02; no status or expiry check) | Drift (`/api/v1/tests/{testId}/invite`) | `invite.routes.ts:99-102`, `invite.service.ts:26-137` |
| 27 | Invites | GET | `/api/invites/tests/:testId/invites` | List invites of a test with student info | JWT+ADMIN | Token | Implemented | Drift (`/api/v1/tests/{testId}/invites`) | `invite.routes.ts:151-154`, `invite.service.ts:141-185` |
| 28 | Invites | GET | `/api/invites/students/:studentId/invites` | List invites of a student (returns tokens) | JWT (any role, SEC-C4) | Same-institute | Partial | Drift (`/api/v1/students/{studentId}/invites`) | `invite.routes.ts:203`, `invite.service.ts:189-233` |
| 29 | Invites | DELETE | `/api/invites/:id` | Soft delete invite (not if COMPLETED) | JWT+ADMIN | Token | Implemented | Drift (`/api/v1/{id}`) | `invite.routes.ts:254-257`, `invite.service.ts:253-300` |
| 30 | Responses | GET | `/api/responses` | List all responses (paginated) | JWT (any role, SEC-C3) | **None** | Partial (critical) | Accurate path (`/api/responses`) | `response.routes.ts:36`, `response.service.ts:489-510` |
| 31 | Responses | POST | `/api/responses/responses/submit` | Submit answers for an invite token | JWT (any role), token-based identity (SEC-C4, SEC-H6) | Token-bound invite only | Partial | Drift (`/api/v1/responses/submit`) | `response.routes.ts:80`, `response.service.ts:321-422` |
| 32 | Responses | GET | `/api/responses/responses/student/:studentId` | All responses of a student | JWT (any role, SEC-C3) | None | Partial (critical) | Drift | `response.routes.ts:121`, `response.service.ts:424-446` |
| 33 | Responses | GET | `/api/responses/responses/test/:testId` | All responses for a test | JWT (any role, SEC-C3) | None | Partial (critical) | Drift | `response.routes.ts:162`, `response.service.ts:448-487` |
| 34 | Responses | DELETE | `/api/responses/responses/:id` | Soft delete a response | JWT (any role, SEC-C3) | None | Partial (critical) | Drift (`/api/v1/responses/{id}`) | `response.routes.ts:191`, `response.service.ts:512-541` |
| 35 | Reports | GET | `/api/reports` | List tests with report metadata (not reports) | JWT+ADMIN | None | Partial | Accurate path (`/api/reports`) | `report.routes.ts:38-41`, `report.service.ts:142-163` |
| 36 | Reports | GET | `/api/reports/reports/student/:studentId/test/:testId` | **Intended:** student report. **Actual:** test report handler, ignores `studentId` | JWT+ADMIN | None | Partial (wrong handler, route mis-wired) | Drift (`/api/v1/reports/student/...`) | `report.routes.ts:92-95`, `report.controller.ts:37-53` |
| 37 | Reports | GET | `/api/reports/reports/test/:testId` | Per-test score report, all invited students | JWT+ADMIN | None (SEC-H1) | Partial | Drift (`/api/v1/reports/test/{testId}`) | `report.routes.ts:139-142`, `report.service.ts:101-140` |
| 38 | Platform | GET | `/api/health` | Liveness | Public | n/a | Implemented as liveness only (no DB/Redis check, SEC-L4) | Not documented | `routes/index.ts:242` |

**Public, outside the list:** Swagger UI at `/api-docs` (`app.ts:43`).

**Totals:** 38 endpoints. Auth: 35 JWT-protected, 3 public. Role checks: 15 routes use `authorizeRoles('ADMIN')` at the route; 3 more check role in the service (tests create, publish, delete); 1 checks in the controller (`GET /api/auth/users`). Implemented: 6 (rows 9, 21, 22, 27, 29, 38), but row 38 is liveness only. Partial: 32. Missing: see section 3.

---

## 2. Summary by Status

| Status | Count | Rows |
|---|---|---|
| Implemented (code path present, correctly guarded) | 5 | 9, 21, 22, 27, 29 |
| Implemented (liveness only) | 1 | 38 |
| Partially implemented | 32 | all others |
| Missing planned APIs | see section 3 | |

No endpoint is "fully implemented" once its tenant and role defects are counted.

---

## 3. Missing APIs (planned, not present)

Grouped by module. "Planned" means required by the PRD, epics, or the README's module list. NEEDS BUSINESS CONFIRMATION where noted.

**Auth**
- `POST /api/auth/logout`, `POST /api/auth/refresh`: refresh-token rotation (PRD FR-5.1).
- `POST /api/auth/forgot-password`, `POST /api/auth/reset-password` (PRD FR-3.2). NEEDS BUSINESS CONFIRMATION: email delivery is required for these.
- `PATCH /api/auth/users/:id/status` or `DELETE /api/auth/users/:id`: deactivate a user. `auth.service.ts:146-163` has `deleteUser` with no route.
- `POST /api/auth/change-password`.

**Institutes**
- `PATCH /api/institutes/:id/status` (activate and deactivate).
- Institute settings or branding (PRD FR-3.3, FR-16). NEEDS BUSINESS CONFIRMATION.

**Tests**
- `PUT` or `PATCH /api/tests/:id`: edit metadata (title, description).
- Archive or unarchive (PRD FR-1.1).
- Schedule and availability window, duration (PRD FR-1.1, FR-1.4). NEEDS BUSINESS CONFIRMATION.
- Duplicate or template from an existing test (PRD FR-1.1, epics FR5).

**Dimensions and questions**
- `PATCH /api/dimensions/:id`, `PATCH /api/questions/:id`: update.
- Reorder endpoints (question order and dimension order).
- Question bank endpoints: list reusable questions, attach a question to several dimensions (PRD FR-1.2).
- Question types beyond the 1-5 scale (PRD FR-1.2). NEEDS BUSINESS CONFIRMATION.

**Students**
- `PATCH /api/students/:id`: update profile.
- `PATCH /api/students/:id/status`: activate and deactivate.
- `GET /api/students/:id`: single student (only list exists).
- CSV upload endpoint with a file (PRD FR-3.2). Current bulk upload takes JSON only.

**Invites**
- `POST /api/invites/:id/resend` and email delivery (PRD FR-3.2, epics Story 1.2). NEEDS BUSINESS CONFIRMATION: email provider.
- `POST /api/invites/:id/cancel`. Partly covered by `DELETE /api/invites/:id`.
- Start or accept endpoint: `GET /api/invites/token/:token` to validate a token and return the test before answering. Not present.

**Responses (assessment session)**
- Start session, save progress, resume, autosave, time remaining, complete (PRD FR-1.4). None exist. Completion is only implicit in submit.
- `GET /api/responses/my` for a student's own responses (ownership-checked).

**Reports**
- `GET /api/reports/reports/student/:studentId/test/:testId`: exists, but the handler is wrong (row 36). Needs a real student-report handler.
- Institute-level report and dashboard (PRD FR-2.2, FR-8). NEEDS BUSINESS CONFIRMATION.
- Export: PDF and Excel/CSV (PRD FR-2.1, FR-11). NEEDS BUSINESS CONFIRMATION whether MVP.
- Report history and snapshots.
- Comparative and percentile analytics (PRD FR-2.2). Post-MVP.

**Platform**
- Audit log read endpoint (PRD FR-3.1, epics Story 1.4).
- Role and permission management endpoints (PRD FR-3.1). Depends on the RBAC decision.
- Institute-level user management (create and list ADMINs for an institute).
- Readiness probe that checks PostgreSQL and Redis.

---

## 4. Authentication and Authorization Status

| Area | Status | Notes |
|---|---|---|
| Token required on protected routes | Implemented | `authenticateJWT` applied on all 35 protected routes |
| Token verification with configured secret | **Broken unless `JWT_SECRET` is in the process environment** (SEC-C6, verified in-process) | Fallback secrets differ between sign and verify |
| Role enforcement | Partial | `authorizeRoles('ADMIN')` on 15 routes; 3 more check in the service; 1 in the controller; the rest of the protected routes have no role check (see list below) |
| Institute (tenant) enforcement | Partial | Enforced on students, invites-by-test, invite delete, test create. Missing on tests publish and delete (body), dimensions, questions, institutes, responses, reports, users, tests list, dimensions and questions reads |
| Ownership checks (student sees only own data) | **Missing** | No student-scoped endpoint enforces ownership |
| Account status at login | **Missing** | No `isActive` or institute `isActive` check |
| Token revocation | **Missing** | No session or revocation store |

**Protected routes with no route-level role check, which should have one** (recommendation):
- Rows 4-8 (institutes): any role should not be able to manage institutes. Need a platform-admin role (see RBAC decision).
- Rows 10-12 (tests list, publish, delete): role is checked only inside the service for publish and delete. Move the check to the route.
- Rows 13-14, 17-18 (dimension and question reads): students should read only what the take-test flow needs.
- Row 28 (student invites): should be the student themself or an ADMIN of the same institute.
- Rows 30-34 (responses): ADMIN for list and delete, student for own submit and own reads.
- Row 37 already has ADMIN, but needs a tenant check.

---

## 5. Swagger Documentation Status

| Module | Accuracy | Detail |
|---|---|---|
| Auth | **Accurate** | Paths match, tags and schemas present |
| Institutes | Generic template | `/api/v1/` and "Create resource (/)" placeholders, five paths, no real schemas |
| Tests | Partial drift | `/api/tests` correct, `/api/v1/{id}/publish` and `/api/v1/{id}` wrong |
| Dimensions | Drift and duplicated | Each path documented twice, once as `/api/...` and once as `/api/v1/...` |
| Questions | Drift | Paths under `/api/v1/dimensions/...` and `/api/v1/questions/...` |
| Students | Partial drift | `/api/students` and `/api/students/AddStudent` correct, `/api/v1/bulk-upload` and `/api/v1/{id}` wrong |
| Invites | Drift | Documented as `/api/v1/tests/...`, actual mount is `/api/invites/tests/...` |
| Responses | Drift | Documented as `/api/v1/responses/...`, actual is `/api/responses/responses/...` |
| Reports | Drift | Documented as `/api/v1/reports/...`, actual is `/api/reports/reports/...`. Student-report doc describes behaviour the code does not have. |
| Platform | Not documented | `/api/health` has no Swagger block |

**Conclusion:** Swagger does not accurately describe the implementation. Only Auth is correct. Regenerating from routes or fixing the paths is a P1 task. Do not use Swagger as evidence of implementation.

**Naming issue to resolve first:** the README promises `/api/v1/*`, Swagger documents `/api/v1/*` in most places, and the code mounts `/api/*`. Decide which one is canonical before fixing Swagger. This is a decision, not a bug fix. Recommendation: adopt `/api/v1` (a single version prefix in `routes/index.ts`), keep the doubled segments removed, and document the change in the README.
