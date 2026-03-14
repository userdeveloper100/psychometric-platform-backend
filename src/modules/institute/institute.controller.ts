import { Request, Response } from 'express';
import * as instituteService from './institute.service';

// ─── Create Institute ─────────────────────────────────────────────────────────

export const createInstitute = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const { name, email } = req.body;

        // Validate required fields
        if (!name || !email) {
            res.status(400).json({
                success: false,
                message: 'name and email are required'
            });
            return;
        }

        const institute = await instituteService.createInstitute({ name, email });

        res.status(201).json({
            success: true,
            message: 'Institute created successfully',
            data: institute
        });
    } catch (err: any) {
        if (err.message === 'Institute with this email already exists') {
            res.status(409).json({
                success: false,
                message: err.message
            });
            return;
        }
        res.status(400).json({
            success: false,
            message: err.message || 'Failed to create institute'
        });
    }
};

// ─── Get All Institutes (Paginated) ──────────────────────────────────────────

export const getInstitutes = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const search = (req.query.search as string) || '';

        // Validate pagination params
        if (page < 1 || limit < 1) {
            res.status(400).json({
                success: false,
                message: 'page and limit must be positive integers'
            });
            return;
        }

        // Cap limit to 100 to prevent large queries
        const safeLimitCap = Math.min(limit, 100);

        const result = await instituteService.getInstitutes({
            page,
            limit: safeLimitCap,
            search
        });

        res.status(200).json({
            success: true,
            message: 'Institutes fetched successfully',
            data: result.data,
            meta: result.meta
        });
    } catch (err: any) {
        res.status(500).json({
            success: false,
            message: err.message || 'Failed to fetch institutes'
        });
    }
};

// ─── Get Institute By ID ──────────────────────────────────────────────────────

export const getInstituteById = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const { id } = req.params;

        // Validate ID presence
        if (!id) {
            res.status(400).json({
                success: false,
                message: 'Institute ID is required'
            });
            return;
        }

        const institute = await instituteService.getInstituteById(id);

        res.status(200).json({
            success: true,
            message: 'Institute fetched successfully',
            data: institute
        });
    } catch (err: any) {
        if (err.message === 'Institute not found') {
            res.status(404).json({
                success: false,
                message: err.message
            });
            return;
        }
        res.status(500).json({
            success: false,
            message: err.message || 'Failed to fetch institute'
        });
    }
};

const getUserId = (req: Request): string => {
    const user = (req as any).user;
    return user?.id || user?.userId || 'system';
};

export const updateInstitute = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = getUserId(req);

        const institute = await instituteService.updateInstitute(id, req.body, userId);

        return res.status(200).json({
            success: true,
            message: 'Institute updated successfully',
            data: institute
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to update institute';
        return res.status(400).json({ success: false, message });
    }
};

export const deleteInstitute = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = getUserId(req);

        await instituteService.deleteInstitute(id, userId);

        return res.status(200).json({
            success: true,
            message: 'Institute deleted successfully'
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to delete institute';
        return res.status(400).json({ success: false, message });
    }
};
