import { Request, Response } from 'express';
import * as questionService from './question.service';

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

<<<<<<< HEAD
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

=======
>>>>>>> 11519917377035306673a076a7e613f111ba9d8f
export const deleteQuestion = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const { id } = req.params;

        if (!id) {
            res.status(400).json({ success: false, message: 'question id is required' });
            return;
        }

        const deleted = await questionService.deleteQuestion(id);

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
