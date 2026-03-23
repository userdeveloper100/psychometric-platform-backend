import { Request, Response } from 'express';
import * as dimensionService from './dimension.service';

export const createDimension = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const { testId } = req.params;
        const { name, description } = req.body;

        if (!testId) {
            res.status(400).json({ success: false, message: 'testId is required' });
            return;
        }

        if (!name || !description) {
            res.status(400).json({
                success: false,
                message: 'name and description are required'
            });
            return;
        }

        const dimension = await dimensionService.createDimension(testId, {
            name,
            description
        });

        res.status(201).json({
            success: true,
            message: 'Dimension created successfully',
            data: dimension
        });
    } catch (err: any) {
        const message = err?.message || 'Failed to create dimension';
        const status = message === 'Test not found' ? 404 : 400;
        res.status(status).json({ success: false, message });
    }
};

export const getTestDimensions = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const { testId } = req.params;

        if (!testId) {
            res.status(400).json({ success: false, message: 'testId is required' });
            return;
        }

        const dimensions = await dimensionService.getTestDimensions(testId);

        res.status(200).json({
            success: true,
            message: 'Dimensions fetched successfully',
            data: dimensions
        });
    } catch (err: any) {
        const message = err?.message || 'Failed to fetch dimensions';
        const status = message === 'Test not found' ? 404 : 500;
        res.status(status).json({ success: false, message });
    }
};

<<<<<<< HEAD
export const getAllDimensions = async (
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

        const data = await dimensionService.getAllDimensions({ page, limit });

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
            message: err?.message || 'Failed to fetch dimensions'
        });
    }
};

=======
>>>>>>> 11519917377035306673a076a7e613f111ba9d8f
export const deleteDimension = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const { id } = req.params;

        if (!id) {
            res.status(400).json({ success: false, message: 'dimension id is required' });
            return;
        }

        const deleted = await dimensionService.deleteDimension(id);

        res.status(200).json({
            success: true,
            message: 'Dimension deleted successfully',
            data: deleted
        });
    } catch (err: any) {
        const message = err?.message || 'Failed to delete dimension';
        const status = message === 'Dimension not found' ? 404 : 400;
        res.status(status).json({ success: false, message });
    }
};
