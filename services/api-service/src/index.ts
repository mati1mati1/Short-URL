import "dotenv/config";
import express from "express";
import type { Request, Response } from "express";
import linkRouter from "./routes/link.routes.js";
import logsRouter from "./routes/logs.routes.js";
import { startTracing, logger } from "@short/observability";

await startTracing("api-service");
const app = express();
const PORT = process.env.PORT ?? 3000;

app.use(express.json());
app.use("/links", linkRouter);
app.use("/logs", logsRouter);

// Metrics endpoint
app.get("/metrics", async (req: Request, res: Response) => {
  const client = await import("prom-client");
  res.set("Content-Type", client.default.register.contentType);
  res.end(await client.default.register.metrics());
});

app.listen(PORT, () => {
  logger.info(`Server running at http://localhost:${PORT}`);
});
