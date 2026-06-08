import app from "./app";
import prisma from "./config/prisma";
import { connectRedis, disconnectRedis } from "./config/redis";

const PORT = process.env.PORT || 5001;

const startServer = async () => {
    try {
        await prisma.$connect();

        // Non-fatal: app runs even if Redis is unavailable (cache/rate-limit
        // degrade to no-ops).
        await connectRedis();

        const server = app.listen(PORT, () => {
            console.log(`Server running on http://localhost:${PORT}`);
            console.log(`Swagger docs at http://localhost:${PORT}/api-docs`);
        });

        const shutdown = async (signal: string) => {
            console.log(`${signal} received — shutting down gracefully`);
            server.close();
            await disconnectRedis();
            await prisma.$disconnect();
            process.exit(0);
        };

        process.on("SIGTERM", () => shutdown("SIGTERM"));
        process.on("SIGINT", () => shutdown("SIGINT"));
    } catch (error) {
        console.error("Database connection failed:", error);
        process.exit(1);
    }
};

startServer();
