import { Request, Response } from 'express';
import * as reportService from './report.service';

export const getTestReport = async (req: Request, res: Response) => {
    try {
        const { id: testId } = req.params;
        const report = await reportService.getTestReport(testId);
        res.json(report);
    } catch (err: any) {
        res.status(400).json({ message: err.message });
    }
};
