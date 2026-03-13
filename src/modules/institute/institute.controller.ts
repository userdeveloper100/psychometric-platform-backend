import { Request, Response } from 'express';
import * as instituteService from './institute.service';

export const createInstitute = async (req: Request, res: Response) => {
    try {
        const institute = await instituteService.createInstitute(req.body);
        res.status(201).json(institute);
    } catch (err: any) {
        res.status(400).json({ message: err.message });
    }
};
