import { Request, Response } from 'express';
import * as studentService from './student.service';

// ─── Create Student ───────────────────────────────────────────────────────────

export const createStudent = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const { name, email } = req.body;
        const user = (req as any).user;
        const instituteId: string = user?.instituteId;
        const userId: string = user?.userId;

        if (!name || !email) {
            res.status(400).json({
                success: false,
                message: 'name and email are required'
            });
            return;
        }

        if (!instituteId || !userId) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }

        const student = await studentService.createStudent(
            instituteId,
            { name, email },
            userId
        );

        res.status(201).json({
            success: true,
            message: 'Student created successfully',
            data: student
        });
    } catch (err: any) {
        const message = err?.message || 'Failed to create student';
        const status = message.includes('already exists') ? 409 : 400;
        res.status(status).json({ success: false, message });
    }
};

// ─── Bulk Upload Students ─────────────────────────────────────────────────────

export const bulkUploadStudents = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const { students } = req.body;
        const user = (req as any).user;
        const instituteId: string = user?.instituteId;
        const userId: string = user?.userId;

        if (!Array.isArray(students) || !students.length) {
            res.status(400).json({
                success: false,
                message: 'students must be a non-empty array'
            });
            return;
        }

        // Validate each entry has name + email
        const invalid = students.some(
            (s: any) => !s.name || !s.email
        );
        if (invalid) {
            res.status(400).json({
                success: false,
                message: 'Each student must have name and email'
            });
            return;
        }

        if (!instituteId || !userId) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }

        const result = await studentService.bulkUploadStudents(
            instituteId,
            students,
            userId
        );

        res.status(201).json({
            success: true,
            message: result.message,
            data: {
                createdCount: result.createdCount,
                skippedCount: result.skippedCount
            }
        });
    } catch (err: any) {
        res.status(400).json({
            success: false,
            message: err?.message || 'Bulk upload failed'
        });
    }
};

// ─── Get Students ─────────────────────────────────────────────────────────────

export const getStudents = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const user = (req as any).user;
        const instituteId: string = user?.instituteId;

        if (!instituteId) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }

        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const search = (req.query.search as string) || '';

        if (page < 1 || limit < 1) {
            res.status(400).json({
                success: false,
                message: 'page and limit must be positive integers'
            });
            return;
        }

        const result = await studentService.getStudents(instituteId, {
            page,
            limit,
            search
        });

        res.status(200).json({
            success: true,
            message: 'Students fetched successfully',
            data: result.data,
            meta: result.meta
        });
    } catch (err: any) {
        res.status(500).json({
            success: false,
            message: err?.message || 'Failed to fetch students'
        });
    }
};

// ─── Delete Student (Soft) ────────────────────────────────────────────────────

export const deleteStudent = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const { id } = req.params;
        const user = (req as any).user;
        const instituteId: string = user?.instituteId;
        const userId: string = user?.userId;

        if (!id) {
            res.status(400).json({ success: false, message: 'Student ID is required' });
            return;
        }

        if (!instituteId || !userId) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }

        const deleted = await studentService.deleteStudent(id, instituteId, userId);

        res.status(200).json({
            success: true,
            message: 'Student deleted successfully',
            data: deleted
        });
    } catch (err: any) {
        const message = err?.message || 'Failed to delete student';
        const status = message === 'Student not found' ? 404 : 400;
        res.status(status).json({ success: false, message });
    }
};
