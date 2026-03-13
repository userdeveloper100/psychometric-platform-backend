import { Request, Response } from 'express';
import * as testService from './test.service';

export const createTest = async (req: Request, res: Response) => {
    try {
        const test = await testService.createTest(req.body);
        res.status(201).json(test);
    } catch (err: any) {
        res.status(400).json({ message: err.message });
    }
};

export const getTests = async (req: Request, res: Response) => {
    try {
        const tests = await testService.getTests();
        res.json(tests);
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};

export const publishTest = async (req: Request, res: Response) => {
    try {
        const test = await testService.publishTest(req.params.id);
        res.json(test);
    } catch (err: any) {
        res.status(400).json({ message: err.message });
    }
};
