<<<<<<< HEAD
import express from "express";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./config/swagger";
import routes from "./routes";
import errorMiddleware from "./middleware/error.middleware";

const app = express();

app.use(express.json());

// Swagger
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// routes
app.use("/api", routes);

// error handler
app.use(errorMiddleware);

export default app;
=======
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
>>>>>>> 11519917377035306673a076a7e613f111ba9d8f
