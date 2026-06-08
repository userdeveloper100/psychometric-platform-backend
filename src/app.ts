import express from "express";
import cors, { CorsOptions } from "cors";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./config/swagger";
import routes from "./routes";
import errorMiddleware from "./middleware/error.middleware";
import { globalRateLimiter } from "./middleware/rateLimit.middleware";

const app = express();

// Trust proxy so req.ip reflects the real client behind a load balancer.
app.set("trust proxy", 1);

// CORS: comma-separated allowlist via CORS_ORIGINS (e.g.
// "http://localhost:5173,https://app.example.com"). Defaults to "*" (reflect
// any origin) for local development.
const allowedOrigins = (process.env.CORS_ORIGINS || "*")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

const corsOptions: CorsOptions = {
    origin:
        allowedOrigins.includes("*")
            ? true
            : (origin, callback) => {
                  // Allow non-browser clients (curl, server-to-server) with no Origin header.
                  if (!origin || allowedOrigins.includes(origin)) {
                      return callback(null, true);
                  }
                  return callback(new Error(`Origin ${origin} not allowed by CORS`));
              },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));

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
