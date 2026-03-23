<<<<<<< HEAD
import app from "./app";
import prisma from "./config/prisma";

const PORT = process.env.PORT || 5001;
=======
import express from "express";
import prisma from "./config/prisma";
import routes from "./routes";
import errorMiddleware from "./middleware/error.middleware";

const app = express();

app.use(express.json());

app.get("/health", (req, res) => {
    res.json({ status: "ok" });
});

app.use("/api", routes);

app.use(errorMiddleware);

const PORT = process.env.PORT || 5000;
>>>>>>> 11519917377035306673a076a7e613f111ba9d8f

const startServer = async () => {
    try {
        await prisma.$connect();

        app.listen(PORT, () => {
            console.log(`Server running on http://localhost:${PORT}`);
<<<<<<< HEAD
            console.log(`Swagger docs at http://localhost:${PORT}/api-docs`);
=======
>>>>>>> 11519917377035306673a076a7e613f111ba9d8f
        });

    } catch (error) {
        console.error("Database connection failed:", error);
        process.exit(1);
    }
};

startServer();