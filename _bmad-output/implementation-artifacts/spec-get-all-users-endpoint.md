---
title: 'Add Get All Users Endpoint'
type: 'feature'
created: '2026-04-17T12:14:00.000Z'
status: 'in-review'
baseline_commit: 'NO_VCS'
context: []
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** There is no API endpoint to retrieve a list of users, while other modules (institutes, students, etc.) have similar endpoints.

**Approach:** Add a "Get all users" endpoint to the auth module following the existing pattern established by other modules.

## Boundaries & Constraints

**Always:** 
- Follow existing API patterns from other modules
- Exclude sensitive data (passwords) from response
- Maintain consistent response format with other endpoints
- Add proper authentication/authorization

**Ask First:** 
- What level of access should be required for this endpoint?

**Never:** 
- Expose user passwords or sensitive data
- Break existing auth module structure
- Create a separate users module (keep in auth)

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| AUTHENTICATED_ADMIN | Admin user calls endpoint | Returns paginated list of users with basic info | N/A |
| UNAUTHORIZED_ACCESS | Non-admin user calls endpoint | Returns 403 Forbidden error | Proper error response |
| EMPTY_DATABASE | No users exist | Returns empty list with pagination metadata | N/A |
| INVALID_PAGINATION | Invalid page/limit parameters | Returns 400 validation error | Parameter validation |

</frozen-after-approval>

## Code Map

- `src/modules/auth/auth.controller.ts` -- Add getAllUsers controller function
- `src/modules/auth/auth.service.ts` -- Add getAllUsers service function  
- `src/modules/auth/auth.routes.ts` -- Add GET /users route with Swagger docs

## Tasks & Acceptance

**Execution:**
- [x] `src/modules/auth/auth.service.ts` -- Add getAllUsers function with pagination and filtering
- [x] `src/modules/auth/auth.controller.ts` -- Add getAllUsers controller with validation and error handling
- [x] `src/modules/auth/auth.routes.ts` -- Add GET /users route with Swagger documentation
- [x] Add authentication middleware to restrict access to admin users

**Acceptance Criteria:**
- Given an authenticated admin user calls GET /api/auth/users, when the request is valid, then returns paginated list of users with id, email, role, instituteId, createdAt
- Given a non-admin user calls GET /api/auth/users, when authentication passes, then returns 403 Forbidden
- Given invalid pagination parameters, when the endpoint is called, then returns 400 validation error
- Given the request is successful, when the response is returned, then excludes sensitive data like passwords

## Spec Change Log

## Design Notes

Following the pattern from institute module which has both `getInstitutes` (paginated with search) and `getAllInstitutes` (simpler). This implementation will follow the `getAllInstitutes` pattern for simplicity, with basic pagination (page, limit) and admin-only access.

User data returned will be limited to non-sensitive fields: id, email, role, instituteId, createdAt, updatedAt. Passwords will never be included.

## Verification

**Commands:**
- `npm run dev` -- expected: Server starts successfully
- `npm run build` -- expected: TypeScript compilation succeeds

**Manual checks:**
- Test endpoint with admin user and verify proper response format
- Test endpoint with non-admin user and verify 403 response
- Verify pagination works correctly
- Confirm no sensitive data is exposed in response
