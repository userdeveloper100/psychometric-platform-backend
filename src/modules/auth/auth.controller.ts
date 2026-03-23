import { Request, Response } from 'express';
import * as authService from './auth.service';

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

        // Call registerInstituteAdmin from auth service
        const result = await authService.registerInstituteAdmin({
            instituteName,
            email,
            password
        });

        // Return token and user info
        res.status(201).json({
            success: true,
            message: 'Institute admin registered successfully',
            data: {
                token: result.token,
            }
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
