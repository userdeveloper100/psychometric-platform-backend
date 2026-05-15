# API Response Standardization Guide
**Psychometric Platform Backend**
*Generated: 2026-05-14*
*Architect: Winston (System Architect)*

---

## Overview

This guide provides implementation examples and migration instructions for standardizing API response formats across all modules using the new response helper architecture.

---

## Architecture Components

### 1. Type Definitions
**File:** `src/types/api-response.types.ts`

Contains:
- `ApiResponse<T>` - Standard success response
- `ApiErrorResponse` - Standard error response
- `PaginatedResponse<T>` - Paginated success response
- `ErrorCode` enum - Standardized error codes
- `ErrorCodeToHttpStatus` - Error code to HTTP status mapping

### 2. Response Helpers
**File:** `src/utils/response-helpers.ts`

Contains:
- `successResponse()` - Build success responses
- `paginatedResponse()` - Build paginated responses
- `errorResponse()` - Build error responses
- Convenience wrappers (createdResponse, notFoundResponse, etc.)
- Pagination helpers (calculatePagination, calculateSkip, validatePagination)
- Error handling helpers (handlePrismaError, asyncHandler)
- Request ID generation

---

## Implementation Examples

### Example 1: Simple Success Response

**Before (Inconsistent):**
```typescript
// auth.controller.ts
res.status(200).json({
  success: true,
  message: 'Login successful',
  token,
  user
});
```

**After (Standardized):**
```typescript
import { successResponse } from '../../utils/response-helpers';

// auth.controller.ts
return successResponse(
  res,
  { token, user },
  'Login successful',
  200
);
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "clx123abc",
      "email": "admin@example.com",
      "role": "ADMIN"
    }
  },
  "meta": {
    "timestamp": "2026-05-14T10:30:00.000Z"
  }
}
```

---

### Example 2: Paginated Response

**Before (Inconsistent):**
```typescript
// test.controller.ts
const page = Number(req.query.page) || 1;
const limit = Number(req.query.limit) || 10;
const data = await testService.getAllTests({ page, limit });

res.status(200).json({
  success: true,
  data,
  pagination: { page, limit }
});
```

**After (Standardized):**
```typescript
import { 
  paginatedResponse, 
  calculatePagination,
  calculateSkip,
  validatePagination 
} from '../../utils/response-helpers';
import { ErrorCode } from '../../types/api-response.types';

// test.controller.ts
const page = req.query.page;
const limit = req.query.limit;

// Validate pagination
const validation = validatePagination(page, limit);
if (!validation.valid) {
  return badRequestResponse(res, validation.error);
}

const skip = calculateSkip(page, limit);
const total = await prisma.psychometricTest.count({ where: { isActive: true } });
const data = await prisma.psychometricTest.findMany({
  where: { isActive: true },
  skip,
  take: Number(limit),
  orderBy: { createdAt: 'desc' }
});

const pagination = calculatePagination(page, limit, total);

return paginatedResponse(res, data, pagination, 'Tests retrieved successfully');
```

**Response:**
```json
{
  "success": true,
  "message": "Tests retrieved successfully",
  "data": [
    { "id": "test-1", "title": "Leadership Assessment" },
    { "id": "test-2", "title": "Personality Test" }
  ],
  "meta": {
    "timestamp": "2026-05-14T10:30:00.000Z",
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 25,
      "totalPages": 3,
      "hasNextPage": true,
      "hasPreviousPage": false
    }
  }
}
```

---

### Example 3: Error Response

**Before (Inconsistent):**
```typescript
// dimension.controller.ts
try {
  const dimension = await dimensionService.createDimension(...);
  res.status(201).json({ success: true, data: dimension });
} catch (err: any) {
  const message = err?.message || 'Failed to create dimension';
  const status = message === 'Test not found' ? 404 : 400;
  res.status(status).json({ success: false, message });
}
```

**After (Standardized):**
```typescript
import { 
  createdResponse, 
  notFoundResponse, 
  badRequestResponse,
  handlePrismaError 
} from '../../utils/response-helpers';
import { ErrorCode } from '../../types/api-response.types';

// dimension.controller.ts
try {
  const dimension = await dimensionService.createDimension(...);
  return createdResponse(res, dimension, 'Dimension created successfully');
} catch (error) {
  // Handle Prisma errors
  if (error.code?.startsWith('P')) {
    const { code, message } = handlePrismaError(error);
    return errorResponse(res, code, message);
  }
  
  // Handle business logic errors
  if (error.message === 'Test not found') {
    return notFoundResponse(res, 'Test not found');
  }
  
  // Default error
  return serverErrorResponse(res, error.message || 'Failed to create dimension');
}
```

**Response (Error):**
```json
{
  "success": false,
  "message": "Test not found",
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "details": null
  },
  "meta": {
    "timestamp": "2026-05-14T10:30:00.000Z"
  }
}
```

---

### Example 4: Validation Error

**Before (Inconsistent):**
```typescript
// student.controller.ts
if (!studentIds || !Array.isArray(studentIds) || !studentIds.length) {
  res.status(400).json({
    success: false,
    message: 'studentIds must be a non-empty array'
  });
  return;
}
```

**After (Standardized):**
```typescript
import { badRequestResponse } from '../../utils/response-helpers';
import { ErrorCode } from '../../types/api-response.types';

// student.controller.ts
if (!studentIds || !Array.isArray(studentIds) || !studentIds.length) {
  return badRequestResponse(
    res,
    'studentIds must be a non-empty array',
    { field: 'studentIds', expected: 'non-empty array' }
  );
}
```

**Response:**
```json
{
  "success": false,
  "message": "studentIds must be a non-empty array",
  "error": {
    "code": "INVALID_INPUT",
    "details": {
      "field": "studentIds",
      "expected": "non-empty array"
    }
  },
  "meta": {
    "timestamp": "2026-05-14T10:30:00.000Z"
  }
}
```

---

### Example 5: Authorization Error

**Before (Inconsistent):**
```typescript
// test.service.ts
if (user.role !== 'ADMIN') {
  throw new Error('Access denied. Admin role required.');
}
```

**After (Standardized):**
```typescript
import { ErrorCode } from '../../types/api-response.types';

// test.service.ts
if (user.role !== 'ADMIN') {
  const error = new Error('Access denied. Admin role required.');
  (error as any).code = ErrorCode.FORBIDDEN;
  throw error;
}

// In controller
try {
  const test = await testService.createTest(...);
  return createdResponse(res, test);
} catch (error) {
  if ((error as any).code === ErrorCode.FORBIDDEN) {
    return forbiddenResponse(res, error.message);
  }
  return serverErrorResponse(res, error.message);
}
```

---

### Example 6: Using Async Handler

**Before (Manual try-catch):**
```typescript
export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const data = await authService.getAllUsers({ page, limit });
    res.status(200).json({ success: true, data, pagination: { page, limit } });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};
```

**After (With async handler):**
```typescript
import { asyncHandler } from '../../utils/response-helpers';
import { paginatedResponse, calculatePagination, calculateSkip, validatePagination } from '../../utils/response-helpers';
import { serverErrorResponse } from '../../utils/response-helpers';

export const getAllUsers = asyncHandler(async (req: Request, res: Response) => {
  const page = req.query.page;
  const limit = req.query.limit;

  const validation = validatePagination(page, limit);
  if (!validation.valid) {
    return badRequestResponse(res, validation.error);
  }

  const skip = calculateSkip(page, limit);
  const total = await prisma.user.count({ where: { isActive: true } });
  const data = await prisma.user.findMany({
    where: { isActive: true },
    skip,
    take: Number(limit),
    select: { id: true, email: true, role: true, instituteId: true }
  });

  const pagination = calculatePagination(page, limit, total);

  return paginatedResponse(res, data, pagination, 'Users retrieved successfully');
});
```

---

## Migration Strategy

### Phase 1: Setup (Day 1)
1. Create type definitions file: `src/types/api-response.types.ts`
2. Create response helpers file: `src/utils/response-helpers.ts`
3. Add imports to existing controllers
4. Test with one endpoint

### Phase 2: Critical Endpoints (Days 2-3)
Priority order:
1. Authentication endpoints (auth.controller.ts)
2. Test endpoints (test.controller.ts)
3. Student endpoints (student.controller.ts)
4. Institute endpoints (institute.controller.ts)

### Phase 3: Remaining Endpoints (Days 4-5)
1. Dimension endpoints
2. Question endpoints
3. Invite endpoints
4. Response endpoints
5. Report endpoints

### Phase 4: Validation (Day 6)
1. Update Swagger documentation to reflect new response formats
2. Test all endpoints
3. Update frontend API client

---

## Migration Checklist

### For Each Controller

- [ ] Import response helpers
- [ ] Replace manual `res.status().json()` with helper functions
- [ ] Update success responses to use `successResponse()` or `createdResponse()`
- [ ] Update paginated responses to use `paginatedResponse()`
- [ ] Update error responses to use specific error helpers
- [ ] Add pagination validation where applicable
- [ ] Use `calculatePagination()` for pagination metadata
- [ ] Handle Prisma errors with `handlePrismaError()`
- [ ] Consider using `asyncHandler` for error wrapping
- [ ] Test the endpoint

---

## Testing Strategy

### Unit Tests
```typescript
import { successResponse, errorResponse, ErrorCode } from '../utils/response-helpers';
import { Response } from 'express';

describe('Response Helpers', () => {
  it('should create success response', () => {
    const mockRes = { status: jest.fn().mockReturnThis(), json: jest.fn() } as any;
    successResponse(mockRes, { id: '123' }, 'Success');
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: true,
      message: 'Success',
      data: { id: '123' },
      meta: expect.objectContaining({ timestamp: expect.any(String) })
    });
  });

  it('should create error response with correct status code', () => {
    const mockRes = { status: jest.fn().mockReturnThis(), json: jest.fn() } as any;
    errorResponse(mockRes, ErrorCode.NOT_FOUND, 'Not found');
    expect(mockRes.status).toHaveBeenCalledWith(404);
  });
});
```

### Integration Tests
```typescript
describe('API Response Format', () => {
  it('should return standard success response', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.com', password: 'password' });
    
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('data');
    expect(response.body).toHaveProperty('meta');
    expect(response.body.meta).toHaveProperty('timestamp');
  });

  it('should return standard error response', async () => {
    const response = await request(app)
      .get('/api/tests/nonexistent-id');
    
    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toHaveProperty('code');
    expect(response.body.meta).toHaveProperty('timestamp');
  });
});
```

---

## Frontend Integration

### TypeScript Types for Frontend
```typescript
// Copy these types to frontend project
interface ApiResponse<T> {
  success: true;
  message: string;
  data: T;
  meta: {
    timestamp: string;
    requestId?: string;
  };
}

interface ApiErrorResponse {
  success: false;
  message: string;
  error: {
    code: string;
    details?: any;
  };
  meta: {
    timestamp: string;
  };
}

interface PaginatedResponse<T> extends ApiResponse<T[]> {
  meta: {
    timestamp: string;
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNextPage: boolean;
      hasPreviousPage: boolean;
    };
  };
}
```

### Frontend API Client Helper
```typescript
async function apiRequest<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(url, options);
  const result = await response.json();

  if (!result.success) {
    throw new Error(result.message || 'API request failed');
  }

  return result.data;
}

// Usage
const tests = await apiRequest<Test[]>('/api/tests?page=1&limit=10');
```

---

## Benefits of Standardization

### For Backend
- **Consistency:** All endpoints return the same format
- **Type Safety:** TypeScript types prevent format errors
- **Reduced Boilerplate:** Helper functions reduce code duplication
- **Better Error Handling:** Standardized error codes
- **Easier Testing:** Predictable response structures

### For Frontend
- **Type Safety:** Can generate TypeScript types from contracts
- **Error Handling:** Consistent error structure across all endpoints
- **Pagination:** Standard pagination metadata
- **Debugging:** Request IDs for tracing
- **Documentation:** Clear contracts for API consumers

---

## Common Patterns

### Pattern 1: Resource Not Found
```typescript
const resource = await prisma.test.findUnique({ where: { id } });
if (!resource) {
  return notFoundResponse(res, 'Test not found');
}
```

### Pattern 2: Validation Failure
```typescript
if (!name || !email) {
  return badRequestResponse(res, 'name and email are required', {
    missing: ['name', 'email']
  });
}
```

### Pattern 3: Authorization Check
```typescript
if (user.role !== 'ADMIN') {
  return forbiddenResponse(res, 'Admin role required');
}
```

### Pattern 4: Conflict/Duplicate
```typescript
try {
  await prisma.user.create({ data: { email } });
} catch (error) {
  if (error.code === 'P2002') {
    return conflictResponse(res, 'Email already exists');
  }
  throw error;
}
```

### Pattern 5: Business Rule Violation
```typescript
if (test.status === 'PUBLISHED') {
  return unprocessableEntityResponse(
    res,
    'Cannot modify published test',
    { currentStatus: test.status }
  );
}
```

---

## Troubleshooting

### Issue: TypeScript errors with response helpers
**Solution:** Ensure you're importing from the correct path and types are exported properly.

### Issue: Pagination not working
**Solution:** Use `validatePagination()` before `calculatePagination()` to ensure valid inputs.

### Issue: Error codes not mapping to correct HTTP status
**Solution:** Check `ErrorCodeToHttpStatus` mapping in `api-response.types.ts`.

### Issue: Stack traces appearing in production
**Solution:** Stack traces only appear when `NODE_ENV === 'development'`. Ensure production environment variable is set.

---

## Next Steps

1. Review this guide with the development team
2. Create a branch for response standardization
3. Start with Phase 1 (Setup)
4. Follow the migration checklist
5. Update Swagger documentation
6. Coordinate with frontend team for integration
7. Monitor for any issues during rollout

---

*Prepared by Winston, System Architect*
