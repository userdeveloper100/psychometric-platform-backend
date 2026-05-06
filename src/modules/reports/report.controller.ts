import { Request, Response } from 'express';
import * as reportService from './report.service';

export const getAllReports = async (req: Request, res: Response) => {
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

        const data = await reportService.getAllReports({ page, limit });

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
            message: err.message || 'Failed to fetch reports'
        });
    }
};

export const getTestReport = async (req: Request, res: Response) => {
    try {
        const { id: testId } = req.params;
        const report = await reportService.getTestReport(testId);
        res.json(report);
    } catch (err: any) {
        res.status(400).json({ message: err.message });
    }
};
