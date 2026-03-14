import { Request, Response } from 'express';
import * as testService from './test.service';
import { TestStatus } from './test.service';

export const createTest = async (req: Request, res: Response): Promise<void> => {
    try {
        const { title, description, instituteId } = req.body;
        const user = (req as any).user;

        if (!title || !description || !instituteId) {
            res.status(400).json({
                success: false,
                message: 'title, description and instituteId are required'
            });
            return;
        }

        if (!user?.role || !user?.instituteId) {
            res.status(401).json({
                success: false,
                message: 'Unauthorized'
            });
            return;
        }

        const test = await testService.createTest({
            title,
            description,
            instituteId,
            requestedBy: {
                role: user.role,
                instituteId: user.instituteId
            }
        });

        res.status(201).json({
            success: true,
            message: 'Test created successfully',
            data: test
        });
    } catch (err: any) {
        const message = err?.message || 'Failed to create test';
        const status =
            message.includes('Only ADMIN') ? 403 :
                message.includes('own institute') ? 403 :
                    message.includes('Institute not found') ? 404 : 400;

        res.status(status).json({ success: false, message });
    }
};

export const getInstituteTests = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const instituteId =
            (req.query.instituteId as string) ||
            (req.params.instituteId as string);

        const page = parseInt(req.query.page as string) || 1;
        const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
        const search = (req.query.search as string) || '';
        const statusRaw = (req.query.status as string | undefined)?.toUpperCase();

        if (!instituteId) {
            res.status(400).json({
                success: false,
                message: 'instituteId is required'
            });
            return;
        }

        if (page < 1 || limit < 1) {
            res.status(400).json({
                success: false,
                message: 'page and limit must be positive integers'
            });
            return;
        }

        let status: TestStatus | undefined;
        if (statusRaw) {
            if (statusRaw !== TestStatus.DRAFT && statusRaw !== TestStatus.PUBLISHED) {
                res.status(400).json({
                    success: false,
                    message: 'status must be DRAFT or PUBLISHED'
                });
                return;
            }
            status = statusRaw as TestStatus;
        }

        const result = await testService.getInstituteTests({
            instituteId,
            page,
            limit,
            search,
            status
        });

        res.status(200).json({
            success: true,
            message: 'Tests fetched successfully',
            data: result.data,
            meta: result.meta
        });
    } catch (err: any) {
        res.status(500).json({
            success: false,
            message: err?.message || 'Failed to fetch tests'
        });
    }
};

export const publishTest = async (req: Request, res: Response): Promise<void> => {
    try {
        const testId = req.params.id;
        const instituteId =
            (req.body.instituteId as string) ||
            ((req as any).user?.instituteId as string);
        const user = (req as any).user;

        if (!testId) {
            res.status(400).json({
                success: false,
                message: 'test id is required'
            });
            return;
        }

        if (!user?.role || !user?.instituteId || !instituteId) {
            res.status(401).json({
                success: false,
                message: 'Unauthorized'
            });
            return;
        }

        const test = await testService.publishTest({
            testId,
            instituteId,
            requestedBy: {
                role: user.role,
                instituteId: user.instituteId
            }
        });

        res.status(200).json({
            success: true,
            message: 'Test published successfully',
            data: test
        });
    } catch (err: any) {
        const message = err?.message || 'Failed to publish test';
        const status =
            message.includes('Only ADMIN') ? 403 :
                message.includes('own institute') ? 403 :
                    message.includes('Test not found') ? 404 :
                        message.includes('already published') ? 409 : 400;

        res.status(status).json({ success: false, message });
    }
};
