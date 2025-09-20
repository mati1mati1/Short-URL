import "dotenv/config";
import { logger } from "@short/observability";
import { buildTracedApp } from "./app.js";

const PORT = process.env.PORT ?? 3000;

logger.info("🚀 Starting API service...");

const app = await buildTracedApp();

app.listen(PORT, () => {
  logger.info(`Server running at http://localhost:${PORT}`);
});
