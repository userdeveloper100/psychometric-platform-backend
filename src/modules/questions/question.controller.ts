import { Request, Response } from 'express';
import * as questionService from './question.service';

export const createQuestion = async (req: Request, res: Response) => {
    try {
        const { dimensionId } = req.params;
        const question = await questionService.createQuestion(dimensionId, req.body);
        res.status(201).json(question);
    } catch (err: any) {
        res.status(400).json({ message: err.message });
    }
};
