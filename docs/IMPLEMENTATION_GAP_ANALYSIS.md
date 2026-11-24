# Implementation Gap Analysis: Psychometric Platform Backend

**Audit date:** 2026-11-24
**Written for:** the product owner, tech lead and backend team. Items marked **NEEDS BUSINESS CONFIRMATION** must not be built until someone with product authority decides them.
**Companion documents:** `IMPLEMENTATION_AUDIT.md` (evidence), `API_IMPLEMENTATION_MATRIX.md` (endpoints), `FUTURE_IMPLEMENTATION_CHECKLIST.md` (tasks), `DEVELOPMENT_ROADMAP.md` (phases).

---

## 1. Sources Reviewed

| Source | Used for | Depth |
|---|---|---|
| `_bmad-output/planning-artifacts/prd.md` | Intended scope, personas, FR-1 to FR-5, NFR | Read: personas, FR-1 to FR-5, FR list |
| `_bmad-output/planning-artifacts/epics.md` | FR1 to FR43 inventory, NFR1 to NFR21, story list | Read: inventory, story titles, status |
| `_bmad-output/planning-artifacts/architecture.md` | Bounded contexts, multi-tenant strategy, testing layers | Read: bounded contexts, multi-tenant security, testing layers. Not read: DevOps, AWS, AI governance sections |
| `README.md` | Modules, API versioning, auth, Redis claims | Read in full (relevant sections) |
| `_bmad-output/backend-audit-report.md` | Prior audit (65%) | Read: summary and section 10 |
| `_bmad-output/rbac-security-analysis.md`, `api-response-standardization-guide.md`, `controller-migration-summary*.md` | Prior RBAC and response decisions | **Not read in this audit.** Should be checked before RBAC work starts. |
| `docs/` (agents, architecture, prompts, project-context) | Team conventions | Headings and sizes only. `docs/context/project-context.md` is **empty (0 bytes)**. |

---

## 2. Original Planned Scope

### 2.1 Product direction (as written in the planning artifacts)

The PRD and architecture describe a **multi-tenant recruiting and assessment SaaS**. The primary persona is "HR Managers / Talent Acquisition Teams". Main capabilities:

- Assessment creation with adaptive logic, versioning, randomization, timers and templates (FR1, FR-1.1 to FR-1.4).
- Reports with AI interpretation, candidate analytics, PDF and CSV export, dashboards (FR6 to FR11, FR-2.1 to FR-2.2).
- Multi-tenant isolation, a 7-role RBAC hierarchy, audit logging and organization settings (FR12 to FR17, FR-3.1 to FR-3.3).
- ATS and HRMS integrations, public API, webhooks (FR26 to FR30, FR-4.x).
- Coding assessments, proctoring, real-time monitoring, AI features (FR22 to FR25, FR31 to FR43).
- Non-functional: performance, scalability, reliability, security, maintainability, usability (NFR1 to NFR21).

### 2.2 User roles (planned)

| Source | Roles |
|---|---|
| PRD FR-3.1 | Super Admin, Organization Admin, HR Manager, Recruiter, Evaluator, Candidate, Observer (7) |
| Epics FR13 | Same 7 roles |
| Code (`schema.prisma:168-171`) | `ADMIN`, `STUDENT` (2) |
| README and this brief | Institute admin and student |

### 2.3 Entities (planned, architecture bounded contexts)

Seven bounded contexts (`architecture.md:80-165`): Identity and Access, Assessment Engine, Psychometric Intelligence, Reporting and Insights, Organization and Tenant Management, Notification and Communication, Integration Ecosystem.

Architecture expects row-level tenant policies, per-tenant audit logging and per-tenant export and deletion (`architecture.md:437-451`).

---

## 3. Current Implemented Scope

Functional capabilities that exist in code with a working happy path:

- Institute-admin self-registration (creates institute and ADMIN in one transaction).
- Login with bcrypt verification and JWT issue.
- Institute create, list (search and paginate), get, update name, soft delete.
- Test create (DRAFT), list (global, basic), publish (DRAFT to PUBLISHED), soft delete.
- Dimension create, list per test (Redis cache), soft delete (cascades to questions).
- Question create (scale), list per dimension, soft delete (cascades to responses).
- Student create (validated), list with search (tenant-scoped), bulk create (JSON), soft delete.
- Invite students to a test with generated tokens; list invites per test; list per student; soft delete.
- Submit responses using an invite token (transactional, marks invite COMPLETED).
- Per-student per-dimension average score; per-test aggregate.
- Redis: read-through cache for dimensions, global and auth rate limiting, non-fatal connection.
- Graceful shutdown; Swagger UI; health endpoint.

Quality attributes present: 106 unit tests passing, strict TypeScript that compiles, validated Prisma schema, audit fields on all 8 models.

---

## 4. Partially Implemented Features

| Feature | What exists | What is missing or wrong |
|---|---|---|
| RBAC | Two roles, `authorizeRoles` on 15 routes | 7-role model absent. Many routes lack role or tenant checks (SEC-C1 to C5). |
| Multi-tenant isolation | Tenant id on all tenant tables; enforced on students, invites-by-test, test create | Not enforced on publish, delete, dimensions, questions, institutes, responses, reports, tests list, users list. No row-level policy. |
| Audit fields | `createdBy`, `createdAt`, `updatedBy`, `updatedAt`, `isActive` on all models | No audit log table. Fields are not FK-checked. Fallback value `'system'` is written in places. No per-tenant audit log (architecture requires it). |
| Soft delete | `isActive` flag on all models, cascade helper | Cascade lookups are wrong for three parents (DB-01). Some reads do not filter `isActive` (report dimensions and questions). `performSoftDelete` is unused. No restore. |
| Invitations | Token generation, unique token, status, duplicate skip per test | Re-invite after deletion fails (DB-02). No expiry (field exists, unused). No email. No resend or cancel distinct from delete. |
| Assessment submission | Transactional, token-bound, range check, completion | No test binding for questions, no duplicate protection, no integer check, no caller-to-student binding (SEC-C4, SEC-H6). |
| Reports | Student and test score averages | Student report route wired to test handler. Unweighted mean. Includes soft-deleted content. No interpretation, export, history, institute level. N+1 queries. |
| Login and JWT | Credential check, JWT with role and institute claims | Secret not loaded at runtime; fallback secrets (SEC-C6). Deactivated users can log in (SEC-H5). 1-day token life with no revocation (SEC-M1). |
| Rate limiting | IP-based global and auth limits | Fail-open without Redis. Per-user key never active (SEC-M3, SEC-M4). |
| Validation | express-validator on one route | Other routes rely on manual checks. No schema validation on bulk upload, answers or ids. |
| Swagger | UI served, Auth accurate | Other modules drift from real paths. Generic templates for institutes (see API matrix section 5). |
| Caching | Dimension list read-through cache | Not used for reports, which are the expensive path. `cacheDeleteByPattern` unused. |
| Pagination | Validated in controllers | Service limits uncapped on most `getAll*` functions. |

---

## 5. Missing Features

Grouped by the planned domain. Priority in this table is a *gap* rating for this audit. The roadmap assigns phases.

### 5.1 Core to the existing nine modules (MVP candidates)

| Gap | Planned source | Rating |
|---|---|---|
| Assessment session: start, save progress, resume, autosave, complete | PRD FR-1.4, epics FR4, architecture "Assessment Engine" | Missing, high |
| Time limit and countdown (server-side) | epics FR4, PRD FR-1.4 | Missing, high |
| Invitation expiry check at start and submit | epics Story 1.2, `expiresAt` in schema | Missing, high |
| Invitation delivery by email, resend | PRD FR-3.2, epics Story 1.2 | Missing, high. NEEDS BUSINESS CONFIRMATION: email provider and whether invites are sent or copied. |
| Test edit (title, description, duration, instructions) | PRD FR-1.1 | Missing, medium |
| Test archive and deprecate | PRD FR-1.1 | Missing, medium |
| Test versioning (publishing a new version without breaking results) | epics FR2, PRD FR-1.1 | Missing, medium. NEEDS BUSINESS CONFIRMATION: whether results must be tied to a version. |
| Question types beyond 1-5 scale (MCQ, true/false, open) | PRD FR-1.2 | Missing. NEEDS BUSINESS CONFIRMATION: which types the psychometric instruments need. |
| Question bank reuse across dimensions and tests | PRD FR-1.2 | Missing |
| Question ordering and randomization | epics FR3, PRD FR-1.4 | Missing |
| Student profile update, activation and deactivation | PRD FR-3.2 | Missing |
| Student CSV import with validation and report of skipped rows | PRD FR-3.2 | Partial (JSON only, no report) |
| Scoring with weights, reverse-scored items, normalisation | Architecture "Assessment Engine", PRD FR-2.1 | Missing. NEEDS BUSINESS CONFIRMATION: which scoring methods the instruments use. |
| Student report that is actually per student | PRD FR-2.1 | Defective (route wired to test handler) |
| Institute activation and deactivation | Architecture "Organization & Tenant Management" | Missing |
| Audit log of sensitive actions | PRD FR-3.1, FR-5.3, epics Story 1.4 | Missing |
| Password reset, change password | PRD FR-3.2, FR-5.1 | Missing. Needs email. |
| Refresh tokens, logout, session revocation | PRD FR-5.1, epics Story 1.6 | Missing |
| Account status enforcement | PRD FR-3.2 (active, inactive, suspended) | Missing |
| Data export and deletion per candidate | PRD FR-5.3 (GDPR) | Missing. NEEDS BUSINESS CONFIRMATION: which jurisdictions apply. |
| Consent capture | PRD FR-5.3, Student Experience | Missing. NEEDS BUSINESS CONFIRMATION. |

### 5.2 Planned but out of the current nine modules

| Gap | Planned source | Rating |
|---|---|---|
| Seven-role RBAC with permission matrix | PRD FR-3.1, epics FR13-14 | Missing. NEEDS BUSINESS CONFIRMATION: keep 2 roles or adopt 7. |
| Organization settings and branding | PRD FR-3.3, FR16 | Missing |
| Subscription tiers, usage limits, licences | PRD FR-3.3, architecture | Missing. NEEDS BUSINESS CONFIRMATION: is billing in scope. |
| PDF and Excel/CSV export | PRD FR-2.1, FR-11, FR9 | Missing. NEEDS BUSINESS CONFIRMATION: MVP or later. |
| Notifications (email, in-app, reminders) | Architecture "Notification", FR28 | Missing |
| Background jobs and queue | Architecture "Messaging", "Heavy operations must be async" | Missing. Needed for PDF and bulk email. |
| File storage (uploads, reports) | Architecture "File Storage", PRD | Missing |
| Public REST API with API keys and rate limits, webhooks | FR29, FR30, PRD FR-4.1-4.2 | Missing. NEEDS BUSINESS CONFIRMATION: Phase 2 or MVP. |
| ATS and HRMS integrations | FR26, FR27, PRD FR-4.3 | Missing. NEEDS BUSINESS CONFIRMATION: whether these are real requirements for this product. |
| AI interpretation, question generation, recommendations, predictive analytics | FR6, FR22-25, PRD FR-2.1 | Missing. Phase 2 or 3 per PRD roadmap. |
| Coding assessments and auto-evaluation | FR31-34 | Missing. Phase 2 per PRD. |
| Proctoring, live monitoring, webcam, behavioural biometrics | FR35-40 | Missing. Phase 2-3 per PRD. High risk for privacy. NEEDS BUSINESS CONFIRMATION. |
| Multilingual support, accessibility | Phase 2-3 per PRD | Missing |
| Monitoring, error tracking, centralized logs, health checks with dependencies | Architecture "DevOps & Observability", NFR | Missing (basic `console` logs only) |
| CI/CD, container image, deployment | Architecture "DevOps", NFR | Missing (no workflow, no Dockerfile) |
| Backups and restore procedure | NFR3, architecture | Missing |
| Connection pooling configuration | FR21 | Missing (Prisma defaults) |
| Caching of reports and dashboards | FR20 | Missing |

---

## 6. Technical Debt

| Debt item | Evidence | Impact |
|---|---|---|
| Authorization applied per route in an inconsistent way; no central policy | Section 4 of the audit, API matrix section 4 | Root cause of most CRITICAL findings |
| Soft-delete helper keyed by child model only | `softDelete.ts:29-37` | Silent data inconsistency on delete |
| Errors signalled by message string | `test.controller.ts:152-166`, `institute.controller.ts:317-355` | Refactors break HTTP status mapping silently |
| Business rules in controllers | `test.controller.ts:25-45` | Hard to test and reuse |
| Three response envelope shapes | `response-helpers.ts`, `error.middleware.ts:40-43`, `auth.middleware.ts:25` | Clients cannot rely on one shape |
| `any` on request user | 73 occurrences; `(req as any).user` | Typos in claim names compile |
| Config not centralized or validated | `config/index.ts` unused | Env misconfiguration is silent |
| Duplicated pagination and `getAll*` services | About nine services | Every fix is repeated nine times |
| Dead code | `scoring.ts`, `performSoftDelete`, `deleteUser`, `getInstituteTests`, `cacheDeleteByPattern` | Misleading; some look like features |
| Unused dependencies | `uuid`, `pg` in `package.json` | Supply-chain surface with no benefit |
| Two bcrypt libraries | `bcrypt` (seed only), `bcryptjs` (app) | Two code paths for one job |
| Swagger maintained by hand and drifted | API matrix section 5 | Documentation is wrong |
| Prisma config in `package.json` | Deprecated warning from `prisma validate` | Will break on Prisma 7 |
| Naming inconsistency | `/AddStudent`, `/bulk-upload`, mixed file-name styles | Client confusion |
| Duplicate route wiring | `report.routes.ts:92` | Wrong handler |
| Migration that cannot apply to non-empty data | `20260314095101` (`updatedAt NOT NULL`, no default) | Migration failure on any non-empty database |

---

## 7. Business Logic Gaps

| Gap | Detail | Evidence |
|---|---|---|
| Student identity in submission | Submission trusts a `studentId` in the body and a token. Caller is not checked against the student. | `response.service.ts:321-349` |
| Test binding of answers | Answers to questions of other tests are accepted. | `response.service.ts:353-370` |
| Completeness | A student can submit a subset. Whether partial completion is allowed is not defined. NEEDS BUSINESS CONFIRMATION. | `response.service.ts:387-396` |
| Single submission guarantee | Enforced by invite status inside a transaction, but two concurrent submits can both pass. | `response.service.ts:331-346` |
| Published test lock | Dimensions and questions can change after PUBLISHED, which changes scores of completed tests. | `dimension.service.ts:19-49`, `question.service.ts:132-165` |
| Invite on DRAFT test | Invites can be created for tests that are not published. Business rule unclear. NEEDS BUSINESS CONFIRMATION. | `invite.service.ts:26-137` |
| Invite expiry | Not defined in code. Expiry window and behaviour after expiry need a decision. NEEDS BUSINESS CONFIRMATION. | `schema.prisma:132` (unused) |
| Re-invite policy | Whether a deleted invite can be reissued and whether a completed student can retake. NEEDS BUSINESS CONFIRMATION. | `schema.prisma:143` |
| Score definition | Mean of raw answers, unweighted, no reverse items. Whether a dimension score is a mean, sum or normalised score is undefined. NEEDS BUSINESS CONFIRMATION. | `report.service.ts:64-83` |
| Retake handling in report | Multiple responses for the same question are averaged. Undefined. | `report.service.ts:46-61` |
| Report visibility | Who may see a student's report (student, admin, both) and when. NEEDS BUSINESS CONFIRMATION. | `report.routes.ts` |
| Deactivation semantics | Effect of deactivating a user, institute or student on existing results. NEEDS BUSINESS CONFIRMATION. | `institute.service.ts:180-192` |
| Student identity uniqueness | Email unique per institute, or per test, or global. Current rule is per institute in code only. NEEDS BUSINESS CONFIRMATION. | `student.service.ts:322-332` |
| Self-service registration | Anyone can create an institute and an ADMIN account. NEEDS BUSINESS CONFIRMATION: invite-only or open signup. | `auth.routes.ts:119` |
| Answer scale | Default 1 to 5 when not supplied. Whether scales can differ per question. | `question.service.ts:134` |

---

## 8. Security Gaps

Summary only. Full evidence and IDs are in `IMPLEMENTATION_AUDIT.md`, section 8.

| Gap | Severity | Audit ID |
|---|---|---|
| Cross-tenant publish and delete of tests | CRITICAL | SEC-C1 |
| Institute endpoints open to all roles | CRITICAL | SEC-C2 |
| Response read and delete without authorization | CRITICAL | SEC-C3 |
| Invite tokens exposed across tenants; submit not bound to caller | CRITICAL | SEC-C4 |
| Cross-tenant dimension and question writes | CRITICAL | SEC-C5 |
| JWT secret fallback and missing runtime load | CRITICAL | SEC-C6 |
| Test report cross-tenant | HIGH | SEC-H1 |
| All users listed across tenants | HIGH | SEC-H2 |
| All tests listed across tenants | HIGH | SEC-H3 |
| Question bank readable by students | HIGH | SEC-H4 |
| Deactivated users can log in | HIGH | SEC-H5 |
| Submission integrity | HIGH | SEC-H6 |
| Token lifetime and no revocation | MEDIUM | SEC-M1 |
| Error detail leakage | MEDIUM | SEC-M2 |
| Fail-open rate limit | MEDIUM | SEC-M3 |
| Global limiter never per user | MEDIUM | SEC-M4 |
| Permissive CORS default | MEDIUM | SEC-M5 |
| No password policy or email verification | MEDIUM | SEC-M6, SEC-M7 |
| Default seed admin | MEDIUM | SEC-M8 |
| Missing input validation and bulk size limit | MEDIUM | SEC-M9 |
| Short local JWT secret | MEDIUM | SEC-M10 |
| PII in logs; public Swagger; no security headers; health without dependencies | LOW | SEC-L1 to L4 |

Planned security requirements not yet started: MFA (PRD FR-5.1), field-level encryption (FR-5.2), encryption at rest, PII masking in logs (FR-5.2), device tracking (FR-5.1), row-level database policies (architecture), per-tenant audit log (architecture).

---

## 9. Database Gaps

| Gap | Detail | Severity |
|---|---|---|
| Soft-delete cascade mapping | Wrong lookup for student, testInvite and psychometricTest children depending on parent | HIGH |
| Invite unique constraint includes inactive rows | Blocks re-invite after deletion | HIGH |
| Response has no `(studentId, questionId)` uniqueness | Duplicate answers | HIGH |
| Response has no test-binding rule | Answers to other tests' questions | HIGH |
| Student has no `(instituteId, email)` uniqueness | Duplicates under concurrency | MEDIUM |
| No row lock on invite status during submit | Race | MEDIUM |
| `TestInvite.expiresAt` unused | Expiry not enforced | MEDIUM |
| Published test content can change | Integrity of scores | MEDIUM |
| Dimension `description` accepted, not stored | Silent data loss | LOW |
| Institute email not unique | Duplicate-email branch unreachable | LOW |
| Migration `20260314095101` not safe on non-empty data | Migration failure | MEDIUM |
| Audit fields are unconstrained strings | No referential integrity for who did what | MEDIUM |
| Missing entities: audit log, session or refresh token, assessment session or attempt, scoring configuration, report snapshot, institute settings, question bank, notification log, permission model, subscription | Required by PRD and architecture | HIGH for session and audit, others per roadmap |
| No row-level security or tenant-scoped views | Architecture requires row-level policies | MEDIUM (app-level only today) |
| Migration status not verified | DB unreachable during audit | BLOCKED |

---

## 10. Testing Gaps

| Gap | Architecture target | Current |
|---|---|---|
| Unit coverage of critical business logic (service layer) | 70%+ (`architecture.md`, testing layers) | No service tests. Coverage not measured. |
| Utilities coverage | 50%+ | Three utility specs (cache, jwt, response helpers) |
| Integration tests with Supertest | Required layer | None |
| Database integration with real schema | Required layer (implied) | None |
| Authorization and tenant-isolation tests | PRD FR-5, architecture multi-tenant security | None. Current suite would not catch any CRITICAL finding. |
| Contract tests against Swagger | Implied | None. Swagger drifts. |
| Test fixtures and data factories | Implied | None (inline mocks) |
| End-to-end flow test (admin to report) | Implied | None |
| Load and performance tests | NFR1 to NFR5 | None |
| Migration test (apply on empty and seeded database) | Implied | None |

Existing tests are useful for response shape and validation logic. They should not be counted as evidence of security or of workflow correctness.

---

## 11. Documentation Gaps and Conflicts

### 11.1 Conflicts that need a decision

| # | Conflict | Sources | Decision needed |
|---|---|---|---|
| D1 | **Product scope**: recruiting SaaS with 7 roles and ATS integrations, vs. institute and student psychometric platform with 2 roles | PRD and epics vs. README, master brief, code | Which product is being built. This affects every later phase. NEEDS BUSINESS CONFIRMATION. |
| D2 | **API version prefix**: `/api/v1/*` vs `/api/*` | README "API Versioning", Swagger (most paths) vs `routes/index.ts:231-239` | Choose the canonical prefix. Recommendation: `/api/v1`. |
| D3 | **Epic numbering**: "Epic 1" is "Enhanced Assessment Engine" in the epic list, but the detail section starts with "EPIC 1: Foundation - Multi-Tenant Platform & User Management" | `epics.md:179` vs `epics.md:193` | Renumber the epics. |
| D4 | **Story count**: "All 31 Stories Created" and "Requirements Coverage 100%" | `epics.md` status section vs six story headings (1.1 to 1.6) in the file | Locate the other stories or correct the claim. |
| D5 | **Prior audit is out of date**: "no test coverage", "Redis integration missing", "rate limiting missing" | `_bmad-output/backend-audit-report.md` sections 10 and 11 vs current code | Mark the prior audit superseded by this one. |
| D6 | **Completion estimate**: 65% (prior audit) vs about 49% (this audit) | Different method. Prior method counted presence, this one weights workflow and defects. | Adopt one method for future reporting. |
| D7 | **Token lifetime**: 1 hour in `config/index.ts` vs 1 day in `utils/jwt.ts` | Code | Pick one and load it from one place. |
| D8 | **Redis use cases**: README lists OTP, password reset, sessions, locks, job coordination | README vs code | Mark as planned, not current. |
| D9 | **Audit fields**: PRD requires audit logging of all critical actions; code has audit columns only | PRD FR-3.1, FR-5.3 vs schema | Decide the audit-log design (see roadmap Phase 1). |
| D10 | **Required test coverage**: architecture 70% critical logic, no measurement | `architecture.md` | Set the CI gate. |
| D11 | **Stale context file**: `docs/context/project-context.md` is empty | Repo | Populate or delete. |

### 11.2 Documentation that is accurate

- `README.md` setup steps (Docker, env, migrate, start) match `compose.yaml` and `package.json` scripts.
- `scripts/ensure-env.js` behaviour matches its own comments (creates `.env`, never overwrites).
- The Swagger Auth block is accurate.

---

## 12. NEEDS BUSINESS CONFIRMATION: Consolidated List

Do not implement these until answered.

1. Is the product a recruiting SaaS (PRD) or an institute and student psychometric platform (code and brief)?
2. Do we keep 2 roles (`ADMIN`, `STUDENT`) or adopt the 7-role model?
3. Is public self-service signup (create institute and admin) intended, or invite-only?
4. Should invitations be sent by email? Which provider? Are reminders needed in MVP?
5. What is the invite expiry window, and what happens when an invite expires?
6. Can a deleted invite be reissued? Can a student retake a test?
7. Can a student submit a partial set of answers?
8. Must results be tied to a test version? Is versioning in MVP?
9. Which question types are needed (scale only, or MCQ, true/false, open, coding)?
10. Which scoring methods are needed (mean, weighted, reverse items, normative, percentile)?
11. Who may view a student's report, and when (immediately, after deadline, after review)?
12. Are PDF and Excel exports required for MVP?
13. Is AI interpretation required for MVP? (PRD Phase 2 says yes; NFRs say AI governance applies.)
14. Are ATS and HRMS integrations real requirements for this product?
15. Is proctoring, webcam or activity monitoring in scope? (Privacy and legal risk.)
16. Which compliance regimes apply (GDPR, others)? What retention period applies to responses?
17. Is student consent capture required before an assessment starts?
18. Should a published test accept dimension or question changes? If not, when is a test locked?
19. What does deactivating an institute or student mean for existing results?
20. Should the Swagger UI be public in production?
21. Is billing, subscription or licensing needed for MVP?
22. Is the student email unique per institute, per test, or globally?
23. Can invites be sent for a test that is still DRAFT?
24. Can a student submit after the time limit, and is the server deadline or the client timer authoritative?
25. Must `Institute.email` be unique across institutes?

---

## 13. Percentage Estimate: Method and Result

**Scope counted:** the nine modules in the brief, as described in the README and the brief. Phase 2 and 3 PRD features, and the 7-role RBAC, are **excluded** pending item 2 above. If the 7-role RBAC and PRD Phase 1 features (FR-1.3 adaptive, FR-2.2 analytics, FR-3.3 organization settings) are in scope, the figure falls well below 50%.

**Scoring:** each capability is scored on the functional path only:
- 1 = works as described on the happy path, with no defect that changes the result.
- 0.5 = the happy path exists but a defect or a missing sub-behaviour is present.
- 0 = absent.

Security defects are not subtracted here, so the figure overstates a production-ready system. Treating the CRITICAL findings as incomplete would lower it further.

| Module | Capabilities counted | Max | Score | Notes |
|---|---|---|---|---|
| Auth | register 1, login and JWT 0.5, role access 0.5, account deactivation 0, refresh, logout, reset, MFA, lockout 0 | 5 | 2.0 | Login scored 0.5 because the secret is not loaded |
| Institutes | create 1, list and search 1, get 1, update 1, soft delete 0.5, activation 0, settings 0 | 7 | 4.5 | Delete cascade defective |
| Tests | create 1, list 0.5, publish 1, edit 0, delete 0.5, schedule, duration, availability, versioning, archive 0 | 6 | 3.0 | Filters unrouted |
| Dimensions | create 1, list 1, update 0, delete 1, weights, order, scoring config 0 | 5 | 3.0 | |
| Questions | create 1, list 1, update 0, delete 1, types, difficulty, ordering, bank, versioning 0 | 5 | 3.0 | |
| Students | create 1, list 1, bulk 0.5, update 0, activation 0, delete 0.5, history 0.5 | 7 | 3.0 | |
| Invitations | create with token 1, duplicate prevention 0.5, expiry 0, status 1, email 0, resend 0, cancel 0.5, start by token 0.5 | 8 | 3.5 | |
| Responses | submit 1, answer validation 0.5, save and resume 0, completion 1, timer 0, duplicate prevention 0.5, immutability 0.5, relationships 1 | 8 | 4.5 | |
| Reports | student report 0.5, test report 1, institute report 0, dimension scores 1, score calculation 0.5, interpretation 0, history 0, access control 0.5, export 0, performance 0 | 10 | 3.5 | |
| **Total** | | **61** | **30.0** | **49%** |

**Result:** about **49%** of the counted scope, range **44% to 54%** depending on how the half-point cases are judged. This is a functional estimate, not a quality score. The earlier 65% figure counted presence of CRUD routes and did not weight workflow completeness or defects.

---

## 14. Gap Summary Table

| Area | Gap count | Largest gap |
|---|---|---|
| Product scope | 1 conflict | Recruiting vs psychometric |
| Assessment engine | 7 missing | Sessions, timer, autosave, resume |
| Scoring and reporting | 6 missing or defective | Per-student report route, weights, export |
| Invitations | 5 missing or defective | Expiry, email, re-invite |
| Identity and access | 6 missing | Refresh, reset, account status, 7 roles |
| Security | 6 critical | Tenant isolation |
| Database | 4 HIGH | Cascade, invite uniqueness, response integrity |
| Testing | 8 missing layers | Integration and tenant tests |
| Infrastructure | 6 missing | CI, container, monitoring, backups |
| Documentation | 11 conflicts | API version prefix, scope |
