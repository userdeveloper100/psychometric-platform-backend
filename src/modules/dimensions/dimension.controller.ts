import { Request, Response } from 'express';
import * as dimensionService from './dimension.service';

export const createDimension = async (req: Request, res: Response) => {
    try {
        const { testId } = req.params;
        const dimension = await dimensionService.createDimension(testId, req.body);
        res.status(201).json(dimension);
    } catch (err: any) {
        res.status(400).json({ message: err.message });
    }
};
