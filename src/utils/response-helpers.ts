/**
 * Reusable Response Helper Architecture
 * 
 * Provides consistent, type-safe response builders for all API endpoints.
 * Eliminates response format inconsistencies and reduces boilerplate code.
 */

import { Response } from 'express';
import {
  ApiResponse,
  ApiErrorResponse,
  PaginatedResponse,
  PaginationMeta,
  ResponseMeta,
  ErrorCode,
  ErrorCodeToHttpStatus,
} from '../types/api-response.types';

// ============================================================================
// RESPONSE BUILDER FUNCTIONS
// ============================================================================

/**
 * Build a standard success response
 * 
 * @param res - Express Response object
 * @param data - Response data payload
 * @param message - Success message
 * @param statusCode - HTTP status code (default: 200)
 * @param meta - Optional response metadata
 */
export const successResponse = <T>(
  res: Response,
  data: T,
  message: string = 'Operation successful',
  statusCode: number = 200,
  meta?: ResponseMeta
): Response => {
  const response: ApiResponse<T> = {
    success: true,
    message,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta,
    },
  };

  return res.status(statusCode).json(response);
};

/**
 * Build a paginated success response
 * 
 * @param res - Express Response object
 * @param data - Array of response data
 * @param pagination - Pagination metadata
 * @param message - Success message
 * @param statusCode - HTTP status code (default: 200)
 * @param meta - Optional additional response metadata
 */
export const paginatedResponse = <T>(
  res: Response,
  data: T[],
  pagination: PaginationMeta,
  message: string = 'Data retrieved successfully',
  statusCode: number = 200,
  meta?: ResponseMeta
): Response => {
  const response: PaginatedResponse<T> = {
    success: true,
    message,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      pagination,
      ...meta,
    },
  };

  return res.status(statusCode).json(response);
};

/**
 * Build a standard error response
 * 
 * @param res - Express Response object
 * @param errorCode - Standardized error code
 * @param message - Error message
 * @param details - Optional error details
 * @param statusCode - HTTP status code (auto-mapped from error code if not provided)
 * @param meta - Optional response metadata
 */
export const errorResponse = (
  res: Response,
  errorCode: ErrorCode,
  message: string,
  details?: any,
  statusCode?: number,
  meta?: ResponseMeta
): Response => {
  const httpStatus = statusCode ?? ErrorCodeToHttpStatus[errorCode];

  const response: ApiErrorResponse = {
    success: false,
    message,
    error: {
      code: errorCode,
      details,
      // Include stack trace only in development
      ...(process.env.NODE_ENV === 'development' && { 
        stack: new Error().stack 
      }),
    },
    meta: {
      timestamp: new Date().toISOString(),
      ...meta,
    },
  };

  return res.status(httpStatus).json(response);
};

// ============================================================================
// CONVENIENCE WRAPPERS FOR COMMON SCENARIOS
// ============================================================================

/**
 * 201 Created response
 */
export const createdResponse = <T>(
  res: Response,
  data: T,
  message: string = 'Resource created successfully'
): Response => {
  return successResponse(res, data, message, 201);
};

/**
 * 204 No Content response
 */
export const noContentResponse = (res: Response): Response => {
  return res.status(204).send();
};

/**
 * 400 Bad Request response
 */
export const badRequestResponse = (
  res: Response,
  message: string = 'Bad request',
  details?: any
): Response => {
  return errorResponse(res, ErrorCode.INVALID_INPUT, message, details);
};

/**
 * 401 Unauthorized response
 */
export const unauthorizedResponse = (
  res: Response,
  message: string = 'Unauthorized',
  details?: any
): Response => {
  return errorResponse(res, ErrorCode.UNAUTHORIZED, message, details);
};

/**
 * 403 Forbidden response
 */
export const forbiddenResponse = (
  res: Response,
  message: string = 'Access denied',
  details?: any
): Response => {
  return errorResponse(res, ErrorCode.FORBIDDEN, message, details);
};

/**
 * 404 Not Found response
 */
export const notFoundResponse = (
  res: Response,
  message: string = 'Resource not found',
  details?: any
): Response => {
  return errorResponse(res, ErrorCode.NOT_FOUND, message, details);
};

/**
 * 409 Conflict response
 */
export const conflictResponse = (
  res: Response,
  message: string = 'Resource conflict',
  details?: any
): Response => {
  return errorResponse(res, ErrorCode.CONFLICT, message, details);
};

/**
 * 422 Unprocessable Entity response
 */
export const unprocessableEntityResponse = (
  res: Response,
  message: string = 'Unprocessable entity',
  details?: any
): Response => {
  return errorResponse(res, ErrorCode.BUSINESS_RULE_VIOLATION, message, details);
};

/**
 * 500 Internal Server Error response
 */
export const serverErrorResponse = (
  res: Response,
  message: string = 'Internal server error',
  details?: any
): Response => {
  return errorResponse(res, ErrorCode.INTERNAL_SERVER_ERROR, message, details);
};

// ============================================================================
// PAGINATION HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate pagination metadata from query parameters
 * 
 * @param page - Page number from query
 * @param limit - Limit per page from query
 * @param total - Total number of records
 * @returns Pagination metadata object
 */
export const calculatePagination = (
  page: number | string,
  limit: number | string,
  total: number
): PaginationMeta => {
  const currentPage = Math.max(1, Number(page) || 1);
  const currentLimit = Math.min(100, Math.max(1, Number(limit) || 10));
  const totalPages = Math.ceil(total / currentLimit);

  return {
    page: currentPage,
    limit: currentLimit,
    total,
    totalPages,
    hasNextPage: currentPage < totalPages,
    hasPreviousPage: currentPage > 1,
  };
};

/**
 * Calculate skip value for Prisma pagination
 * 
 * @param page - Page number
 * @param limit - Limit per page
 * @returns Skip value for Prisma
 */
export const calculateSkip = (
  page: number | string,
  limit: number | string
): number => {
  const currentPage = Math.max(1, Number(page) || 1);
  const currentLimit = Math.min(100, Math.max(1, Number(limit) || 10));
  return (currentPage - 1) * currentLimit;
};

/**
 * Validate pagination parameters
 * 
 * @param page - Page number from query
 * @param limit - Limit per page from query
 * @returns Validation result
 */
export const validatePagination = (
  page: number | string,
  limit: number | string
): { valid: boolean; error?: string } => {
  const pageNum = Number(page);
  const limitNum = Number(limit);

  if (isNaN(pageNum) || pageNum < 1) {
    return { valid: false, error: 'page must be a positive integer' };
  }

  if (isNaN(limitNum) || limitNum < 1) {
    return { valid: false, error: 'limit must be a positive integer' };
  }

  if (limitNum > 100) {
    return { valid: false, error: 'limit cannot exceed 100' };
  }

  return { valid: true };
};

// ============================================================================
// ERROR HANDLING HELPERS
// ============================================================================

/**
 * Convert Prisma errors to standard error codes
 * 
 * @param error - Prisma error object
 * @returns Mapped error code and message
 */
export const handlePrismaError = (error: any): { code: ErrorCode; message: string } => {
  // Prisma unique constraint violation
  if (error.code === 'P2002') {
    const field = error.meta?.target?.[0] || 'field';
    return {
      code: ErrorCode.DUPLICATE_ENTRY,
      message: `${field} already exists`,
    };
  }

  // Prisma record not found
  if (error.code === 'P2025') {
    return {
      code: ErrorCode.RESOURCE_NOT_FOUND,
      message: error.meta?.cause || 'Resource not found',
    };
  }

  // Prisma foreign key constraint violation
  if (error.code === 'P2003') {
    return {
      code: ErrorCode.INVALID_INPUT,
      message: 'Invalid reference to related resource',
    };
  }

  // Default to internal server error
  return {
    code: ErrorCode.INTERNAL_SERVER_ERROR,
    message: 'Database operation failed',
  };
};

/**
 * Wrap async controller functions with error handling
 * 
 * @param fn - Async controller function
 * @returns Wrapped controller function
 */
export const asyncHandler = (
  fn: (req: any, res: any, next?: any) => Promise<any>
) => {
  return (req: any, res: any, next: any) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// ============================================================================
// REQUEST ID GENERATION
// ============================================================================

/**
 * Generate a unique request ID for tracing
 * 
 * @returns Unique request ID
 */
export const generateRequestId = (): string => {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Add request ID to response metadata
 * 
 * @param meta - Existing metadata
 * @returns Metadata with request ID
 */
export const withRequestId = (meta?: Omit<ResponseMeta, 'timestamp'>): ResponseMeta => {
  return {
    timestamp: new Date().toISOString(),
    requestId: generateRequestId(),
    ...meta,
  };
};
