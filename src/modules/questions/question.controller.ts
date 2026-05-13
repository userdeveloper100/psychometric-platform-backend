import { Request, Response } from 'express';
import * as questionService from './question.service';
import { AuthRequest } from '../../middleware/auth.middleware';

export const createQuestion = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const { dimensionId } = req.params;
        const { text, scaleMin, scaleMax } = req.body;

        if (!dimensionId) {
            res.status(400).json({ success: false, message: 'dimensionId is required' });
            return;
        }

        if (!text || typeof text !== 'string') {
            res.status(400).json({ success: false, message: 'text is required' });
            return;
        }

        const question = await questionService.createQuestion(dimensionId, {
            text,
            scaleMin,
            scaleMax
        });

        res.status(201).json({
            success: true,
            message: 'Question created successfully',
            data: question
        });
    } catch (err: any) {
        const message = err?.message || 'Failed to create question';
        const status = message === 'Dimension not found' ? 404 : 400;
        res.status(status).json({ success: false, message });
    }
};

export const getDimensionQuestions = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const { dimensionId } = req.params;

        if (!dimensionId) {
            res.status(400).json({ success: false, message: 'dimensionId is required' });
            return;
        }

        const questions = await questionService.getDimensionQuestions(dimensionId);

        res.status(200).json({
            success: true,
            message: 'Questions fetched successfully',
            data: questions
        });
    } catch (err: any) {
        const message = err?.message || 'Failed to fetch questions';
        const status = message === 'Dimension not found' ? 404 : 500;
        res.status(status).json({ success: false, message });
    }
};

export const getAllQuestions = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 10;

        if (page < 1 || limit < 1) {
            res.status(400).json({
                success: false,
                message: 'page and limit must be positive integers'
            });
            return;
        }

        const data = await questionService.getAllQuestions({ page, limit });

        res.status(200).json({
            success: true,
            data,
            pagination: {
                page,
                limit
            }
        });
    } catch (err: any) {
        res.status(500).json({
            success: false,
            message: err?.message || 'Failed to fetch questions'
        });
    }
};

export const deleteQuestion = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const { id } = req.params;
        const userId = req.user?.userId;

        if (!id) {
            res.status(400).json({ success: false, message: 'question id is required' });
            return;
        }

        if (!userId) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }

        const deleted = await questionService.deleteQuestion(id, userId);

        res.status(200).json({
            success: true,
            message: 'Question deleted successfully',
            data: deleted
        });
    } catch (err: any) {
        const message = err?.message || 'Failed to delete question';
        const status = message === 'Question not found' ? 404 : 400;
        res.status(status).json({ success: false, message });
    }
};
