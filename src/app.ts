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
