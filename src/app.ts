import express from 'express';
import { json } from 'body-parser';
import errorMiddleware from './middleware/error.middleware';
import prisma from './prisma/client';

export const app = express();
const PORT = process.env.PORT || 3000;

app.use(json());

app.use(errorMiddleware);

const startServer = async () => {
    try {
        await prisma.$connect();
        app.listen(PORT, () => {
            console.log(`Server is running on http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error('Failed to connect to the database:', error);
        process.exit(1);
    }
};

startServer();