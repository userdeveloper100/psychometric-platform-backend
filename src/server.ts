import app from "./app";
import prisma from "./config/prisma";

const PORT = process.env.PORT || 5001;

const startServer = async () => {
    try {
        await prisma.$connect();

        app.listen(PORT, () => {
            console.log(`Server running on http://localhost:${PORT}`);
            console.log(`Swagger docs at http://localhost:${PORT}/api-docs`);
        });

    } catch (error) {
        console.error("Database connection failed:", error);
        process.exit(1);
    }
};

startServer();