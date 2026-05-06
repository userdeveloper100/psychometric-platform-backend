import { Request, Response } from 'express';
import * as authService from './auth.service';
import { AuthRequest } from '../../middleware/auth.middleware';

export const register = async (req: Request, res: Response): Promise<void> => {
    try {
        const { instituteName, email, password } = req.body;

        // Validate required fields
        if (!instituteName || !email || !password) {
            res.status(400).json({
                success: false,
                message: 'instituteName, email and password are required'
            });
            return;
        }

        // Extract user context for createdBy (if authenticated)
        const authReq = req as AuthRequest;
        const createdBy = authReq.user?.userId;

        // Call registerInstituteAdmin from auth service
        const result = await authService.registerInstituteAdmin({
            instituteName,
            email,
            password,
            createdBy
        });

        // Return token and user info
        res.status(201).json({
            success: true,
            message: 'Institute admin registered successfully',
            data: result.user
        });
    } catch (err: any) {
        res.status(400).json({ message: err.message });
    }
};

export const login = async (req: Request, res: Response) => {
    try {
        const result = await authService.login(req.body);
        res.json(result);
    } catch (err: any) {
        res.status(401).json({ message: err.message });
    }
};

export const getAllUsers = async (req: Request, res: Response): Promise<void> => {
    try {
        // Check if user is admin
        const authReq = req as AuthRequest;
        if (!authReq.user || authReq.user.role !== 'ADMIN') {
            res.status(403).json({
                success: false,
                message: 'Access denied. Admin role required.'
            });
            return;
        }

        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 10;

        // Validate pagination params
        if (page < 1 || limit < 1) {
            res.status(400).json({
                success: false,
                message: 'page and limit must be positive integers'
            });
            return;
        }

        const users = await authService.getAllUsers({ page, limit });

        res.status(200).json({
            success: true,
            message: 'Users fetched successfully',
            data: users,
            pagination: {
                page,
                limit
            }
        });
    } catch (err: any) {
        res.status(500).json({
            success: false,
            message: err.message || 'Failed to fetch users'
        });
    }
};
