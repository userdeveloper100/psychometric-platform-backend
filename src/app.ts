import express from 'express';
import { json } from 'body-parser';
import userRoutes from './routes/user.routes';
import errorMiddleware from './middlewares/error.middleware';
import { connectToDatabase } from './prisma/client';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(json());

app.use('/api/users', userRoutes);

app.use(errorMiddleware);

const startServer = async () => {
    try {
        await connectToDatabase();
        app.listen(PORT, () => {
            console.log(`Server is running on http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error('Failed to connect to the database:', error);
        process.exit(1);
    }
};

startServer();