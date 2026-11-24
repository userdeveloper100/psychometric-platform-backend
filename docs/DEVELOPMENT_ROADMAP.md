# Development Roadmap: Psychometric Platform Backend

**Audit date:** 2026-11-24
**Written for:** the product owner, tech lead and backend team.
**Task IDs** (`SEC-01`, `DB-02`, and so on) refer to `FUTURE_IMPLEMENTATION_CHECKLIST.md`. **Decision IDs** (`DEC-01`, and so on) and question numbers (Q1 to Q25) refer to `IMPLEMENTATION_GAP_ANALYSIS.md` section 12.

**Complexity:** S = days, M = a few weeks, L = more than a month. These are relative sizes, not schedules. No calendar estimate is given because the team's capacity and the open decisions are unknown.

---

## 1. Principles for Sequencing

1. **Prove before fixing.** The test harness (`SEC-11`) is the first deliverable, so every security fix ships with a test that failed before it.
2. **Decisions gate phases.** Work that depends on an open decision is not started. The gating decisions are DEC-01 (scope and roles), DEC-03 (student identity), DEC-04 (API prefix).
3. **Security and integrity before features.** A new feature built on the current tenant checks inherits the defects.
4. **New migrations only.** Existing migrations are not edited. Data cleanup is scripted and reviewed before each migration that adds a constraint.
5. **Keep the modular monolith.** The architecture's Phase 1 is a monolith (`architecture.md`, "Recommended Near-Term Architecture"). Nothing in this roadmap splits services.

---

## 2. Scope Definitions

### 2.1 MVP (recommended, pending DEC-01 and DEC-02)

The smallest product that runs the full psychometric workflow safely for one institute:

- Two roles: `ADMIN` (per institute) and `STUDENT`, unless DEC-01 says otherwise.
- Institute self-service (per DEC-02) and admin management within the institute.
- Tests (create, edit while DRAFT, publish, archive), dimensions, scale questions.
- Students (create, bulk import with validation, activate and deactivate, delete).
- Invitations with expiry, a token start endpoint, and a single submission.
- Timed assessment sessions with autosave, resume and server-side deadline.
- Scoring: the scoring spec from Q10, applied consistently.
- Reports: per-student and per-test, scoped to the institute, with dimension scores.
- Security: tenant isolation, role enforcement, account status enforcement, no internal error leakage.
- Operations: CI, integration tests, accurate Swagger, documented environment, migrations verified on a clean database.

### 2.2 Post-MVP (Phase 5 and 6 items)

- Email delivery for invites, resends and reminders (needs Q4).
- Institute-level report and dashboards (needs Q11).
- CSV export, then PDF export through a job runner (needs Q12).
- Report snapshots and scoring versioning.
- Seven-role RBAC with a permission matrix, if DEC-01 confirms it.
- Password reset, refresh tokens and session revocation (PRD FR-5.1).
- Audit log (PRD FR-3.1, FR-5.3).
- Weighted and reverse-scored items; normative scoring.

### 2.3 Future enhancements (Phase 7, explicitly not scheduled)

- AI interpretation, question generation, recommendations, predictive analytics (PRD FR-2.1, FR22-25). Requires AI governance review (architecture "AI Governance Requirements").
- Coding assessments with an in-browser editor and auto-evaluation (FR31-34).
- Proctoring, activity monitoring, webcam analysis, behavioural biometrics (FR35-40). High privacy and legal risk. Requires a legal review before any design work.
- ATS and HRMS integrations, public API with API keys, webhooks (FR26-30).
- Multilingual support and an accessibility programme (Phase 2-3).
- Billing, subscriptions and licences (FR-3.3).
- Session recording (FR43).
- Dedicated databases for enterprise tenants (architecture "Future").

---

## 3. Phases

### Phase 0: Foundation and Test Safety

**Objectives:** be able to prove tenant and role behaviour; stop configuration from silently breaking auth; make CI real.

**Tasks:** `SEC-11`, `SEC-12` (matrix skeleton), `SEC-07`, `INF-03`, `INF-01`, `INF-02`, `DEC-01` to `DEC-04` (decisions requested here, not implemented), `DOC-01`, `DOC-02`.

**Dependencies:** Docker Desktop running for the test database. A decision owner for DEC-01 and DEC-03.

**Deliverables:**
- Integration harness against a disposable Postgres, with fixtures for two institutes and one ADMIN and one STUDENT each.
- Authorization matrix test skeleton for all 38 endpoints, with known-failing cases marked.
- Single configuration source; startup fails on a missing or short `JWT_SECRET`.
- CI pipeline running build, unit and integration tests.
- Written decisions DEC-01 to DEC-04 in `IMPLEMENTATION_GAP_ANALYSIS.md` section 12.

**Acceptance criteria:**
- `npm run test:integration` runs on a clean machine with Docker and passes its non-security smoke tests.
- Every CRITICAL finding in `IMPLEMENTATION_AUDIT.md` section 8.1 has a failing test that names it.
- Starting the server without `JWT_SECRET` exits with a clear message.
- The first login followed by a protected request succeeds using only `.env`.

**Complexity:** S to M.

**Completion condition:** all decisions DEC-01 to DEC-04 recorded; harness green on CI; the failing security tests exist.

---

### Phase 1: Security and Access Management

**Objectives:** tenant isolation, role enforcement and account status enforced everywhere; no cross-tenant read or write; no token exposure.

**Tasks:** `SEC-01`, `SEC-02`, `SEC-02b`, `SEC-03`, `SEC-04` (per DEC-03), `SEC-05`, `SEC-06`, `SEC-08`, `SEC-09`, `SEC-10`, `DB-01`, `DB-02`, `DB-03`, `AUTH-06`, `AUTH-02`, `ARC-01`, `INF-08`, `INF-09`, `INF-13`, `ARC-03`, `RPT-01`.

**Dependencies:**
- Phase 0 complete.
- DEC-01 (roles) before `SEC-02`, `SEC-03`, `SEC-09`.
- DEC-03 (student identity) before `SEC-04`.
- `DB-02` needs a duplicate check on existing data first.
- `ARC-01` (policy layer) follows the individual fixes, so the rules are known before they are centralised.

**Deliverables:**
- Every route in the matrix passes for all four actors.
- Migrations for the partial unique invite index and the response unique constraint, with a documented pre-check script.
- Error envelope unified; no internal message on 500.
- Seed refuses to run in production.

**Acceptance criteria:**
- Authorization matrix: 38 endpoints, all cells pass.
- A cross-tenant probe from every list and get endpoint returns 404 or an empty list.
- Deleting an invite and re-inviting the same student works; two active invites for one pair are rejected.
- Deactivating a user blocks login and the next request with their existing token.
- Security headers present; Swagger returns 404 in production.

**Complexity:** M. The largest risk is the number of call sites for `instituteId` that must be touched.

**Completion condition:** no CRITICAL or HIGH finding from `IMPLEMENTATION_AUDIT.md` section 8 is open without a recorded exception signed by the tech lead.

---

### Phase 2: Core Assessment Management

**Objectives:** complete the administrative side of the nine modules so an admin can build a test end to end.

**Tasks:** `INS-01`, `INS-02`, `TST-01`, `TST-02`, `TST-03`, `TST-04`, `TST-07`, `DQ-01`, `DQ-02`, `DQ-03`, `STU-01`, `STU-02`, `STU-03`, `STU-04`, `STU-05`, `STU-07`, `AUTH-01`, `AUTH-03`.

**Dependencies:**
- Phase 1 complete.
- Q18 (published test lock) decides `TST-03` and `DQ-01`.
- Q22 (student email uniqueness) decides `STU-05`.
- Q25 (institute email) decides `INS-02`.
- `AUTH-01` (refresh and logout) depends on Redis revocation design.

**Deliverables:**
- Test lifecycle: DRAFT (editable), PUBLISHED (locked per Q18), ARCHIVED.
- Student lifecycle: create, update, activate, deactivate, delete, bulk import with a per-row result report.
- Dimension and question update.
- Refresh token and logout.

**Acceptance criteria:**
- Publishing an empty test returns 422.
- Bulk import of 1,001 rows with a limit of 1,000 is refused; duplicates within a file are reported per row.
- Editing a PUBLISHED test returns 409 (if Q18 locks it).
- Logout invalidates the refresh token; reuse of a rotated refresh token revokes the family.

**Complexity:** M.

**Completion condition:** the admin workflow from create test to publish, with students imported, is covered by an integration test.

---

### Phase 3: Assessment Execution Engine

**Objectives:** a student can start, save, resume and finish an assessment within a time limit, and the server decides every rule.

**Tasks:** `INV-01`, `INV-02`, `INV-03`, `INV-04`, `RSP-01` to `RSP-08`, `RSP-10`, `TST-06`, `STU-02` (enforcement at submit).

**Dependencies:**
- Phase 2 complete (publish guard, student activation).
- Q5 and Q6 (expiry and re-invite) for `INV-01` and `INV-02`.
- Q7, Q8 and Q24 (completeness, versioning, deadline authority) for `RSP-05` and `RSP-06`.
- DEC-03 (student identity) for session ownership.
- DB-02 and DB-03 from Phase 1.

**Deliverables:**
- Session model (attempt) with deadline; start, autosave, resume and submit endpoints.
- Drafts stored on the session; `Response` rows written only on submit.
- Invite expiry enforced; token start endpoint.
- Single-submit guarantee under concurrency.

**Acceptance criteria:**
- A student who never submits produces no `Response` rows.
- Autosave after the deadline returns 410; submit after the deadline follows the decision in Q24.
- Two parallel submits produce one 2xx and one 409.
- Resume returns saved answers and the remaining seconds.
- Expired invite returns 410 on start.

**Complexity:** L. This phase introduces new state and the most new endpoints.

**Completion condition:** the full student journey (start, autosave, resume, submit) passes the integration suite, with a load of 50 concurrent sessions in a test environment.

---

### Phase 4: Psychometric Scoring

**Objectives:** scores are defined, implemented once, documented, and reproducible.

**Tasks:** `RPT-02`, `RPT-03`, `RPT-04`, `RPT-05`, `RPT-06`.

**Dependencies:**
- Q10 (scoring methods) is the gating decision. Without it only the existing mean can be implemented, and it must be labelled as provisional.
- Phase 3 complete, so scores come from completed sessions only.

**Deliverables:**
- One scoring module (`src/utils/scoring.ts` or its successor) used by reports.
- Scoring specification document with worked examples and expected numeric outputs.
- Test fixtures with known answers and expected scores.
- Report snapshot at completion, stamped with the scoring version (`RPT-06`).

**Acceptance criteria:**
- A fixture with known answers produces the documented scores to two decimal places.
- Soft-deleted dimensions and questions are excluded from scores.
- The number of database queries for a test report is constant as the number of students grows (tested with 200 students).
- Changing a question after completion does not change a stored snapshot.

**Complexity:** M, plus whatever the Q10 answer adds. If weighted, reverse-scored or normative scoring is confirmed, move `RPT-04` and `RPT-05` from P2 into this phase and re-estimate.

**Completion condition:** the scoring spec is signed off by whoever owns the instrument's psychometric validity. Without that sign-off the phase is incomplete, regardless of code.

---

### Phase 5: Reporting and Notifications

**Objectives:** admins get institute-level results and exports; invitations reach students.

**Tasks:** `RPT-07`, `RPT-08`, `RPT-09`, `RPT-10` (only if Q13 is yes), `RPT-11`, `INV-05`, `INV-06`, `INV-07`, `INF-12`, `DB-09`.

**Dependencies:**
- Phase 4 complete.
- Q4 (email provider), Q11 (who may see reports), Q12 (exports needed for MVP).
- INF-12 (job runner) before any PDF or bulk email.
- DB-09 (migration verification on a clean database) can run earlier, as soon as Docker is available.

**Deliverables:**
- Institute-level report and per-test summary.
- CSV export (streamed).
- Email outbox with retry, invite delivery and reminders.
- Background job runner with a dead-letter list.

**Acceptance criteria:**
- CSV export of 5,000 rows streams without buffering the full file in memory (checked by a memory-limit test).
- A failed email is retried and then moved to the dead-letter list; a successful retry does not send twice.
- Report cache is invalidated on a new submission.

**Complexity:** L.

**Completion condition:** invitations are delivered (or the copy-link flow is confirmed as the business choice) and an institute can export its results.

---

### Phase 6: Production Readiness

**Objectives:** deployable, observable, recoverable.

**Tasks:** `INF-04`, `INF-05`, `INF-06`, `INF-07`, `INF-10`, `INF-11`, `INF-14`, `INF-15`, `INF-16`, `INF-17`, `TST-UNIT-01`, `TST-UNIT-02`, `TST-E2E-01`, `TST-E2E-02`, `TST-E2E-03`, `ARC-02`, `ARC-04`, `ARC-05`, `ARC-06`, `DOC-03`, `DOC-04`, `STU-06`, `AUTH-04`, `AUTH-07`, `AUTH-08`, `AUTH-05`.

**Dependencies:**
- Phases 1 to 3 complete for the MVP items.
- DEC-04 (API prefix) before `INF-15` (Swagger).
- Decision on logging and error-tracking tools (`INF-07`).
- Backup target decided (`INF-16`).

**Deliverables:**
- Dockerfile and production compose.
- Structured logs with request ids; readiness and liveness probes.
- Swagger generated from routes and verified by test.
- Coverage gate at 70% for service files.
- Backup and restore procedure with one tested restore.
- Lint and typecheck in CI.

**Acceptance criteria:**
- `docker compose` brings up app, Postgres and Redis; readiness returns 200 only when both respond.
- Every route in the Express router is documented in Swagger, and every documented path exists (test).
- A restore from backup into a clean database passes the integration suite.
- No dependency is listed that is not imported.

**Complexity:** M.

**Completion condition:** the MVP runbook exists; a restore drill has been performed and recorded.

---

### Phase 7: Advanced Capabilities

Not scheduled. Start only after the MVP is accepted and the owner confirms scope. Each item needs its own discovery, privacy review (for proctoring and biometrics) and governance review (for AI).

| Capability | Complexity | Gate |
|---|---|---|
| AI-assisted interpretation and question generation | L | AI governance review; Q13 |
| Recommendation engine and predictive analytics | L | Data volume; ethics review |
| Coding assessments and auto-evaluation | L | Q9 (question types); sandboxing design |
| ATS and HRMS integrations, public API, webhooks | L | Q14; API key design; webhook signing |
| Proctoring, live monitoring, webcam, biometrics | L | Legal review; consent design (Q15, Q17) |
| Multilingual and accessibility | M | Locale decision |
| Dedicated tenant databases | L | Enterprise customer demand |
| Billing and licensing | L | Q21 |

---

## 4. Technical Dependency Map

| Dependency | Why it matters | Blocks |
|---|---|---|
| Test harness (`SEC-11`) | Proves every security fix | All Phase 1 fixes |
| Role model decision (DEC-01) | Defines the authorization rules | `SEC-02`, `SEC-03`, `SEC-09`, `AUTH-07`, `ARC-01` |
| Student identity decision (DEC-03) | Students have no login today | `SEC-04`, `RSP-01`, `RSP-09` |
| Invite partial unique index (`DB-02`) | Allows re-invite after delete | `INV-02` |
| Response uniqueness and test binding (`DB-03`) | Report correctness | Phase 4 scoring, `RSP-07` |
| Soft-delete cascade fix (`DB-01`) | Correct deletion across parents | Any "delete" flow in Phase 2 |
| Redis revocation design | Refresh tokens and logout | `AUTH-01` |
| Job runner (`INF-12`) | Email, PDF, bulk operations | `INV-05`, `RPT-09` |
| Email provider (Q4) | Invites and reminders | `INV-05`, `INV-06`, `AUTH-05` |
| Scoring specification (Q10) | Defines scores | `RPT-03` to `RPT-05` |
| API prefix (DEC-04) | Swagger and client contract | `INF-15`, `ARC-08` |
| Clean-database migration check (`DB-09`) | Confirms migrations apply | Any release |
| Docker availability | Test database and migration checks | `SEC-11`, `DB-09`, `TST-E2E-*` |

**Migration order (to avoid conflicts):**
1. Data check script for duplicate active invites and duplicate responses (no schema change).
2. Partial unique index on `TestInvite` (`DB-02`).
3. Unique `(studentId, questionId)` on Response (`DB-03`), after the check in step 1 is clean.
4. Unique `(instituteId, email)` on Student (`STU-05`), after a de-duplication script.
5. Session model (`RSP-01`).
6. Refresh token store, if DB-backed (`AUTH-01`).
7. Report snapshot (`RPT-06`).

---

## 5. Milestones

Each milestone is a checkpoint with explicit acceptance. Dates are intentionally not set.

| Milestone | Contents | Acceptance |
|---|---|---|
| **M0: Safe to test** | Phase 0 | Harness green in CI; every CRITICAL finding has a named failing test; decisions DEC-01 to DEC-04 recorded |
| **M1: Tenant-safe** | Phase 1 | Authorization matrix green for all 38 endpoints; no CRITICAL or HIGH open without signed exception; migrations applied on a clean database |
| **M2: Core workflow** | Phases 2 and 3 | End-to-end integration test passes (admin builds test, imports students, invites, student starts, autosaves, resumes, submits, admin reads report) |
| **M3: MVP ready** | Phase 4 (scoring spec signed), Phase 6 items required for release | Scoring fixtures pass; readiness probe; Swagger accurate; coverage gate met; restore drill recorded; runbook written |
| **M4: Post-MVP release** | Phase 5 | Invitations delivered (or copy-link decision recorded); institute export works; job runner has dead-letter handling |
| **M5: Phase 7 entry** | Owner confirms each Phase 7 item | Discovery, privacy and governance reviews complete for the item |

**Go or no-go for MVP (M3):**
- Go only when: zero open CRITICAL and zero open HIGH findings in `IMPLEMENTATION_AUDIT.md` section 8; the scoring specification is signed; the MVP scope in section 2.1 is accepted.
- No-go if any CRITICAL is open, or if the scope decision (DEC-01) is still open.

---

## 6. Risks to the Roadmap

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Scope decision (recruiting vs psychometric) changes after Phase 1 | Medium | High | Hold Phase 2 until DEC-01 is recorded; Phase 1 fixes apply to either scope |
| Student identity design (DEC-03) forces a schema change after Phase 3 starts | Medium | High | Decide before Phase 3; the design choice is in the checklist |
| Scoring specification not available | Medium | High | Phase 4 cannot be signed off; ship the existing mean as provisional and say so in the report |
| Existing data fails the new constraints | Low to medium | Medium | De-duplication scripts run in a dry-run mode first; reviewed before each migration |
| Auth and tenant changes break existing front-end clients | Medium | Medium | Versioned API (DEC-04) and a change log; the front end is not in this audit's scope |
| Docker not available on developer machines | Medium | Medium | CI provides the database; documented fallback for local runs |
| Scope creep into Phase 7 during Phases 2 to 4 | High | High | Section 2.3 is out of scope until M5 |
| Security findings reopen during later phases | Medium | High | Authorization matrix runs on every pull request |

---

## 7. Summary Table

| Phase | Name | Complexity | Gated by | Primary outcome |
|---|---|---|---|---|
| 0 | Foundation and test safety | S to M | DEC-01 to DEC-04 recorded | Provable tenant and role behaviour; CI |
| 1 | Security and access management | M | Phase 0; DEC-01, DEC-03 | No cross-tenant access; account status enforced |
| 2 | Core assessment management | M | Phase 1; Q18, Q22, Q25 | Complete admin workflow |
| 3 | Assessment execution engine | L | Phase 2; Q5 to Q8, Q24, DEC-03 | Start, autosave, resume, submit with a timer |
| 4 | Psychometric scoring | M (more if weighted) | Phase 3; Q10 | Reproducible, documented scores |
| 5 | Reporting and notifications | L | Phase 4; Q4, Q11, Q12 | Institute reports, exports, invitations by email |
| 6 | Production readiness | M | Phases 1 to 3 for MVP items | Deployable, observable, recoverable |
| 7 | Advanced capabilities | L each | Owner confirmation, privacy and governance reviews | Not scheduled |
