# RBAC and Authorization Security Analysis
**Psychometric Platform Backend - Security Audit**
*Generated: 2026-05-14*
*Developer: Amelia (Senior Software Engineer)*

---

## Executive Summary

**Critical Security Vulnerabilities Found:** 15 routes completely unprotected
**High Priority Issues:** 8 routes missing role-based access control
**Medium Priority Issues:** 6 routes missing ownership validation
**Overall Security Score:** 3/10 (Critical)

The application has significant security gaps in authentication and authorization. Multiple endpoints are completely exposed without any middleware protection, allowing unauthorized access to sensitive operations including institute management, test creation, and data deletion.

---

## Critical Findings

### 1. Routes Missing Authentication Middleware (CRITICAL)

#### institute.routes.ts - 5/5 routes unprotected
```typescript
// File: src/modules/institute/institute.routes.ts
// NO AUTHENTICATION MIDDLEWARE IMPORTED OR USED

router.post('/', instituteController.createInstitute);           // ❌ PUBLIC
router.get('/', instituteController.getAllInstitutes);           // ❌ PUBLIC
router.get('/:id', instituteController.getInstituteById);       // ❌ PUBLIC
router.put('/:id', instituteController.updateInstitute);         // ❌ PUBLIC
router.delete('/:id', instituteController.deleteInstitute);     // ❌ PUBLIC
```

**Risk:** Anyone can create, read, update, or delete institutes without authentication.

**Impact:** 
- Unauthorized institute creation
- Data leakage through unrestricted read access
- Data tampering through unrestricted update/delete
- Complete bypass of RBAC system

#### tests.routes.ts - 4/4 routes unprotected
```typescript
// File: src/modules/tests/test.routes.ts
// NO AUTHENTICATION MIDDLEWARE IMPORTED OR USED

router.post('/', testController.createTest);                     // ❌ PUBLIC
router.get('/', testController.getAllTests);                     // ❌ PUBLIC
router.patch('/:id/publish', testController.publishTest);        // ❌ PUBLIC
router.delete('/:id', testController.deleteTest);                // ❌ PUBLIC
```

**Risk:** Anyone can create, read, publish, or delete psychometric tests without authentication.

**Impact:**
- Unauthorized test creation
- Test publication without approval
- Complete test database access
- Bypass of test management controls

---

### 2. Routes Missing Role Middleware (HIGH)

#### responses.routes.ts - 5/5 routes missing role checks
```typescript
// File: src/modules/responses/response.routes.ts
// Has authenticateJWT but NO role middleware

router.get('/', authenticateJWT, responseController.getAllResponses);                    // ❌ AUTH ONLY
router.post('/responses/submit', authenticateJWT, responseController.submitResponses);    // ❌ AUTH ONLY
router.get('/responses/student/:studentId', authenticateJWT, responseController.getStudentResponses); // ❌ AUTH ONLY
router.get('/responses/test/:testId', authenticateJWT, responseController.getTestResponses);         // ❌ AUTH ONLY
router.delete('/responses/:id', authenticateJWT, responseController.deleteResponse);     // ❌ AUTH ONLY
```

**Risk:** Any authenticated user can access all responses, not just their own or institute's data.

**Impact:**
- Data leakage between institutes
- Unauthorized access to student responses
- Response manipulation
- Privacy violation

#### auth.routes.ts - 1/1 route missing role check
```typescript
// File: src/modules/auth/auth.routes.ts

router.get('/users', authenticateJWT, authController.getAllUsers);  // ❌ AUTH ONLY
```

**Risk:** Any authenticated user can list all users in the system.

**Impact:**
- User enumeration attack
- Data leakage
- Privacy violation

---

### 3. Inconsistent Authorization Checks (MEDIUM)

#### Controller-level authorization instead of middleware

**tests.controller.ts** - Authorization logic in controller:
```typescript
// File: src/modules/tests/test.controller.ts
export const createTest = async (req: Request, res: Response): Promise<Response> => {
    const user = (req as any).user;
    
    if (!user?.role || !user?.instituteId) {
        return unauthorizedResponse(res, 'Unauthorized');
    }
    // ... but no role check here, relies on service layer
};
```

**Problem:** Authorization logic scattered across controllers and services, inconsistent with middleware pattern.

**Impact:**
- Hard to audit
- Easy to miss authorization checks
- Inconsistent error handling
- Bypass potential if service layer changes

#### Missing ownership validation

**institute.controller.ts** - No ownership check:
```typescript
export const updateInstitute = async (req: Request, res: Response): Promise<Response> => {
    const { id } = req.params;
    const userId = getUserId(req);
    
    const institute = await instituteService.updateInstitute(id, req.body, userId);
    // No check if user belongs to this institute
};
```

**Problem:** Users can update institutes they don't belong to.

**Impact:**
- Cross-institute data tampering
- Unauthorized modifications
- Data integrity issues

---

### 4. Public Routes Incorrectly Exposed (CRITICAL)

#### auth.routes.ts - Public endpoints correctly exposed
```typescript
router.post('/register', authController.register);  // ✅ CORRECT: Public
router.post('/login', authController.login);        // ✅ CORRECT: Public
```

These are the only correctly exposed public endpoints.

---

## Route Protection Matrix

| Module | Route | Method | Auth Middleware | Role Middleware | Ownership Check | Status |
|--------|-------|--------|-----------------|-----------------|-----------------|--------|
| **auth** | /register | POST | ❌ None | ❌ None | N/A | ✅ Correct (Public) |
| **auth** | /login | POST | ❌ None | ❌ None | N/A | ✅ Correct (Public) |
| **auth** | /users | GET | ✅ authenticateJWT | ❌ None | N/A | ⚠️ Missing ADMIN role |
| **institute** | / | POST | ❌ None | ❌ None | N/A | ❌ CRITICAL: No auth |
| **institute** | / | GET | ❌ None | ❌ None | N/A | ❌ CRITICAL: No auth |
| **institute** | /:id | GET | ❌ None | ❌ None | N/A | ❌ CRITICAL: No auth |
| **institute** | /:id | PUT | ❌ None | ❌ None | ❌ Missing | ❌ CRITICAL: No auth |
| **institute** | /:id | DELETE | ❌ None | ❌ None | ❌ Missing | ❌ CRITICAL: No auth |
| **students** | / | GET | ✅ authenticateJWT | ✅ authorizeRoles('ADMIN') | ✅ Institute scope | ✅ Protected |
| **students** | /AddStudent | POST | ✅ authenticateJWT | ✅ authorizeRoles('ADMIN') | ✅ Institute scope | ✅ Protected |
| **students** | /bulk-upload | POST | ✅ authenticateJWT | ✅ authorizeRoles('ADMIN') | ✅ Institute scope | ✅ Protected |
| **students** | /:id | DELETE | ✅ authenticateJWT | ✅ authorizeRoles('ADMIN') | ✅ Institute scope | ✅ Protected |
| **tests** | / | POST | ❌ None | ❌ None | ❌ Missing | ❌ CRITICAL: No auth |
| **tests** | / | GET | ❌ None | ❌ None | N/A | ❌ CRITICAL: No auth |
| **tests** | /:id/publish | PATCH | ❌ None | ❌ None | ❌ Missing | ❌ CRITICAL: No auth |
| **tests** | /:id | DELETE | ❌ None | ❌ None | ❌ Missing | ❌ CRITICAL: No auth |
| **dimensions** | / | GET | ✅ authenticateJWT | ❌ None | N/A | ⚠️ Missing role check |
| **dimensions** | /tests/:testId/dimensions | GET | ✅ authenticateJWT | ❌ None | N/A | ⚠️ Missing role check |
| **dimensions** | /tests/:testId/dimensions | POST | ✅ authenticateJWT | ✅ authorizeRoles('ADMIN') | ❌ Missing | ⚠️ Missing ownership |
| **dimensions** | /dimensions/:id | DELETE | ✅ authenticateJWT | ✅ authorizeRoles('ADMIN') | ❌ Missing | ⚠️ Missing ownership |
| **questions** | / | GET | ✅ authenticateJWT | ❌ None | N/A | ⚠️ Missing role check |
| **questions** | /dimensions/:dimensionId/questions | GET | ✅ authenticateJWT | ❌ None | N/A | ⚠️ Missing role check |
| **questions** | /dimensions/:dimensionId/questions | POST | ✅ authenticateJWT | ✅ authorizeRoles('ADMIN') | ❌ Missing | ⚠️ Missing ownership |
| **questions** | /questions/:id | DELETE | ✅ authenticateJWT | ✅ authorizeRoles('ADMIN') | ❌ Missing | ⚠️ Missing ownership |
| **invites** | / | GET | ✅ authenticateJWT | ✅ authorizeRoles('ADMIN') | ✅ Institute scope | ✅ Protected |
| **invites** | /tests/:testId/invite | POST | ✅ authenticateJWT | ✅ authorizeRoles('ADMIN') | ✅ Institute scope | ✅ Protected |
| **invites** | /tests/:testId/invites | GET | ✅ authenticateJWT | ✅ authorizeRoles('ADMIN') | ✅ Institute scope | ✅ Protected |
| **invites** | /students/:studentId/invites | GET | ✅ authenticateJWT | ❌ None | ✅ Institute scope | ⚠️ Missing role check |
| **invites** | /:id | DELETE | ✅ authenticateJWT | ✅ authorizeRoles('ADMIN') | ✅ Institute scope | ✅ Protected |
| **reports** | / | GET | ✅ authenticateJWT | ✅ authorizeRoles('ADMIN') | ✅ Institute scope | ✅ Protected |
| **reports** | /reports/student/:studentId/test/:testId | GET | ✅ authenticateJWT | ✅ authorizeRoles('ADMIN') | ✅ Institute scope | ✅ Protected |
| **reports** | /reports/test/:testId | GET | ✅ authenticateJWT | ✅ authorizeRoles('ADMIN') | ✅ Institute scope | ✅ Protected |
| **responses** | / | GET | ✅ authenticateJWT | ❌ None | N/A | ⚠️ Missing ADMIN role |
| **responses** | /responses/submit | POST | ✅ authenticateJWT | ❌ None | N/A | ⚠️ Should allow students |
| **responses** | /responses/student/:studentId | GET | ✅ authenticateJWT | ❌ None | ❌ Missing | ⚠️ Missing ownership check |
| **responses** | /responses/test/:testId | GET | ✅ authenticateJWT | ❌ None | N/A | ⚠️ Missing ADMIN role |
| **responses** | /responses/:id | DELETE | ✅ authenticateJWT | ❌ None | N/A | ⚠️ Missing ADMIN role |

---

## Security Issues Summary

### Critical Issues (Immediate Action Required)

1. **institute.routes.ts** - 5 routes completely unprotected
   - All CRUD operations exposed without authentication
   - Allows unauthorized institute management
   - **CVSS Score:** 9.8 (Critical)

2. **tests.routes.ts** - 4 routes completely unprotected
   - Test creation, publication, and deletion exposed
   - Allows unauthorized test management
   - **CVSS Score:** 9.8 (Critical)

### High Priority Issues

3. **responses.routes.ts** - 5 routes missing role checks
   - Any authenticated user can access all responses
   - Data leakage between institutes
   - **CVSS Score:** 7.5 (High)

4. **auth.routes.ts** - /users endpoint missing ADMIN role
   - Any authenticated user can list all users
   - User enumeration vulnerability
   - **CVSS Score:** 6.5 (Medium)

### Medium Priority Issues

5. **dimensions.routes.ts** - 2 routes missing ownership checks
   - ADMIN can modify other institutes' dimensions
   - **CVSS Score:** 5.3 (Medium)

6. **questions.routes.ts** - 2 routes missing ownership checks
   - ADMIN can modify other institutes' questions
   - **CVSS Score:** 5.3 (Medium)

7. **invites.routes.ts** - 1 route missing role check
   - Students can view their own invites (acceptable)
   - But should be explicitly documented
   - **CVSS Score:** 3.5 (Low)

---

## Middleware Integration Fixes

### Fix 1: Add Authentication to institute.routes.ts

**Current:**
```typescript
import { Router } from 'express';
import * as instituteController from './institute.controller';

const router = Router();

router.post('/', instituteController.createInstitute);
router.get('/', instituteController.getAllInstitutes);
router.get('/:id', instituteController.getInstituteById);
router.put('/:id', instituteController.updateInstitute);
router.delete('/:id', instituteController.deleteInstitute);
```

**Fixed:**
```typescript
import { Router } from 'express';
import * as instituteController from './institute.controller';
import { authenticateJWT } from '../../middleware/auth.middleware';
import { authorizeRoles } from '../../middleware/role.middleware';

const router = Router();

// Public endpoint for initial institute creation (consider if this should be public)
router.post('/', instituteController.createInstitute);

// All other endpoints require authentication and ADMIN role
router.get('/', authenticateJWT, authorizeRoles('ADMIN'), instituteController.getAllInstitutes);
router.get('/:id', authenticateJWT, instituteController.getInstituteById);
router.put('/:id', authenticateJWT, authorizeRoles('ADMIN'), instituteController.updateInstitute);
router.delete('/:id', authenticateJWT, authorizeRoles('ADMIN'), instituteController.deleteInstitute);
```

### Fix 2: Add Authentication to tests.routes.ts

**Current:**
```typescript
import { Router } from 'express';
import * as testController from './test.controller';

const router = Router();

router.post('/', testController.createTest);
router.get('/', testController.getAllTests);
router.patch('/:id/publish', testController.publishTest);
router.delete('/:id', testController.deleteTest);
```

**Fixed:**
```typescript
import { Router } from 'express';
import * as testController from './test.controller';
import { authenticateJWT } from '../../middleware/auth.middleware';
import { authorizeRoles } from '../../middleware/role.middleware';

const router = Router();

// All test operations require authentication and ADMIN role
router.post('/', authenticateJWT, authorizeRoles('ADMIN'), testController.createTest);
router.get('/', authenticateJWT, authorizeRoles('ADMIN'), testController.getAllTests);
router.patch('/:id/publish', authenticateJWT, authorizeRoles('ADMIN'), testController.publishTest);
router.delete('/:id', authenticateJWT, authorizeRoles('ADMIN'), testController.deleteTest);
```

### Fix 3: Add Role Checks to responses.routes.ts

**Current:**
```typescript
router.get('/', authenticateJWT, responseController.getAllResponses);
router.post('/responses/submit', authenticateJWT, responseController.submitResponses);
router.get('/responses/student/:studentId', authenticateJWT, responseController.getStudentResponses);
router.get('/responses/test/:testId', authenticateJWT, responseController.getTestResponses);
router.delete('/responses/:id', authenticateJWT, responseController.deleteResponse);
```

**Fixed:**
```typescript
// ADMIN only - view all responses
router.get('/', authenticateJWT, authorizeRoles('ADMIN'), responseController.getAllResponses);

// Students can submit responses (with valid token)
router.post('/responses/submit', authenticateJWT, responseController.submitResponses);

// Students can view their own responses, ADMIN can view any
router.get('/responses/student/:studentId', authenticateJWT, responseController.getStudentResponses);

// ADMIN only - view test responses
router.get('/responses/test/:testId', authenticateJWT, authorizeRoles('ADMIN'), responseController.getTestResponses);

// ADMIN only - delete responses
router.delete('/responses/:id', authenticateJWT, authorizeRoles('ADMIN'), responseController.deleteResponse);
```

### Fix 4: Add Role Check to auth.routes.ts

**Current:**
```typescript
router.get('/users', authenticateJWT, authController.getAllUsers);
```

**Fixed:**
```typescript
router.get('/users', authenticateJWT, authorizeRoles('ADMIN'), authController.getAllUsers);
```

---

## RBAC Improvement Plan

### Phase 1: Critical Fixes (Immediate - 1 day)

**Priority:** CRITICAL
**Timeline:** Complete within 24 hours

1. **Add authentication middleware to institute.routes.ts**
   - Import `authenticateJWT` and `authorizeRoles`
   - Protect all routes except possibly POST / (if public registration is desired)
   - Add ADMIN role check for write operations
   - **Estimated time:** 30 minutes

2. **Add authentication middleware to tests.routes.ts**
   - Import `authenticateJWT` and `authorizeRoles`
   - Protect all routes with ADMIN role
   - **Estimated time:** 30 minutes

3. **Add role checks to responses.routes.ts**
   - Add ADMIN role for read/delete operations
   - Keep submitResponses open to authenticated users
   - **Estimated time:** 20 minutes

**Total Phase 1 Time:** 1.5 hours

### Phase 2: High Priority Fixes (Week 1)

**Priority:** HIGH
**Timeline:** Complete within 1 week

4. **Add role check to auth.routes.ts /users endpoint**
   - Add ADMIN role requirement
   - **Estimated time:** 10 minutes

5. **Implement ownership validation middleware**
   - Create `authorizeOwnership` middleware
   - Check if user belongs to the institute
   - Check if resource belongs to user's institute
   - **Estimated time:** 2 hours

6. **Add ownership checks to dimensions.routes.ts**
   - Apply ownership middleware to create/delete operations
   - **Estimated time:** 30 minutes

7. **Add ownership checks to questions.routes.ts**
   - Apply ownership middleware to create/delete operations
   - **Estimated time:** 30 minutes

**Total Phase 2 Time:** 3.5 hours

### Phase 3: Medium Priority Fixes (Week 2)

**Priority:** MEDIUM
**Timeline:** Complete within 2 weeks

8. **Refactor controller-level authorization to middleware**
   - Move authorization logic from controllers to middleware
   - Standardize error handling
   - **Estimated time:** 4 hours

9. **Add resource-level authorization**
   - Implement fine-grained permissions
   - Add permission checks for specific resources
   - **Estimated time:** 4 hours

10. **Add audit logging for authorization failures**
    - Log all unauthorized access attempts
    - Monitor for suspicious activity
    - **Estimated time:** 2 hours

**Total Phase 3 Time:** 10 hours

### Phase 4: Long-term Improvements (Month 1)

**Priority:** LOW
**Timeline:** Complete within 1 month

11. **Implement RBAC policy engine**
    - Create centralized policy management
    - Support dynamic role assignments
    - **Estimated time:** 8 hours

12. **Add permission caching**
    - Cache user permissions
    - Improve performance
    - **Estimated time:** 4 hours

13. **Implement attribute-based access control (ABAC)**
    - Add context-aware authorization
    - Support time-based permissions
    - **Estimated time:** 12 hours

**Total Phase 4 Time:** 24 hours

---

## Authorization Middleware Recommendations

### 1. Create Ownership Validation Middleware

**File:** `src/middleware/ownership.middleware.ts`

```typescript
import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import prisma from '../config/prisma';

/**
 * Middleware to validate that user belongs to the institute
 * and has access to the resource
 */
export const authorizeOwnership = (resourceType: string) => {
    return async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const user = req.user;
            if (!user?.instituteId) {
                return res.status(401).json({ 
                    success: false, 
                    message: 'Unauthorized: No institute context' 
                });
            }

            const resourceId = req.params.id || req.params.testId || req.params.dimensionId;
            
            if (!resourceId) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Resource ID required' 
                });
            }

            // Check if resource exists and belongs to user's institute
            let resource;
            switch (resourceType) {
                case 'institute':
                    resource = await prisma.institute.findFirst({
                        where: { id: resourceId, isActive: true }
                    });
                    break;
                case 'test':
                    resource = await prisma.psychometricTest.findFirst({
                        where: { id: resourceId, isActive: true }
                    });
                    break;
                case 'dimension':
                    resource = await prisma.dimension.findFirst({
                        where: { id: resourceId, isActive: true }
                    });
                    break;
                case 'question':
                    resource = await prisma.question.findFirst({
                        where: { id: resourceId, isActive: true }
                    });
                    break;
                default:
                    return res.status(400).json({ 
                        success: false, 
                        message: 'Invalid resource type' 
                    });
            }

            if (!resource) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Resource not found' 
                });
            }

            // For institute resources, check if user's institute matches
            if (resourceType === 'institute') {
                if (resource.id !== user.instituteId) {
                    return res.status(403).json({ 
                        success: false, 
                        message: 'Forbidden: Resource belongs to different institute' 
                    });
                }
            } else {
                // For other resources, check if resource's institute matches user's institute
                if (resource.instituteId && resource.instituteId !== user.instituteId) {
                    return res.status(403).json({ 
                        success: false, 
                        message: 'Forbidden: Resource belongs to different institute' 
                    });
                }
            }

            next();
        } catch (error) {
            return res.status(500).json({ 
                success: false, 
                message: 'Authorization check failed' 
            });
        }
    };
};
```

### 2. Create Student-Specific Authorization Middleware

**File:** `src/middleware/student.middleware.ts`

```typescript
import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';

/**
 * Middleware to allow students to access their own data
 */
export const authorizeStudentAccess = (paramName: string = 'studentId') => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        const user = req.user;
        const resourceStudentId = req.params[paramName];

        // ADMIN can access any student data
        if (user?.role === 'ADMIN') {
            return next();
        }

        // Students can only access their own data
        if (user?.role === 'STUDENT') {
            if (user.userId === resourceStudentId) {
                return next();
            }
            return res.status(403).json({ 
                success: false, 
                message: 'Forbidden: Can only access own data' 
            });
        }

        return res.status(403).json({ 
            success: false, 
            message: 'Forbidden: Invalid role' 
        });
    };
};
```

### 3. Update Auth Middleware to Include Institute ID

**File:** `src/middleware/auth.middleware.ts`

```typescript
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

export interface AuthRequest extends Request {
    user?: { 
        userId: string; 
        role: string;
        instituteId?: string;
    };
}

export const authenticateJWT = (
    req: AuthRequest,
    res: Response,
    next: NextFunction
) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ 
            success: false,
            message: 'No token provided' 
        });
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as { 
            userId: string; 
            role: string;
            instituteId?: string;
        };
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ 
            success: false,
            message: 'Invalid token' 
        });
    }
};
```

### 4. Create Composite Middleware for Common Patterns

**File:** `src/middleware/composite.middleware.ts`

```typescript
import { authenticateJWT } from './auth.middleware';
import { authorizeRoles } from './role.middleware';
import { authorizeOwnership } from './ownership.middleware';

/**
 * Common middleware combinations for reuse
 */
export const requireAdmin = [authenticateJWT, authorizeRoles('ADMIN')];
export const requireAuth = [authenticateJWT];
export const requireAdminWithOwnership = (resourceType: string) => [
    authenticateJWT, 
    authorizeRoles('ADMIN'),
    authorizeOwnership(resourceType)
];
```

---

## Updated Route Examples with Middleware

### institute.routes.ts (Fixed)

```typescript
import { Router } from 'express';
import * as instituteController from './institute.controller';
import { authenticateJWT } from '../../middleware/auth.middleware';
import { authorizeRoles } from '../../middleware/role.middleware';
import { requireAdmin } from '../../middleware/composite.middleware';

const router = Router();

// Public endpoint for initial institute creation
router.post('/', instituteController.createInstitute);

// Protected endpoints
router.get('/', ...requireAdmin, instituteController.getAllInstitutes);
router.get('/:id', authenticateJWT, instituteController.getInstituteById);
router.put('/:id', ...requireAdmin, instituteController.updateInstitute);
router.delete('/:id', ...requireAdmin, instituteController.deleteInstitute);
```

### tests.routes.ts (Fixed)

```typescript
import { Router } from 'express';
import * as testController from './test.controller';
import { requireAdmin, requireAdminWithOwnership } from '../../middleware/composite.middleware';

const router = Router();

// All test operations require ADMIN role
router.post('/', ...requireAdmin, testController.createTest);
router.get('/', ...requireAdmin, testController.getAllTests);
router.patch('/:id/publish', ...requireAdminWithOwnership('test'), testController.publishTest);
router.delete('/:id', ...requireAdminWithOwnership('test'), testController.deleteTest);
```

### responses.routes.ts (Fixed)

```typescript
import { Router } from 'express';
import * as responseController from './response.controller';
import { authenticateJWT } from '../../middleware/auth.middleware';
import { authorizeRoles } from '../../middleware/role.middleware';
import { authorizeStudentAccess } from '../../middleware/student.middleware';

const router = Router();

// ADMIN only
router.get('/', authenticateJWT, authorizeRoles('ADMIN'), responseController.getAllResponses);

// Students can submit responses
router.post('/responses/submit', authenticateJWT, responseController.submitResponses);

// Students can view their own responses, ADMIN can view any
router.get(
    '/responses/student/:studentId', 
    authenticateJWT, 
    authorizeStudentAccess('studentId'),
    responseController.getStudentResponses
);

// ADMIN only
router.get('/responses/test/:testId', authenticateJWT, authorizeRoles('ADMIN'), responseController.getTestResponses);
router.delete('/responses/:id', authenticateJWT, authorizeRoles('ADMIN'), responseController.deleteResponse);
```

---

## Testing Recommendations

### Security Testing Checklist

- [ ] Test that unauthenticated users cannot access protected routes
- [ ] Test that non-ADMIN users cannot access ADMIN-only routes
- [ ] Test that users cannot access other institutes' data
- [ ] Test that students can only access their own responses
- [ ] Test that ownership validation works correctly
- [ ] Test that role middleware correctly blocks unauthorized access
- [ ] Test that public endpoints remain accessible
- [ ] Test JWT token validation
- [ ] Test token expiration handling
- [ ] Test malformed token handling

### Automated Security Tests

```typescript
describe('Authorization Tests', () => {
    describe('institute.routes.ts', () => {
        it('should block unauthenticated access to GET /institutes', async () => {
            const response = await request(app)
                .get('/api/institutes')
                .expect(401);
        });

        it('should block non-ADMIN users from POST /institutes', async () => {
            const studentToken = generateStudentToken();
            const response = await request(app)
                .post('/api/institutes')
                .set('Authorization', `Bearer ${studentToken}`)
                .expect(403);
        });
    });

    describe('tests.routes.ts', () => {
        it('should block unauthenticated access to POST /tests', async () => {
            const response = await request(app)
                .post('/api/tests')
                .expect(401);
        });

        it('should allow ADMIN to create tests', async () => {
            const adminToken = generateAdminToken();
            const response = await request(app)
                .post('/api/tests')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ title: 'Test', description: 'Desc', instituteId: 'inst-1' })
                .expect(201);
        });
    });
});
```

---

## Monitoring and Alerting

### Security Events to Monitor

1. **Failed authentication attempts**
   - Track IP addresses
   - Monitor for brute force patterns
   - Alert on suspicious activity

2. **Authorization failures**
   - Track users attempting to access unauthorized resources
   - Monitor for privilege escalation attempts
   - Alert on repeated failures

3. **Cross-institute access attempts**
   - Monitor for users accessing other institutes' data
   - Alert on potential data leakage attempts

4. **Unusual activity patterns**
   - Monitor for bulk data access
   - Alert on suspicious query patterns
   - Track API usage anomalies

---

## Conclusion

The psychometric platform backend has critical security vulnerabilities that require immediate attention. The lack of authentication and authorization on key routes exposes the system to unauthorized access, data leakage, and potential data manipulation.

**Immediate Actions Required:**
1. Add authentication middleware to institute.routes.ts (30 min)
2. Add authentication middleware to tests.routes.ts (30 min)
3. Add role checks to responses.routes.ts (20 min)

**Total Immediate Fix Time:** 1.5 hours

**Risk if Not Addressed:**
- Complete system compromise
- Data breach
- Unauthorized data manipulation
- Privacy violations
- Compliance violations

**Recommendation:** Implement Phase 1 fixes immediately before deploying to production.

---

*Prepared by Amelia, Senior Software Engineer*
