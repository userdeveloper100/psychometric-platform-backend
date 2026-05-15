/**
 * Standard API Response Contracts
 * 
 * These contracts ensure consistent response formats across all API endpoints,
 * making the backend frontend-friendly and scalable.
 */

// ============================================================================
// BASE RESPONSE CONTRACTS
// ============================================================================

/**
 * Standard success response wrapper
 * All successful API responses should follow this structure
 */
export interface ApiResponse<T = any> {
  success: true;
  message: string;
  data: T;
  meta?: ResponseMeta;
}

/**
 * Standard error response wrapper
 * All error responses should follow this structure
 */
export interface ApiErrorResponse {
  success: false;
  message: string;
  error: {
    code: string;
    details?: any;
    stack?: string; // Only in development
  };
  meta?: ResponseMeta;
}

/**
 * Response metadata for additional context
 */
export interface ResponseMeta {
  timestamp: string;
  requestId?: string;
  version?: string;
}

/**
 * Pagination metadata for list responses
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/**
 * Paginated response wrapper
 * Use this for all list endpoints
 */
export interface PaginatedResponse<T = any> extends ApiResponse<T[]> {
  meta: ResponseMeta & {
    pagination: PaginationMeta;
  };
}

// ============================================================================
// ERROR CODE CONTRACTS
// ============================================================================

/**
 * Standardized error codes for consistent error handling
 */
export enum ErrorCode {
  // Validation Errors (4xx)
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_FORMAT = 'INVALID_FORMAT',
  
  // Authentication Errors (401)
  UNAUTHORIZED = 'UNAUTHORIZED',
  INVALID_TOKEN = 'INVALID_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  MISSING_TOKEN = 'MISSING_TOKEN',
  
  // Authorization Errors (403)
  FORBIDDEN = 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  RESOURCE_ACCESS_DENIED = 'RESOURCE_ACCESS_DENIED',
  
  // Not Found Errors (404)
  NOT_FOUND = 'NOT_FOUND',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  INSTITUTE_NOT_FOUND = 'INSTITUTE_NOT_FOUND',
  TEST_NOT_FOUND = 'TEST_NOT_FOUND',
  
  // Conflict Errors (409)
  CONFLICT = 'CONFLICT',
  DUPLICATE_ENTRY = 'DUPLICATE_ENTRY',
  EMAIL_ALREADY_EXISTS = 'EMAIL_ALREADY_EXISTS',
  RESOURCE_ALREADY_EXISTS = 'RESOURCE_ALREADY_EXISTS',
  
  // Business Logic Errors (422)
  BUSINESS_RULE_VIOLATION = 'BUSINESS_RULE_VIOLATION',
  INVALID_STATE_TRANSITION = 'INVALID_STATE_TRANSITION',
  OPERATION_NOT_ALLOWED = 'OPERATION_NOT_ALLOWED',
  
  // Rate Limiting (429)
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  
  // Server Errors (5xx)
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
}

// ============================================================================
// HTTP STATUS CODE MAPPINGS
// ============================================================================

/**
 * Maps error codes to appropriate HTTP status codes
 */
export const ErrorCodeToHttpStatus: Record<ErrorCode, number> = {
  // Validation Errors - 400
  [ErrorCode.VALIDATION_ERROR]: 400,
  [ErrorCode.INVALID_INPUT]: 400,
  [ErrorCode.MISSING_REQUIRED_FIELD]: 400,
  [ErrorCode.INVALID_FORMAT]: 400,
  
  // Authentication Errors - 401
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.INVALID_TOKEN]: 401,
  [ErrorCode.TOKEN_EXPIRED]: 401,
  [ErrorCode.MISSING_TOKEN]: 401,
  
  // Authorization Errors - 403
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.INSUFFICIENT_PERMISSIONS]: 403,
  [ErrorCode.RESOURCE_ACCESS_DENIED]: 403,
  
  // Not Found Errors - 404
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.RESOURCE_NOT_FOUND]: 404,
  [ErrorCode.USER_NOT_FOUND]: 404,
  [ErrorCode.INSTITUTE_NOT_FOUND]: 404,
  [ErrorCode.TEST_NOT_FOUND]: 404,
  
  // Conflict Errors - 409
  [ErrorCode.CONFLICT]: 409,
  [ErrorCode.DUPLICATE_ENTRY]: 409,
  [ErrorCode.EMAIL_ALREADY_EXISTS]: 409,
  [ErrorCode.RESOURCE_ALREADY_EXISTS]: 409,
  
  // Business Logic Errors - 422
  [ErrorCode.BUSINESS_RULE_VIOLATION]: 422,
  [ErrorCode.INVALID_STATE_TRANSITION]: 422,
  [ErrorCode.OPERATION_NOT_ALLOWED]: 422,
  
  // Rate Limiting - 429
  [ErrorCode.RATE_LIMIT_EXCEEDED]: 429,
  
  // Server Errors - 500
  [ErrorCode.INTERNAL_SERVER_ERROR]: 500,
  [ErrorCode.DATABASE_ERROR]: 500,
  [ErrorCode.EXTERNAL_SERVICE_ERROR]: 502,
  [ErrorCode.SERVICE_UNAVAILABLE]: 503,
};

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Union type for all possible API responses
 */
export type AnyApiResponse<T = any> = ApiResponse<T> | ApiErrorResponse;

/**
 * Extract data type from ApiResponse
 */
export type ApiResponseData<T> = T extends ApiResponse<infer U> ? U : never;

/**
 * Extract error details from ApiErrorResponse
 */
export type ApiErrorDetails = ApiErrorResponse['error'];
