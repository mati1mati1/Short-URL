import "dotenv/config";
import express from "express";
import type { Request, Response } from "express";
import linkRouter from "./routes/link.routes.js";
import logsRouter from "./routes/logs.routes.js";
import { startTracing, logger } from "@short/observability";
import { httpLogger } from "./middlewares/http-logger.js";
import { errorHandler, notFoundHandler } from "./middlewares/error-handler.js";

await startTracing("api-service");
const app = express();
const PORT = process.env.PORT ?? 3000;

logger.info("🚀 Starting API service...");

app.use(express.json());
app.use(httpLogger);
app.use("/links", linkRouter);
app.use("/logs", logsRouter);

// Metrics endpoint
app.get("/metrics", async (req: Request, res: Response) => {
  const client = await import("prom-client");
  res.set("Content-Type", client.default.register.contentType);
  res.end(await client.default.register.metrics());
});

// Health check endpoint
app.get("/health", (req: Request, res: Response) => {
  logger.info("Health check requested");
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// 404 handler
app.use(notFoundHandler);

// Error handler (must be last)
app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`Server running at http://localhost:${PORT}`);
});
