import { Request, Response } from 'express';
import * as inviteService from './invite.service';

// ─── Invite Students ──────────────────────────────────────────────────────────

export const inviteStudents = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const { testId } = req.params;
        const { studentIds } = req.body;
        const user = (req as any).user;
        const userId: string = user?.userId;
        const instituteId: string = user?.instituteId;

        if (!testId) {
            res.status(400).json({ success: false, message: 'testId is required' });
            return;
        }

        if (!Array.isArray(studentIds) || !studentIds.length) {
            res.status(400).json({
                success: false,
                message: 'studentIds must be a non-empty array'
            });
            return;
        }

        if (!userId || !instituteId) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }

        const result = await inviteService.inviteStudents(
            testId,
            studentIds,
            userId,
            instituteId
        );

        res.status(201).json({
            success: true,
            message: `${result.created} student(s) invited, ${result.skipped} skipped`,
            data: result
        });
    } catch (err: any) {
        const message = err?.message || 'Failed to invite students';
        const status =
            message.includes('not found') ? 404 :
                message.includes('access denied') ? 403 : 400;
        res.status(status).json({ success: false, message });
    }
};

// ─── Get Invites for a Test ───────────────────────────────────────────────────

export const getTestInvites = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const { testId } = req.params;
        const user = (req as any).user;
        const instituteId: string = user?.instituteId;

        if (!testId) {
            res.status(400).json({ success: false, message: 'testId is required' });
            return;
        }

        if (!instituteId) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }

        const invites = await inviteService.getTestInvites(testId, instituteId);

        res.status(200).json({
            success: true,
            message: 'Test invites fetched successfully',
            data: invites
        });
    } catch (err: any) {
        const message = err?.message || 'Failed to fetch test invites';
        const status =
            message.includes('not found') ? 404 :
                message.includes('access denied') ? 403 : 500;
        res.status(status).json({ success: false, message });
    }
};

// ─── Get Invites for a Student ────────────────────────────────────────────────

export const getStudentInvites = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const { studentId } = req.params;
        const user = (req as any).user;
        const instituteId: string = user?.instituteId;

        if (!studentId) {
            res.status(400).json({ success: false, message: 'studentId is required' });
            return;
        }

        if (!instituteId) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }

        const invites = await inviteService.getStudentInvites(
            studentId,
            instituteId
        );

        res.status(200).json({
            success: true,
            message: 'Student invites fetched successfully',
            data: invites
        });
    } catch (err: any) {
        const message = err?.message || 'Failed to fetch student invites';
        const status =
            message.includes('not found') ? 404 :
                message.includes('access denied') ? 403 : 500;
        res.status(status).json({ success: false, message });
    }
};

// ─── Soft Delete Invite ───────────────────────────────────────────────────────

export const deleteInvite = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const { id } = req.params;
        const user = (req as any).user;
        const userId: string = user?.userId;
        const instituteId: string = user?.instituteId;

        if (!id) {
            res.status(400).json({ success: false, message: 'Invite ID is required' });
            return;
        }

        if (!userId || !instituteId) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }

        const deleted = await inviteService.deleteInvite(id, userId, instituteId);

        res.status(200).json({
            success: true,
            message: 'Invite deleted successfully',
            data: deleted
        });
    } catch (err: any) {
        const message = err?.message || 'Failed to delete invite';
        const status =
            message.includes('not found') ? 404 :
                message.includes('access denied') ? 403 :
                    message.includes('completed') ? 409 : 400;
        res.status(status).json({ success: false, message });
    }
};