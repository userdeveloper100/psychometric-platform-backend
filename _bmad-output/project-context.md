---
project_name: psychometric-platform-backend
user_name: PardeshiShailendra
date: '2026-05-15'
sections_completed: ['technology_stack', 'language_rules', 'framework_rules', 'testing_rules', 'quality_rules', 'workflow_rules', 'anti_patterns']
status: complete
rule_count: 87
optimized_for_llm: true
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

- **Node.js**: 18+ (LTS recommended)
- **Express**: 4.19.2 — Web framework for REST API
- **TypeScript**: 5.9.3 — Strict mode required (`"strict": true`)
- **Prisma**: 6.0.0 — ORM for PostgreSQL with type-safe queries
- **PostgreSQL**: Latest supported version
- **JWT (jsonwebtoken)**: 9.0.2 — Token-based authentication
- **bcryptjs**: 2.4.3 — Password hashing (bcrypt for production)
- **Redis**: 5.11.0 — Session/cache management
- **Jest**: 30.3.0 — Unit and integration testing
- **Swagger**: 6.2.8 — API documentation

**Compiler Target**: ES2020 | **Module System**: CommonJS

---

## Critical Implementation Rules

### Language-Specific Rules

- **Strict Mode**: REQUIRED — All TypeScript code must compile with `"strict": true`
- **No `any` types** — Use `unknown` if needed, then narrow type with type guards
- **Explicit typing** — All function parameters and return types must be typed
- **Import/Export**: Named exports for services (`export async function name(...)`), default/named exports for controllers
- **Error handling**: NEVER throw generic `Error` in services; catch and convert to response objects in controllers
- **Async/await**: Always use async/await; no Promise chaining
- **Null handling**: Use optional chaining (`obj?.property`) and nullish coalescing (`??`)
- **Optional fields**: Use `field?: type` in DTOs; distinguish NULL from empty string

### Framework-Specific Rules (Express.js)

- **Request/Response**: All handlers: `async (req: Request, res: Response): Promise<Response>`
- **Auth context**: Cast to `AuthRequest` to access user: `const authReq = req as AuthRequest; const userId = authReq.user?.userId`
- **Response standardization**: ALL responses via helpers (`successResponse`, `errorResponse`, etc.) — no manual `res.json()`
- **Response format**: `{ success: boolean, data?: T, message: string, meta?: { page, limit, total }, error?: { code, details } }`
- **Status codes**: 201 (creation), 200 (success), 400 (bad request), 401 (unauthorized), 403 (forbidden), 409 (conflict), 500 (error)
- **Middleware order**: CORS → Logger → Body Parser → Routes → Error Handler (error middleware LAST)
- **Services**: Standalone async functions (NOT classes); accept plain objects; throw errors; call Prisma directly
- **Route structure**: `{module}/{module}.routes.ts` imports controllers and registers handlers
- **Transactions**: Use `prisma.$transaction()` for multi-step operations; use `tx.model.action()` inside transactions
- **createdBy tracking**: ALWAYS set from authenticated user context (or validate admin action)

### Testing Rules

- **File naming**: `{feature}.spec.ts` or `{feature}.test.ts` (colocate with source)
- **Structure**: `describe('Feature', () => { test('case', async () => { ... }) })`
- **Independence**: No test dependencies; use `beforeEach`/`afterEach` for isolation
- **Unit vs Integration**: Unit tests mock Prisma; integration tests use test database
- **Mocking**: Mock Prisma at unit level, bcrypt for auth tests, NOT at integration level
- **Assertions**: Each test must have ≥1 assertion; test happy path + error cases + edge cases
- **Async**: Always `await` promises; use `async` in test functions
- **Coverage**: 70% minimum for auth/payments/scoring; 50% for admin/reporting
- **Database tests**: Use test database with rollback or fresh schema per suite

### Code Quality & Style Rules

- **Module structure**: `src/modules/{feature}/{feature}.{routes|controller|service|types}.ts`
- **Shared utilities**: `src/utils/` (response-helpers, jwt, scoring, softDelete)
- **Middleware**: `src/middleware/` (auth, error, role, validate)
- **Configuration**: `src/config/` (prisma, logger, swagger)
- **Naming**: kebab-case files (`auth.controller.ts`), PascalCase types (`AuthRequest`), camelCase functions (`registerAdmin`), UPPER_SNAKE_CASE constants (`JWT_SECRET`)
- **Database naming**: snake_case in schema; camelCase in JavaScript/DTOs
- **Types**: Define in `{module}.types.ts` (e.g., `interface RegisterInput { ... }`)
- **Comments**: ONLY for "why" logic; no commented-out code; JSDoc for exported functions
- **Response structure**: Always include `success`, `message`; include `meta` for pagination; include `error` with code
- **Variable naming**: Descriptive names, no abbreviations (`userId` ✓, `uid` ✗); booleans start with `is/has/can`
- **Function length**: Controllers <20 lines, services <100 lines, functions <50 lines
- **Cyclomatic complexity**: Max 5 decision paths per function

### Development Workflow Rules

- **Branch naming**: `feature/name`, `fix/issue-name`, `hotfix/issue-name`
- **Commits**: Imperative mood, present tense: `[module] Brief description` (e.g., `[auth] Add JWT refresh token rotation`)
- **PR title**: Same as commit format `[module] Description`
- **PR requirements**: One review approval, all CI checks pass, no console.logs, centralized error handling
- **Migrations**: `npx prisma migrate dev --name description` before commit; review generated SQL; never edit migration files
- **Database changes**: Every schema change MUST have a migration file
- **Build before deploy**: `npm run build`, `npm run test`, `npx tsc --noEmit` all pass
- **Swagger**: Run `npm run swagger:generate` before release
- **Environment variables**: `.env` file (never committed); required: `DATABASE_URL`, `JWT_SECRET`, `REDIS_URL`, `NODE_ENV`

### Critical Don't-Miss Rules

**❌ Security & Authentication:**
- NEVER store passwords in plain text; ALWAYS hash with bcryptjs
- NEVER commit `.env` files or secrets
- NEVER return password hashes in API responses
- JWT expiry: Access tokens 15-30 min, refresh tokens longer
- Verify user role on EVERY protected route (not just JWT presence)
- Soft-deleted users: Return "not found" (don't leak deleted status)
- Use constant-time comparison for tokens/secrets

**❌ Database & Data Integrity:**
- ALL soft delete queries MUST filter `isDeleted: false` (use middleware or explicit filters)
- Uniqueness constraints must exclude soft-deleted records (e.g., email)
- ALWAYS use transactions for multi-step operations
- Distinguish NULL (not set) from empty string (intentionally blank)
- Query optimization: Avoid N+1 queries; use `include` or `where` clauses
- NEVER spawn new Prisma instances; use singleton from `src/config/prisma.ts`

**❌ API Responses:**
- Empty results: return `data: []` with `success: true`, NOT null or error
- Large responses: Implement pagination (collections >100 items)
- Don't expose database errors to clients; log internally, return generic message
- Set `Content-Type: application/json` header
- Input validation: Trim strings, validate email, check numeric bounds, escape special characters

**❌ Common Gotchas:**
- AuthRequest casting: ALWAYS cast `req as AuthRequest` before accessing `user`
- Transaction scope: Variables outside transaction won't reflect inside changes
- Error middleware: Must be registered LAST (after all routes)
- Soft delete middleware: Must apply `isDeleted: false` automatically or explicitly
- Console.logs: Delete before commit (use structured logger instead)

---

## Usage Guidelines

### For AI Agents

- Read this file before implementing any code
- Follow ALL rules exactly as documented
- When in doubt, prefer the more restrictive option (e.g., use transactions for all multi-entity operations)
- Reference specific rules by section when clarifying implementation decisions
- Update this file if new patterns emerge during implementation

### For Humans

- Keep this file lean and focused on agent needs
- Update when technology stack changes
- Review quarterly for outdated rules
- Remove rules that become obvious over time
- Add new sections for patterns discovered during code review

**Last Updated**: 2026-05-15
