import express from "express";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./config/swagger";
import routes from "./routes";
import errorMiddleware from "./middleware/error.middleware";
import { globalRateLimiter } from "./middleware/rateLimit.middleware";

const app = express();

// Trust proxy so req.ip reflects the real client behind a load balancer.
app.set("trust proxy", 1);

app.use(express.json());

// Swagger
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// API rate limiting (fail-open when Redis is unavailable)
app.use("/api", globalRateLimiter);

// routes
app.use("/api", routes);

// error handler
app.use(errorMiddleware);

export default app;
