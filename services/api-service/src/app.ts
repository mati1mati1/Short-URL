import express from "express";
import type { Request, Response } from "express";
import linkRouter from "./routes/link.routes.js";
import logsRouter from "./routes/logs.routes.js";
import { startTracing, logger, metricsMiddleware } from "@short/observability";
import { httpLogger } from "./middlewares/http-logger.js";
import { errorHandler, notFoundHandler } from "./middlewares/error-handler.js";

export async function buildApp() {
  const app = express();

  app.use(express.json());
  app.use(httpLogger);
  app.use(metricsMiddleware);
  app.use("/api/links", linkRouter);
  app.use("/logs", logsRouter);

  app.get("/metrics", async (req: Request, res: Response) => {
    const client = await import("prom-client");
    res.set("Content-Type", client.default.register.contentType);
    res.end(await client.default.register.metrics());
  });

  app.get("/health", (_req: Request, res: Response) => {
    logger.info("Health check requested");
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export async function buildTracedApp(serviceName = "api-service") {
  await startTracing(serviceName);
  return buildApp();
}
