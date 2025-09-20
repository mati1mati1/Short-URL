import "dotenv/config";
import express from "express";
import type { Request, Response, NextFunction } from "express";
import { startTracing, logger, metricsMiddleware } from "@short/observability";
import { resolveSlug } from "./link-resolver.js";

export const PORT = Number(process.env.REDIRECT_PORT ?? 8081);

await startTracing("redirect-service");
const app = express();

logger.info("🚀 Starting redirect service...");

app.use((req, res, next) => {
  const start = Date.now();

  logger.info(
    {
      method: req.method,
      url: req.url,
      userAgent: req.get("User-Agent"),
      ip: req.ip,
      slug: req.params.slug,
    },
    `${req.method} ${req.url} - Request received`,
  );

  const originalEnd = res.end;
  res.end = function endOverride(chunk?: any, encoding?: any, cb?: any) {
    const duration = Date.now() - start;

    logger.info(
      {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        ip: req.ip,
      },
      `${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`,
    );

    return originalEnd.call(this, chunk, encoding, cb);
  };

  next();
});

app.use(metricsMiddleware);

app.get("/healthz", (_req, res) => {
  logger.debug("Health check requested");
  res.status(200).send("ok");
});

app.get("/:slug", async (req, res) => {
  const slug = (req.params.slug || "").trim();
  logger.info({ slug, userAgent: req.get("User-Agent"), ip: req.ip }, "Processing redirect request");

  if (!slug || slug.length > 16) {
    logger.warn({ slug }, "Invalid slug provided");
    return res.status(400).send("invalid slug");
  }

  try {
    const link = await resolveSlug(slug);
    if (!link) {
      logger.info({ slug }, "Slug not found in storage");
      return res.status(404).send("not found");
    }

    const expiresAt = link.expires_at ? new Date(link.expires_at) : null;
    if (expiresAt && expiresAt <= new Date()) {
      logger.info({ slug, expires_at: link.expires_at }, "Link has expired");
      return res.status(410).send("link expired");
    }

    if (!link.is_active) {
      logger.info({ slug }, "Link is inactive");
      return res.status(403).send("link inactive");
    }

    res.setHeader("Cache-Control", "private, max-age=0, no-cache");
    logger.info({ slug, targetUrl: link.target_url }, `Redirecting ${slug} → ${link.target_url}`);
    return res.redirect(302, link.target_url);
  } catch (error: any) {
    logger.error({ error: error.message, slug }, "Failed to resolve slug");
    return res.status(502).send("bad gateway");
  }
});

app.get("/metrics", async (_req, res) => {
  logger.debug("Metrics endpoint requested");
  const client = await import("prom-client");
  res.set("Content-Type", client.default.register.contentType);
  res.end(await client.default.register.metrics());
});

app.use((error: Error, req: Request, res: Response, _next: NextFunction) => {
  logger.error(
    {
      error: error.message,
      stack: error.stack,
      url: req.url,
      method: req.method,
    },
    "Unhandled error in redirect service",
  );

  res.status(500).send("Internal server error");
});

app.listen(PORT, () => {
  logger.info({ port: PORT }, `🚀 Redirect service listening on :${PORT}`);
});
