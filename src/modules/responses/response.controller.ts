import { Request, Response } from 'express';
import * as responseService from './response.service';

const getUserId = (req: Request): string => {
    const user = (req as any).user;
    return user?.id || user?.userId || 'system';
};

const handleError = (res: Response, error: unknown) => {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return res.status(400).json({
        success: false,
        message
    });
};

export const submitResponses = async (req: Request, res: Response) => {
    try {
        const { token, studentId, responses } = req.body;
        const userId = getUserId(req);

        const result = await responseService.submitResponses(
            { token, studentId, responses },
            userId
        );

        return res.status(201).json(result);
    } catch (error) {
        return handleError(res, error);
    }
};

export const getStudentResponses = async (req: Request, res: Response) => {
    try {
        const { studentId } = req.params;
        const data = await responseService.getStudentResponses(studentId);

        return res.status(200).json({
            success: true,
            message: 'Student responses fetched successfully',
            data
        });
    } catch (error) {
        return handleError(res, error);
    }
};

export const getTestResponses = async (req: Request, res: Response) => {
    try {
        const { testId } = req.params;
        const data = await responseService.getTestResponses(testId);

        return res.status(200).json({
            success: true,
            message: 'Test responses fetched successfully',
            data
        });
    } catch (error) {
        return handleError(res, error);
    }
};
<<<<<<< HEAD

export const getAllResponses = async (req: Request, res: Response) => {
    try {
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 10;

        if (page < 1 || limit < 1) {
            return res.status(400).json({
                success: false,
                message: 'page and limit must be positive integers'
            });
        }

        const data = await responseService.getAllResponses({ page, limit });

        return res.status(200).json({
            success: true,
            data,
            pagination: {
                page,
                limit
            }
        });
    } catch (error) {
        return handleError(res, error);
    }
};
=======
>>>>>>> 11519917377035306673a076a7e613f111ba9d8f
