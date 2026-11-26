# Psychometric Platform Backend

Backend API for a SaaS **Psychometric Assessment Platform** built with **Node.js, Express.js, TypeScript, Prisma ORM, PostgreSQL, and Redis**.

The platform provides APIs for managing organizations, assessments, dimensions, questions, students, invitations, responses, reports, authentication, and related psychometric workflows.

---

## Tech Stack

- **Node.js**
- **Express.js**
- **TypeScript**
- **Prisma ORM**
- **PostgreSQL**
- **Redis**
- **JWT** authentication
- **bcrypt** password hashing
- **Swagger / OpenAPI** API documentation
- **Docker / Docker Compose** for local infrastructure

---

# Setup on a New Laptop

If you clone this project on another laptop, follow these steps.

## Prerequisites

Install:

- Git
- Node.js
- npm
- Docker Desktop
- WSL 2 (Windows)

Verify the installations:

```bash
git --version
node --version
npm --version
docker --version
docker compose version
```

For Windows + WSL:

```powershell
wsl --version
```

Make sure Docker Desktop is running and **WSL 2 integration** is enabled.

---

## Clone the Project

Clone the repository:

```bash
git clone <project-repository-url>
```

Go to the backend directory:

```bash
cd psychometric-platform-backend
```

---

## Getting Started / First-Time Setup

You do not need to create `.env` by hand. The first time you run `npm install`, `npm run dev`, or `npm start`, the project creates it for you:

1. `scripts/ensure-env.js` checks whether `.env` exists in the project root.
2. If it is missing, the script copies `.env.example` to `.env`. The template contains local development defaults and `CHANGE_ME` placeholders.
3. If `.env` already exists, it is **never overwritten**. Your values are kept on every run.
4. The script logs a message asking you to review `.env` and fill in the `CHANGE_ME` values. On every later run it also warns while any placeholder is still present.

Then fill in the required secrets:

```bash
# Generate a JWT secret (macOS / Linux / Git Bash / WSL)
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Paste the output into `JWT_SECRET` in `.env`.

### Overriding values locally

- **Edit `.env`.** It is git-ignored, so your local values stay on your machine.
- **Or set a shell variable for one session.** Values already set in the environment take precedence over `.env`, because `dotenv` does not overwrite existing variables. For example, in PowerShell: `$env:PORT = "5002"`.
- **Do not put real secrets in `.env.example`.** It is committed and must contain placeholders only.

`.env.local` and `.env.*.local` are git-ignored, but the app does **not** read them today. Use `.env` or shell variables.

---

## Environment Variables

All variables are read from `.env` (or the shell environment) when the server starts. The app loads them through `dotenv` in `src/config/index.ts`.

| Variable | Type | Required | Example / default | Description |
| --- | --- | --- | --- | --- |
| `PORT` | integer | Optional | `5001` (default in `src/server.ts`) | HTTP port for the API. |
| `DATABASE_URL` | string (PostgreSQL URL) | **Required** | `postgresql://psychometric:local_dev_password@localhost:5433/psychometric_db?schema=public` | Prisma connection string. Matches the Docker service in `compose.yaml`. |
| `JWT_SECRET` | string | **Required** | `CHANGE_ME` in the template | Secret used to sign and verify JWTs. Use a long random value. Never reuse it across environments. |
| `JWT_EXPIRES_IN` | string (duration) | Optional | `1d` (used by `src/utils/jwt.ts`) | JWT lifetime, for example `1h` or `1d`. |
| `NODE_ENV` | string | Optional | `development` | `development` includes extra error details in API responses. Use `production` in deployed environments. |
| `REDIS_URL` | string (Redis URL) | Optional | `redis://localhost:6379` | Redis connection. If Redis is unavailable, the app still starts and cache/rate-limit features become no-ops. |
| `CORS_ORIGINS` | string (comma-separated URLs) | Optional | `http://localhost:5173` | Allowed browser origins. If unset or `*`, every origin is allowed. Use an explicit list outside local development. |

> **Important:** `.env` holds environment-specific secrets and must never be committed to Git. When you set up a new laptop, copy the values by a secure channel (a password manager, for example), not through the repository.

### Untracking `.env` (one-time, for existing clones)

Git tracks `.env` in this repository, so `.gitignore` alone does not stop changes from being committed. Removing it from the index **does not delete your local file**:

```bash
git rm --cached .env
git add .gitignore .env.example scripts/ensure-env.js package.json README.md
git commit -m "Stop tracking .env and add .env.example template"
```

Git keeps `.env` in the commit history, so values committed earlier are still visible to anyone with access to the repository. If this repository has been pushed to a shared or public remote, **rotate the exposed values**: generate a new `JWT_SECRET` and change the database and Redis passwords. Removing the history requires rewriting it (for example with `git filter-repo`), which should be coordinated with everyone who has a clone.

---

## Start PostgreSQL and Redis

From the project root:

```bash
docker compose up -d
```

Check that both containers are running:

```bash
docker compose ps
```

Expected services:

```text
psychometric-postgres
psychometric-redis
```

---

## Install Node Dependencies

```bash
npm install
```

---

## Apply Database Migrations

On a new laptop, apply the existing Prisma migrations:

```bash
npx prisma migrate deploy
```

Generate the Prisma Client:

```bash
npx prisma generate
```

Verify the database:

```bash
npx prisma migrate status
```

Expected:

```text
Database schema is up to date!
```

---

## Start the Backend

```bash
npm run dev
```

The backend should start at:

```text
http://localhost:5001
```

Swagger:

```text
http://localhost:5001/api-docs
```

Health check:

```text
http://localhost:5001/health
```

---

## Quick Setup

For an already-configured development environment, the basic setup is:

```bash
git clone <project-repository-url>

cd psychometric-platform-backend

docker compose up -d

npm install

npx prisma migrate deploy

npx prisma generate

npm run dev
```

### Recommended First-Time Setup

```text
1. Install Git
2. Install Node.js + npm
3. Install Docker Desktop
4. Enable WSL 2 integration
5. Clone repository
6. Create/configure .env
7. Start Docker containers
8. Install npm dependencies
9. Apply Prisma migrations
10. Generate Prisma Client
11. Start backend
12. Open Swagger
```

---

## Troubleshooting New Laptop Setup

### Check Docker containers

```bash
docker compose ps
```

### Check PostgreSQL

```bash
docker exec psychometric-postgres pg_isready -U psychometric -d psychometric_db
```

Expected:

```text
/var/run/postgresql:5432 - accepting connections
```

### Check Redis

```bash
docker exec psychometric-redis redis-cli ping
```

Expected:

```text
PONG
```

### Check Prisma

```bash
npx prisma migrate status
```

### Reinstall dependencies

If `node_modules` has issues:

```bash
rm -rf node_modules
npm install
```

On Windows PowerShell:

```powershell
Remove-Item -Recurse -Force node_modules
npm install
```

### Stop Docker services

```bash
docker compose down
```

### Start Docker services again

```bash
docker compose up -d
```

> **Warning:** Avoid `docker compose down -v` unless you intentionally want to delete the local PostgreSQL and Redis volumes.

---

## Architecture

The backend currently follows a modular architecture using:

```text
Controller → Service → Prisma → PostgreSQL
                    │
                    └──────────→ Redis
```

### Application Flow

```text
Client
  │
  ▼
Express API
  │
  ├── Middleware
  │     ├── Authentication
  │     ├── Authorization
  │     ├── Validation
  │     └── Error Handling
  │
  ▼
Controller
  │
  ▼
Service
  │
  ├──────────────► Prisma ──────────► PostgreSQL
  │
  └──────────────► Redis
```

The application is designed as a **modular monolith** initially, with the architecture allowing future evolution toward event-driven services and microservices where required.

---

## Modules

The current backend includes the following functional modules:

- Auth
- Institutes
- Tests
- Dimensions
- Questions
- Students
- Invites
- Responses
- Reports

Additional modules and bounded contexts can be introduced as the platform evolves.

---

# Local Development Environment

The project uses **Docker Desktop with WSL 2** to run infrastructure services locally.

```text
Windows
│
├── Node.js / TypeScript
│      └── Express API :5001
│
└── Docker Desktop
       │
       ├── PostgreSQL
       │      └── localhost:5433
       │
       └── Redis
              └── localhost:6379
```

### Why Docker?

Docker provides a consistent local development environment without requiring PostgreSQL and Redis to be installed directly on Windows.

Docker Compose manages the infrastructure services:

```text
Docker Compose
│
├── PostgreSQL
└── Redis
```

---

# Database

The application uses **PostgreSQL with Prisma ORM**.

The current local Docker database configuration is:

```text
Database: psychometric_db
User:     psychometric
Host:     localhost
Port:     5433
```

---

# Prisma

## Generate Prisma Client

```bash
npx prisma generate
```

## Check migration status

```bash
npx prisma migrate status
```

## Apply existing migrations

For a new environment:

```bash
npx prisma migrate deploy
```

The project currently contains the following migrations:

```text
prisma/migrations/
├── 20260312163105_init
├── 20260314095101_add_audit_fields
├── 20260316063002_improve_relations
└── migration_lock.toml
```

## Create a new migration

When the Prisma schema changes during development:

```bash
npx prisma migrate dev --name <migration_name>
```

Example:

```bash
npx prisma migrate dev --name add_assessment_settings
```

> Do not use `prisma migrate reset` unless you intentionally want to delete and recreate the local database.

## Prisma Studio

```bash
npx prisma studio
```

---

# Docker Infrastructure

### Start infrastructure

```bash
docker compose up -d
```

### Check container status

```bash
docker compose ps
```

### Stop containers

```bash
docker compose down
```

### PostgreSQL

```text
localhost:5433
```

### Redis

```text
localhost:6379
```

---

# Running the Application

## Development

```bash
npm run dev
```

Expected startup:

```text
Redis connected
Server running on http://localhost:5001
Swagger docs at http://localhost:5001/api-docs
```

---

# Build

```bash
npm run build
```

---

# Production

```bash
npm start
```

---

# API Documentation

Swagger / OpenAPI:

```text
http://localhost:5001/api-docs
```

---

# API Versioning

Every module is served under `/api/v1/<resource>` (`DEC-04`). The unversioned `/api/...` paths are not served and return `404`. `GET /health` stays at the root, outside the API version.

| Module | Method | Path | Access |
|---|---|---|---|
| Auth | POST | `/api/v1/auth/register` | Disabled: always 403 (DEC-02) |
| Auth | POST | `/api/v1/auth/login` | Public (rate limited) |
| Auth | POST | `/api/v1/auth/accept-invite` | Public, invite token in the body, rate limited (DEC-02) |
| Auth | POST | `/api/v1/auth/invites` | ADMIN, own institute. Roles: ADMIN, RECRUITER, EVALUATOR, STUDENT. Never SUPER_ADMIN (DEC-01) |
| Auth | GET | `/api/v1/auth/invites` | ADMIN, own institute (DEC-02) |
| Auth | DELETE | `/api/v1/auth/invites/{id}` | ADMIN, own institute (DEC-02) |
| Auth | GET | `/api/v1/auth/users` | ADMIN, own institute |
| Institutes | POST | `/api/v1/institutes` | SUPER_ADMIN only. Optional `initialAdminEmail` (DEC-01) |
| Institutes | GET | `/api/v1/institutes` | ADMIN |
| Institutes | GET, PUT, DELETE | `/api/v1/institutes/{id}` | ADMIN, own institute only |
| Tests | POST | `/api/v1/tests` | ADMIN |
| Tests | GET | `/api/v1/tests` | ADMIN, RECRUITER, EVALUATOR (own institute) |
| Tests | PATCH | `/api/v1/tests/{id}/publish` | ADMIN |
| Tests | DELETE | `/api/v1/tests/{id}` | ADMIN |
| Dimensions | GET | `/api/v1/dimensions` | ADMIN, RECRUITER, EVALUATOR (own institute) |
| Dimensions | GET | `/api/v1/dimensions/tests/{testId}/dimensions` | ADMIN, RECRUITER, EVALUATOR (own institute) |
| Dimensions | POST | `/api/v1/dimensions/tests/{testId}/dimensions` | ADMIN |
| Dimensions | DELETE | `/api/v1/dimensions/{id}` | ADMIN |
| Questions | GET | `/api/v1/questions` | ADMIN, RECRUITER, EVALUATOR (own institute) |
| Questions | GET | `/api/v1/questions/dimensions/{dimensionId}/questions` | ADMIN, RECRUITER, EVALUATOR (own institute) |
| Questions | POST | `/api/v1/questions/dimensions/{dimensionId}/questions` | ADMIN |
| Questions | DELETE | `/api/v1/questions/{id}` | ADMIN |
| Students | GET | `/api/v1/students` | ADMIN, RECRUITER (own institute) |
| Students | POST | `/api/v1/students/AddStudent` | ADMIN, RECRUITER (own institute) |
| Students | POST | `/api/v1/students/bulk-upload` | ADMIN, RECRUITER (own institute) |
| Students | DELETE | `/api/v1/students/{id}` | ADMIN, RECRUITER (own institute) |
| Invites | GET | `/api/v1/invites` | ADMIN, RECRUITER (own institute) |
| Invites | POST | `/api/v1/invites/tests/{testId}/invite` | ADMIN, RECRUITER (own institute) |
| Invites | GET | `/api/v1/invites/tests/{testId}/invites` | ADMIN, RECRUITER (own institute) |
| Invites | GET | `/api/v1/invites/students/{studentId}/invites` | ADMIN, RECRUITER (own institute) |
| Invites | DELETE | `/api/v1/invites/{id}` | ADMIN, RECRUITER (own institute) |
| Invites | POST | `/api/v1/invites/assessment` | Public, invite token in the body (DEC-03) |
| Responses | GET | `/api/v1/responses` | ADMIN, EVALUATOR (own institute) |
| Responses | POST | `/api/v1/responses/submit` | Public, invite token in the body (DEC-03, no JWT) |
| Responses | GET | `/api/v1/responses/student/{studentId}` | ADMIN, EVALUATOR (own institute) |
| Responses | GET | `/api/v1/responses/test/{testId}` | ADMIN, EVALUATOR (own institute) |
| Responses | DELETE | `/api/v1/responses/{id}` | ADMIN |
| Reports | GET | `/api/v1/reports` | ADMIN, RECRUITER, EVALUATOR (own institute) |
| Reports | GET | `/api/v1/reports/test/{testId}` | ADMIN, RECRUITER, EVALUATOR (own institute) |
| Reports | GET | `/api/v1/reports/test/{testId}/export?format=csv` | ADMIN, RECRUITER, EVALUATOR (own institute). CSV download, other formats 400 |
| Reports | GET | `/api/v1/reports/student/{studentId}/test/{testId}` | ADMIN, RECRUITER, EVALUATOR (own institute) |
| Health | GET | `/health` | Public |

**Role permission matrix (DEC-01).** A foreign institute id returns 404 for every tenant role. A role not listed for a capability gets 403.

| Capability | SUPER_ADMIN | ADMIN | RECRUITER | EVALUATOR | STUDENT (candidate) |
|---|---|---|---|---|---|
| Provision an institute (`POST /institutes`) | Yes | No | No | No | No |
| Read or change own institute (`GET`, `PUT`, `DELETE /institutes/{id}`) | No (no institute) | Yes | No | No | No |
| Create, publish, delete tests, dimensions, questions | No | Yes | No | No | No |
| Read tests, dimensions, questions | No | Yes | Yes | Yes | No |
| Manage candidates (students) | No | Yes | Yes | No | No |
| Issue and revoke candidate test invites | No | Yes | Yes | No | No |
| Read responses | No | Yes | No | Yes | No |
| Delete responses | No | Yes | No | No | No |
| Read reports | No | Yes | Yes | Yes | No |
| Issue staff and user invites (ADMIN, RECRUITER, EVALUATOR, STUDENT) | No | Yes | No | No | No |
| Invite a SUPER_ADMIN | No | No (403, logged) | No | No | No |
| Take the assessment and submit responses with the invite token (no JWT) | No | No | No | No | Yes |

**Route changes in `DEC-04` (old → new):**

| Old path | New path |
|---|---|
| `/api/<module>/...` (every module) | `/api/v1/<module>/...` |
| `/api/responses/responses/submit` | `/api/v1/responses/submit` |
| `/api/responses/responses/student/{studentId}` | `/api/v1/responses/student/{studentId}` |
| `/api/responses/responses/test/{testId}` | `/api/v1/responses/test/{testId}` |
| `/api/responses/responses/{id}` | `/api/v1/responses/{id}` |
| `/api/reports/reports/test/{testId}` | `/api/v1/reports/test/{testId}` |
| `/api/reports/reports/student/{studentId}/test/{testId}` | `/api/v1/reports/student/{studentId}/test/{testId}` |
| `/api/dimensions/dimensions/{id}` | `/api/v1/dimensions/{id}` |
| `/api/questions/questions/{id}` | `/api/v1/questions/{id}` |
| `/api/health` | `/health` |

`/api/students/AddStudent` keeps its existing name under the new prefix, `/api/v1/students/AddStudent`. Renaming it is a separate decision, because the path is not a duplicate.

---

# Authentication

The platform uses **JWT-based authentication**.

```text
Client
  │
  ▼
Login
  │
  ▼
Authentication Service
  │
  ├── Validate credentials
  ├── Verify bcrypt password hash
  └── Generate JWT
          │
          ▼
       Client
          │
          ▼
   Authorization Header
          │
          ▼
    Auth Middleware
          │
          ▼
       Protected API
```

---

# Redis

Redis is used as a high-performance in-memory data store.

Potential platform use cases include:

- API response caching
- Rate limiting
- Session/temporary data
- OTP and verification data
- Password reset tokens
- Assessment session state
- Frequently accessed test configuration
- Real-time counters
- Distributed locks
- Background job coordination

```text
PostgreSQL
    │
    └── Permanent application data

Redis
    │
    └── Fast / temporary / cached data
```

---

# Health Check

```http
GET /health
```

Example:

```json
{
  "status": "ok"
}
```

---

# Project Structure

```text
psychometric-platform-backend/
│
├── src/
│   ├── app.ts
│   ├── server.ts
│   ├── config/
│   ├── modules/
│   ├── middlewares/
│   ├── utils/
│   └── types/
│
├── prisma/
│   ├── schema.prisma
│   └── migrations/
│
├── scripts/
├── docs/
├── _bmad/
├── _bmad-output/
│
├── compose.yaml
├── .env
├── package.json
├── tsconfig.json
└── README.md
```

---

# Development Workflow

Recommended local startup sequence:

```bash
docker compose up -d

docker compose ps

npx prisma migrate status

npx prisma generate

npm run dev
```

Then open:

```text
http://localhost:5001/api-docs
```

---

# Useful Docker Commands

### Show running containers

```bash
docker ps
```

### Show all containers

```bash
docker ps -a
```

### View logs

```bash
docker compose logs
```

### PostgreSQL logs

```bash
docker compose logs postgres
```

### Redis logs

```bash
docker compose logs redis
```

### Follow logs

```bash
docker compose logs -f
```

### Stop infrastructure

```bash
docker compose down
```

### Start infrastructure again

```bash
docker compose up -d
```

---

# Versioning Strategy

Semantic versioning is used:

```text
MAJOR.MINOR.PATCH
```

Example:

```text
0.1.0 – Initial development
0.2.0 – Swagger documentation
0.3.0 – Redis integration
0.4.0 – Assessment engine improvements
1.0.0 – First stable release
```

---

# Future Architecture

The platform is designed to evolve from a modular monolith toward an event-driven architecture when scale and business requirements justify it.

Potential future infrastructure:

```text
                    API Gateway
                         │
                  Load Balancer
                         │
              ┌──────────┴──────────┐
              │                     │
        Backend Instance 1    Backend Instance 2
              │                     │
              └──────────┬──────────┘
                         │
          ┌──────────────┼──────────────┐
          │              │              │
     PostgreSQL        Redis        Message Broker
                                      │
                              RabbitMQ / Kafka
                                      │
                         Background Workers
```

Potential future capabilities include:

- Event-driven processing
- Background jobs
- Notification services
- Email processing
- Advanced psychometric analytics
- AI-assisted assessment insights
- Multi-tenant architecture
- Role-based access control
- Advanced reporting
- Observability
- Prometheus / Grafana
- Sentry
- AWS deployment
- Docker-based CI/CD
- Infrastructure as Code with Terraform

---

# Security Remediation & Implementation Progress

Tracks the remediation of the findings in `docs/IMPLEMENTATION_AUDIT.md`. Each task is completed one at a time. A regression test that passes does not by itself mean a finding is fixed. Status is updated only after the fix is committed.

## Completed (`DONE`)

| Task | Summary | Reference |
|---|---|---|
| `DEC-01` Multi-tenant Enterprise Recruiting SaaS Roles | Five roles: `SUPER_ADMIN` (platform, no institute), `ADMIN`, `RECRUITER` and `EVALUATOR` (tenant staff, one institute each), and `STUDENT` (candidate, invite token only). `User.instituteId` is nullable for SUPER_ADMIN only, and a database CHECK requires an institute for every other user. `POST /api/v1/institutes` is SUPER_ADMIN only. With `initialAdminEmail`, the institute and its first ADMIN invite are created in one transaction, and the raw token is returned once. Staff invites can grant ADMIN, RECRUITER, EVALUATOR or STUDENT. A SUPER_ADMIN invite is refused (403) and logged. RECRUITER manages candidates and test invites and reads tests, dimensions, questions and reports. EVALUATOR reads tests, dimensions, questions, responses and reports. Both get 403 on writes and invites, and 404 on foreign institute resources. Migrations `20261126130000_add_dec01_saas_roles` and `20261126130100_add_dec01_tenant_scope_checks`. | `feat: implement multi-tenant enterprise recruiting saas roles` |
| `DEC-02` Invitation-only Onboarding | Public self-registration is closed. `POST /api/v1/auth/register` always returns 403 and logs `authorization_denied`. An ADMIN issues a user invite with `POST /api/v1/auth/invites`, scoped to the token's institute. The raw token is returned once, and only its SHA-256 hash is stored (`UserInvite.tokenHash`, additive migration `20261126120000_add_user_invites`). `POST /api/v1/auth/accept-invite` is public and token-bound. It creates the user in the invited institute and role, and consumes the invite in one transaction with a conditional claim, so it is single use. Every unusable invite returns one generic 400 and logs `invite_validation_failed` without the token. ADMINs list and revoke only their own institute's invites (`GET` and `DELETE /api/v1/auth/invites`). A foreign invite returns 404. | `feat: enforce invitation-only user onboarding` |
| `DEC-03` Token-bound Candidate Access via `TestInvite` | A candidate is identified by the invite token alone. `POST /api/v1/invites/assessment` takes the token in the body and returns the test title and description, the candidate's `studentId`, the active dimensions and the active questions. Inactive dimensions and questions are excluded, and no internal fields are returned. The endpoint applies the same rules as submission (`findUsableInvite` in `src/modules/invites/invite-validation.ts`): the invite must exist, be pending and unexpired, match the student, and have an active test, student and institute. Every refusal returns one generic 404 and logs `invite_validation_failed` without the token. `POST /api/v1/responses/submit` no longer requires a JWT; the invite token is the only credential, and the DB-03 and SEC-05 checks are unchanged. Internal assessment reads (`GET /api/v1/tests`, `GET /api/v1/dimensions`, `GET /api/v1/dimensions/tests/{testId}/dimensions`, `GET /api/v1/questions` and `GET /api/v1/questions/dimensions/{dimensionId}/questions`) are ADMIN only, so a STUDENT token gets 403. The schema has no link between `Student` and `User`, and none was added. | `feat: enforce token-bound candidate assessment flow` |
| `DEC-04` Standardized `/api/v1` Routes & Duplicate Segment Cleanup | Every module router is mounted under `/api/v1/<resource>`. The unversioned `/api/...` paths return 404. The duplicated segments are removed: `/responses/responses/...`, `/reports/reports/...`, `/dimensions/dimensions/...` and `/questions/questions/...` are now `/responses/...`, `/reports/...`, `/dimensions/...` and `/questions/...`. Health moved to `GET /health` at the root. Swagger annotations show the real full paths. Authentication, role checks and tenant checks are unchanged. The full old-to-new table is in the API Versioning section | `feat: standardize api v1 routes and remove duplicate path segments` |
| Backend Implementation Audit & Roadmap | Five audit documents in `docs/` | `94cc856` |
| `SEC-11` Integration Test Infrastructure | Isolated `psychometric_test` database guard, fixtures, supertest harness | `9fa8803`, `docs/INTEGRATION_TESTING.md` |
| `SEC-07` Centralized Environment & JWT Secret Validation | `src/config/env.ts` validates configuration at startup; JWT secret must be at least 32 characters; hard-coded fallback secrets removed | `6c9e926` |
| `SEC-02` Role & Tenant Authorization on Institute Endpoints | Reusable `authorizeRoles` middleware (401 with no user, 403 for the wrong role). All five institute routes require ADMIN. An ADMIN can view, update or delete only their own institute; a foreign institute returns 404 before any cascade runs. Listing is scoped to the requester's institute. Spoofed `instituteId` values in query or body are ignored | `security: protect institute endpoints with role authorization` |
| `SEC-01` Institute Ownership for Test Publish & Delete | Institute is derived from `req.user` only; lookups scoped by institute; a foreign test returns 404 (same as a missing test); a spoofed body `instituteId` is ignored | `security: enforce institute ownership for tests` |
| `SEC-03` Response Tenant Isolation & Role Authorization | Response list, student read, test read and delete require ADMIN (STUDENT gets 403). Every read and delete is scoped through student and test to the requester's institute; a foreign student, test or response returns 404 with no data; a missing institute fails closed. Student submission is unchanged | `security: enforce response tenant isolation` |
| `Step 12` Security Logging & Release-Gate Verification | A reusable security logger (`src/utils/security-logger.ts`) writes structured events: `auth_failed`, `authorization_denied`, `invite_validation_failed` and `sensitive_admin_action`. Each entry carries only allowlisted fields (user, institute, role, resource, action, reason, timestamp). A JWT-shaped value or any unlisted key is dropped, so tokens, Authorization headers, raw invite tokens, passwords and response payloads are never logged. The release-gate audit found and fixed: `GET /api/tests` and `GET /api/auth/users` returned other institutes' data (now scoped to the token's institute and fail-closed); test create, publish and delete had no route-level `authorizeRoles('ADMIN')`; `getInstituteTests` read the tenant from the query string. The error middleware no longer logs the raw error object, and in production a 500 returns no internal message and the log has no stack. Auth, role, error and log behaviour is covered by unit tests, and the gate is covered by `release-gate.integration.spec.ts`. HTTP status codes and response bodies are unchanged except as listed. **All P0 `SEC-*` and P1 `DB-*` items are verified.** | `security: add structured security logging and release gate audit` |
| `DB-03` Assessment Response Integrity | A submission is bound to its invite. The invite alone decides the student, test and institute: a body `studentId`, `instituteId` or `testId` never reassigns a response, and a mismatched `studentId` is refused (400). Every submitted question must be active, under an active dimension, of the invited test and institute, so a question from another test or institute is refused. Duplicate question ids, non-integer or out-of-scale answers, and empty payloads are refused (400). Validation, the invite claim and the response insert run in one `prisma.$transaction`, so a refused submission writes no rows. The claim is conditional, so two concurrent submissions for one invite save exactly one. Content refusals now return 400, not 500. **All P0 and P1 items are now complete.** Remaining: `DEC-01..04` | `fix: enforce assessment response integrity` |
| `DB-02` Student Re-Invitation After Revoke, Expiry or Soft Delete | A student can be invited again to a test after the earlier invite was revoked or expired. The invite row is reused with a fresh 256-bit token, so the old token is refused and the new one submits. A duplicate active invite is skipped, and a completed invite is never reissued. Re-creating a soft-deleted student with the same email works: the create route no longer requires a body `instituteId` that the server ignored. No migration was needed. Re-invites stay tenant scoped (a foreign student or test returns 404) | `fix: allow valid student reinvitations` |
| `DB-01` Soft-Delete Cascade Relationships | Each soft-delete cascade (Institute, Test, Dimension, Question, Student) runs in one `prisma.$transaction`, with children matched by their real foreign keys. The old generic cascade had wrong lookups (for example institute → `testId`, invite → `studentId`) and returned 500 for an own-institute delete. `updatedBy` now records the acting user (test delete recorded the institute id). Dimension delete now also soft deletes the responses of its questions. Users of a deleted institute are deactivated, as before. Rows are never removed | `fix: correct soft delete cascade relationships` |
| `SEC-10` Tenant-Scoped Reporting & Report Parameter Fix | Fixed the report handlers that read `req.params.id` while the routes define `:testId` and `:studentId` (every valid report returned 400). The student report route has its own handler and returns one student. All report routes are ADMIN-only (STUDENT 403, no token 401). Test, student and list reports are scoped to the caller's institute; a foreign or non-existent test or student returns 404. Inactive students, tests, dimensions, questions and responses are excluded. Student self-service reports are not offered until DEC-03 is decided. **All P0 security items are now complete:** SEC-07, SEC-01, SEC-02, SEC-03, SEC-05, SEC-06 and SEC-10 | `security: enforce tenant scoped reporting` |
| `SEC-06` Dimension & Question Ownership | Dimension and question writes (create and delete) require ADMIN (STUDENT gets 403). Each write checks the full chain (question → dimension → test → institute, all active) before any write or cascade; a foreign or inactive parent returns 404 and the other institute's rows are untouched. Global lists are scoped to the institute. Reads stay available to any user of the same institute (documented in `docs/INTEGRATION_TESTING.md`). No update routes exist for these entities | `security: validate dimension and question ownership` |
| `SEC-05` Invite Token Protection & Access | Invite listings and reads never return a token; a token is returned once, to the admin who creates the invite. All invite routes require ADMIN (STUDENT gets 403) and are scoped to the requester's institute (foreign invite or student returns 404). Tokens use `randomBytes(32)`. Submission refuses expired invites. Unknown, revoked, expired and used tokens are refused without echoing the token. **Not done:** tokens are still stored in plaintext; hashing at rest needs a migration and a decision on existing invites | `security: protect invite tokens and access` |

## Decisions

| Decision | Status |
|---|---|
| `DEC-01` Multi-tenant Enterprise Recruiting SaaS | `DONE` (see Completed) |
| `DEC-02` Invitation-only onboarding | `DONE` (see Completed) |
| `DEC-03` Token-bound candidates via `TestInvite` | `DONE` (see Completed) |
| `DEC-04` Standardized `/api/v1` routes | `DONE` (see Completed) |

DEC-01 to DEC-04 are implemented. The P1 database items DB-01 to DB-03 are recorded in Completed as well. Open follow-ups are listed below. They are not part of the decisions.

The tracker records these security items as done: SEC-01, SEC-02, SEC-03, SEC-05, SEC-06, SEC-07, SEC-10 and SEC-11. **SEC-04, SEC-08 and SEC-09 have no entry in Completed**, so this tracker cannot show them as done. Confirm their status before calling the P0 security list complete.

**Post-decision follow-ups** (not started; each depends on the decisions above or on a migration):

- **DEC-02 (done):** public registration is closed. Institutes are now provisioned by a SUPER_ADMIN (DEC-01). The invite still needs the admin to accept it. An invite's `name` is validated but not stored, because `User` has no name column. A `STUDENT` invite creates a `User` with no `Student` link, which DEC-03 leaves open. The invite expiry is capped at 30 days, and there is no password policy yet. Deploy the migration `20261126120000_add_user_invites` to `psychometric_db` with `npx prisma migrate deploy`. It was applied only to the test database here.
- **DEC-01 (done):** the first SUPER_ADMIN account is not created by any API. Tests create it with Prisma. Choose a bootstrap method (seed or an operator command). Apply the two DEC-01 migrations to `psychometric_db` with `npx prisma migrate deploy`. They are applied to the test database only so far.
- **DEC-03 (done):** candidates are identified by their `TestInvite` token alone. Student self-service reports are not offered, and linking a `Student` to a `User` is not done; either needs its own decision. There is no `GET /api/v1/tests/{id}` route. A candidate reads their test through `POST /api/v1/invites/assessment`.
- **Invite tokens at rest:** tokens are still stored in plaintext. Hashing needs a migration and a decision on how existing invites are handled.
- **API documentation in production:** `/api-docs` is served whenever the app runs. Decide whether it is disabled in production.
- **Unrouted code, not tenant scoped:** `getInstitutes` in `institute.service.ts` (search across all institutes) has no route. Its query is not scoped to the requester, so it must be removed or scoped before anyone routes it. This is the one known exception to the release-gate rule that tenant lookups are scoped.

## Phase 1 Enterprise SaaS Modules

Tracker for the enterprise recruiting modules that sit on top of the completed decisions.

| Module | Status | What it does | Commit |
|---|---|---|---|
| Async Notification & Redis Job Queue | `DONE` | Invite emails are queued after the invite transaction commits, never in the request. `SEND_TEST_INVITE` covers a candidate TestInvite created or re-issued. `SEND_USER_INVITE` covers a staff UserInvite and `initialAdminEmail` provisioning. Jobs are stored in Redis (`notifications:*` list and sorted set) through the existing client, with an in-process memory queue for tests and when Redis is down. A job holds only safe metadata, and the raw token stays in process memory until the job completes or dead-letters. It is never written to Redis or a log. Failed sends retry up to 3 times with 1s and 2s backoff, then dead-letter with a reason code. Enqueue failures are logged and never change the HTTP response. No mail provider is installed yet, so outside tests the default transport refuses to send (see the limitations in `docs/INTEGRATION_TESTING.md`). | `feat: add async notification queue with redis worker` |
| Psychometric Scoring & Analytics Engine | `DONE` | Pure, deterministic scoring in `src/modules/reports/scoring.engine.ts`. Each dimension gets a normalized 0..100 score from its questions' own scales. A composite is the weighted mean of those scores. Each completed candidate gets a midrank percentile and a band (LOW, BELOW_AVERAGE, AVERAGE, ABOVE_AVERAGE, HIGH) against the completed candidates of the same test and institute only. The test report adds cohort statistics (count, mean, median, population standard deviation, min, max) and per-dimension averages. New `GET /api/v1/reports/test/{testId}/export?format=csv` returns a CSV with RFC 4180 quoting and formula-injection protection, for ADMIN, RECRUITER and EVALUATOR of the own institute. The schema has no dimension weight, so the composite is equal-weighted, and the schema is unchanged. | `feat: add psychometric scoring engine and csv report export` |

**Formulas.** Normalized answer = (answer − scaleMin) / (scaleMax − scaleMin) × 100, clamped to 0..100. A scale with no range gives no score, never NaN. Composite = Σ(wᵢ·sᵢ) / Σwᵢ, which is the plain mean when no weights are set. Percentile = (below + 0.5 × equal) / n × 100. Bands: below 20 LOW, 20 to 40 BELOW_AVERAGE, 40 to 60 AVERAGE, 60 to 80 ABOVE_AVERAGE, 80 and up HIGH. Population standard deviation (divide by n).

---

## Current Test Baseline

Counts from the last run on this branch. Run them as described in `docs/INTEGRATION_TESTING.md`.

| Suite | Command | Result |
|---|---|---|
| Unit | `npm test` | 35 of 35 suites, **508 of 508 tests passed** |
| Integration (active) | `npm run test:integration` | 18 of 18 suites, **327 of 327 tests passed** |
| Pending regressions | `npm run test:integration:pending` | **No pending tests remain.** The script exits 0 with `--passWithNoTests`. DB-02, DB-03, DEC-01, DEC-02, DEC-03 and DEC-04 needed none |

---

# License

This project is currently under development.

License information should be added before public distribution.

---

# Author

**Shailendra Pardeshi**