import { Request, Response, NextFunction } from "express";
import logger from "../config/logger";

const errorMiddleware = (
    err: any,
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const statusCode = err.statusCode || 500;
    const isProduction = process.env.NODE_ENV === "production";

    // Release gate (Step 12): log the error name and message only. The raw error object is never logged,
    // and the stack is written only outside production. The request body and headers are never logged.
    logger.error("Unhandled request error", {
        name: err?.name,
        message: err?.message,
        statusCode,
        stack: isProduction ? undefined : err?.stack
    });

    // In production a 500 never reveals an internal message, such as a database error text.
    const message =
        isProduction && statusCode >= 500
            ? "Internal Server Error"
            : err.message || "Internal Server Error";

    res.status(statusCode).json({
        success: false,
        message
    });
};

export default errorMiddleware;