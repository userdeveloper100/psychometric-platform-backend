import { Request, Response } from 'express';
import * as responseService from './response.service';

export const submitResponse = async (req: Request, res: Response) => {
    try {
        const { id: testId } = req.params;
        const { studentId, answers } = req.body;
        const result = await responseService.submitResponse(testId, studentId, answers);
        res.status(201).json(result);
    } catch (err: any) {
        res.status(400).json({ message: err.message });
    }
};
