import { Request, Response } from 'express';
import * as studentService from './student.service';
import {
    successResponse,
    createdResponse,
    badRequestResponse,
    unauthorizedResponse,
    conflictResponse,
    notFoundResponse,
    paginatedResponse,
    validatePagination,
    serverErrorResponse
} from '../../utils/response-helpers';
import { ErrorCode } from '../../types/api-response.types';

// ─── Get Students ─────────────────────────────────────────────────────────────

export const getStudents = async (
    req: Request,
    res: Response
): Promise<Response> => {
    try {
        const user = (req as any).user;
        const instituteId: string = user?.instituteId;

        if (!instituteId) {
            return unauthorizedResponse(res, 'Unauthorized');
        }

        const page = (req.query.page as string) || '1';
        const limit = (req.query.limit as string) || '10';
        const search = (req.query.search as string) || '';

        const validation = validatePagination(page, limit);
        if (!validation.valid) {
            return badRequestResponse(res, validation.error);
        }

        const result = await studentService.getStudents(instituteId, {
            page: Number(page),
            limit: Number(limit),
            search
        });

        const pagination = {
            page: Number(page),
            limit: Number(limit),
            total: result.meta.total,
            totalPages: result.meta.totalPages,
            hasNextPage: result.meta.hasNextPage,
            hasPreviousPage: result.meta.hasPreviousPage
        };

        return paginatedResponse(res, result.data, pagination, 'Students fetched successfully');
    } catch (error: any) {
        return serverErrorResponse(res, error.message || 'Failed to fetch students');
    }
};

// ─── Create Student ───────────────────────────────────────────────────────────

export const createStudent = async (
    req: Request,
    res: Response
): Promise<Response> => {
    try {
        const { name, email } = req.body;
        const user = (req as any).user;
        const instituteId: string = user?.instituteId;
        const userId: string = user?.userId;

        if (!name || !email) {
            return badRequestResponse(res, 'name and email are required', {
                required: ['name', 'email']
            });
        }

        if (!instituteId || !userId) {
            return unauthorizedResponse(res, 'Unauthorized');
        }

        const student = await studentService.createStudent(
            instituteId,
            { name, email },
            userId
        );

        return createdResponse(res, student, 'Student created successfully');
    } catch (error: any) {
        if (error.message.includes('already exists')) {
            return conflictResponse(res, error.message);
        }
        return serverErrorResponse(res, error.message || 'Failed to create student');
    }
};

// ─── Bulk Upload Students ─────────────────────────────────────────────────────

export const bulkUploadStudents = async (
    req: Request,
    res: Response
): Promise<Response> => {
    try {
        const { students } = req.body;
        const user = (req as any).user;
        const instituteId: string = user?.instituteId;
        const userId: string = user?.userId;

        if (!Array.isArray(students) || !students.length) {
            return badRequestResponse(res, 'students must be a non-empty array');
        }

        const invalid = students.some((s: any) => !s.name || !s.email);
        if (invalid) {
            return badRequestResponse(res, 'Each student must have name and email');
        }

        if (!instituteId || !userId) {
            return unauthorizedResponse(res, 'Unauthorized');
        }

        const result = await studentService.bulkUploadStudents(
            instituteId,
            students,
            userId
        );

        return createdResponse(res, {
            createdCount: result.createdCount,
            skippedCount: result.skippedCount
        }, result.message);
    } catch (error: any) {
        return serverErrorResponse(res, error.message || 'Bulk upload failed');
    }
};

// ─── Delete Student (Soft) ────────────────────────────────────────────────────

export const deleteStudent = async (
    req: Request,
    res: Response
): Promise<Response> => {
    try {
        const { id } = req.params;
        const user = (req as any).user;
        const instituteId: string = user?.instituteId;
        const userId: string = user?.userId;

        if (!id) {
            return badRequestResponse(res, 'Student ID is required');
        }

        if (!instituteId || !userId) {
            return unauthorizedResponse(res, 'Unauthorized');
        }

        const deleted = await studentService.deleteStudent(id, instituteId, userId);

        return successResponse(res, deleted, 'Student deleted successfully');
    } catch (error: any) {
        if (error.message === 'Student not found') {
            return notFoundResponse(res, error.message);
        }
        return serverErrorResponse(res, error.message || 'Failed to delete student');
    }
};
