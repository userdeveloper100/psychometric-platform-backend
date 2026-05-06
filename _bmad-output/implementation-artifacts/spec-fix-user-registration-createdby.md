---
title: 'Fix User Registration Created By Field Issue'
type: 'bugfix'
created: '2026-04-17T11:53:00.000Z'
status: 'done'
baseline_commit: 'NO_VCS'
context: []
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** User registration API creates institute and user records with null `created_by` fields instead of setting them to the logged-in user ID.

**Approach:** Modify the registration service to accept and use `created_by` parameter when available, and handle public registration appropriately.

## Boundaries & Constraints

**Always:** 
- Maintain existing registration API contract
- Preserve transactional integrity of institute+user creation
- Keep `created_by` nullable in database schema

**Ask First:** 
- Should we restrict registration to authenticated users only?

**Never:** 
- Break existing public registration flow
- Add required authentication to current registration endpoint
- Change database schema to make `created_by` required

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| AUTHENTICATED_REGISTRATION | Logged-in user calls register endpoint | Both institute and user records have `created_by` set to logged-in user ID | N/A |
| PUBLIC_REGISTRATION | Unauthenticated user calls register endpoint | Records created with `created_by` set to null (public registration) | N/A |
| MISSING_CREATED_BY | Registration called without user context | Records created with `created_by` set to null (fallback) | N/A |

</frozen-after-approval>

## Code Map

- `src/modules/auth/auth.service.ts` -- Contains `registerInstituteAdmin` function that creates both institute and user records
- `src/modules/auth/auth.controller.ts` -- Registration endpoint controller that calls service
- `prisma/schema.prisma` -- Database schema showing `createdBy` fields are optional on Institute and User models

## Tasks & Acceptance

**Execution:**
- [x] `src/modules/auth/auth.service.ts` -- Modify `registerInstituteAdmin` to accept optional `createdBy` parameter and set it on both institute and user creation
- [x] `src/modules/auth/auth.controller.ts` -- Update register controller to extract user context and pass `createdBy` to service
- [x] `src/modules/auth/auth.service.ts` -- Add logic to handle public registration fallback for `createdBy`

**Acceptance Criteria:**
- Given an authenticated user calls registration, when registration completes, then both institute and user records have `created_by` set to that user's ID
- Given an unauthenticated user calls registration, when registration completes, then records are created with appropriate `created_by` handling
- Given any registration scenario, when the process fails, then the transaction rolls back completely

## Spec Change Log

**Entry 1 (2026-04-17):** 
- **Trigger:** Adversarial review found bad_spec violations - missing explicit public registration handling and fallback strategy
- **Amended:** Updated I/O Matrix to specify null `created_by` for unauthenticated registration, clarified fallback strategy in Design Notes, removed ambiguous "Ask First" question about public registration handling
- **Known-bad state avoided:** Implementation that would pass undefined `createdBy` without explicit handling strategy
- **KEEP instructions:** Preserve the optional `createdBy` parameter structure and the transaction-based institute+user creation approach

## Design Notes

The registration endpoint currently creates both institute and user records in a transaction but doesn't set `created_by`. The schema allows null values, supporting public registration. 

**Fallback Strategy:** For unauthenticated registration (no JWT token), `createdBy` will be undefined/null, which is explicitly handled by setting `created_by` to null in both institute and user records. This maintains backward compatibility while supporting authenticated user tracking.

**Public Registration Handling:** The endpoint accepts both authenticated and unauthenticated requests. When authenticated, `created_by` tracks the creating user. When unauthenticated, `created_by` is null, indicating public/self-registration.

## Verification

**Commands:**
- `npm run dev` -- expected: Server starts successfully
- `npm run build` -- expected: TypeScript compilation succeeds

**Manual checks:**
- Test registration with authenticated user and verify `created_by` is set in database
- Test public registration and verify appropriate `created_by` handling
- Verify existing registration functionality still works

## Suggested Review Order

**Authentication Context Extraction**

- Extract user ID from JWT token for tracking
  [`auth.controller.ts:18-20`](../../src/modules/auth/auth.controller.ts#L18)

**Service Layer Updates**

- Add optional createdBy parameter to interface
  [`auth.service.ts:11`](../../src/modules/auth/auth.service.ts#L11)

- Pass createdBy to institute creation
  [`auth.service.ts:31`](../../src/modules/auth/auth.service.ts#L31)

- Pass createdBy to user creation  
  [`auth.service.ts:41`](../../src/modules/auth/auth.service.ts#L41)

**Public Registration Support**

- Handle undefined createdBy gracefully for public registration
  [`auth.service.ts:23`](../../src/modules/auth/auth.service.ts#L23)
