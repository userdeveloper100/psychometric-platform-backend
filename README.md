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

All APIs follow versioned routes:

```text
/api/v1/*
```

Examples:

```http
GET /api/v1/students
POST /api/v1/tests
GET /api/v1/tests/:id
POST /api/v1/questions
```

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
| Backend Implementation Audit & Roadmap | Five audit documents in `docs/` | `94cc856` |
| `SEC-11` Integration Test Infrastructure | Isolated `psychometric_test` database guard, fixtures, supertest harness | `9fa8803`, `docs/INTEGRATION_TESTING.md` |
| `SEC-07` Centralized Environment & JWT Secret Validation | `src/config/env.ts` validates configuration at startup; JWT secret must be at least 32 characters; hard-coded fallback secrets removed | `6c9e926` |
| `SEC-02` Role & Tenant Authorization on Institute Endpoints | Reusable `authorizeRoles` middleware (401 with no user, 403 for the wrong role). All five institute routes require ADMIN. An ADMIN can view, update or delete only their own institute; a foreign institute returns 404 before any cascade runs. Listing is scoped to the requester's institute. Spoofed `instituteId` values in query or body are ignored | `security: protect institute endpoints with role authorization` |
| `SEC-01` Institute Ownership for Test Publish & Delete | Institute is derived from `req.user` only; lookups scoped by institute; a foreign test returns 404 (same as a missing test); a spoofed body `instituteId` is ignored | `security: enforce institute ownership for tests` |
| `SEC-03` Response Tenant Isolation & Role Authorization | Response list, student read, test read and delete require ADMIN (STUDENT gets 403). Every read and delete is scoped through student and test to the requester's institute; a foreign student, test or response returns 404 with no data; a missing institute fails closed. Student submission is unchanged | `security: enforce response tenant isolation` |
| `SEC-05` Invite Token Protection & Access | Invite listings and reads never return a token; a token is returned once, to the admin who creates the invite. All invite routes require ADMIN (STUDENT gets 403) and are scoped to the requester's institute (foreign invite or student returns 404). Tokens use `randomBytes(32)`. Submission refuses expired invites. Unknown, revoked, expired and used tokens are refused without echoing the token. **Not done:** tokens are still stored in plaintext; hashing at rest needs a migration and a decision on existing invites | `security: protect invite tokens and access` |

## Pending (`PENDING`)

| Task | Scope |
|---|---|
| `SEC-06` | Validate parent ownership for dimension and question writes and deletes |
| `SEC-10` | Enforce tenant-scoped reporting and fix the `report.controller.ts` `:testId` parameter bug |
| `DB-01` | Fix soft-delete cascade lookup relationships. Also blocks an ADMIN deleting their own institute, which currently returns 500 (a pending test covers it) |
| `DB-02` | Allow valid student re-invitations after soft delete |
| `DB-03` | Enforce assessment response question and student integrity |
| `DEC-01` | Platform model decision (institute and student platform, or recruiting SaaS) |
| `DEC-02` | Signup model decision (open signup or invite-only) |
| `DEC-03` | Student identity model decision (how students authenticate to submit answers) |
| `DEC-04` | API versioning decision (`/api` or `/api/v1`) |

## Current Test Baseline

Counts from the last run on this branch. Run them as described in `docs/INTEGRATION_TESTING.md`.

| Suite | Command | Result |
|---|---|---|
| Unit | `npm test` | 21 of 21 suites, **211 of 211 tests passed** |
| Integration (active) | `npm run test:integration` | 6 of 6 suites, **104 of 104 tests passed** |
| Pending regressions | `npm run test:integration:pending` | **9 of 9 failing, as designed**: 7 security tests (`SEC-06` ×4, `SEC-10` ×3), 1 `DB-01` cascade defect (own-institute delete returns 500), and 1 functional defect in the report route parameter |

---

# License

This project is currently under development.

License information should be added before public distribution.

---

# Author

**Shailendra Pardeshi**