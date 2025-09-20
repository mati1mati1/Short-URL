import "dotenv/config";
import express from "express";
import axios, { AxiosError } from "axios";
import { API_BASE_URL, API_TIMEOUT_MS, PORT } from "./env.js";
import { startTracing, logger, metricsMiddleware } from "@short/observability";

await startTracing("redirect-service");
const app = express();

logger.info("🚀 Starting redirect service...");
app.use((req, res, next) => {
  const start = Date.now();
  
  logger.info({
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    slug: req.params.slug
  }, `${req.method} ${req.url} - Request received`);

  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any, cb?: any) {
    const duration = Date.now() - start;
    
    logger.info({
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip
    }, `${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`);
    
    return originalEnd.call(this, chunk, encoding, cb);
  };

  next();
});

app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error({
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method
  }, "Unhandled error in redirect service");
  
  res.status(500).send("Internal server error");
});

app.get("/healthz", (_req, res) => {
  logger.debug("Health check requested");
  res.status(200).send("ok");
});


app.get("/:slug", async (req, res) => {
  const slug = (req.params.slug || "").trim();
  logger.info({ slug, userAgent: req.get('User-Agent'), ip: req.ip }, "Processing redirect request");
  
  if (!slug || slug.length > 16) {
    logger.warn({ slug }, "Invalid slug provided");
    return res.status(400).send("invalid slug");
  }

  try {
    const url = `${API_BASE_URL}/api/links/${encodeURIComponent(slug)}/resolve`;
    logger.info({ slug, apiUrl: url }, "Calling API service for redirect");
    
    const r = await axios.get(url, {
      timeout: API_TIMEOUT_MS,
      maxRedirects: 0,     
      validateStatus: () => true 
    });
    
    logger.info({ 
      slug, 
      status: r.status, 
      hasLocation: !!r.headers.location,
      contentType: r.headers["content-type"]
    }, `API response received for slug ${slug}`);
    
    if ((r.status === 302 || r.status === 301) && r.headers.location) {
      logger.info({ slug, targetUrl: r.headers.location }, `Redirecting to ${r.headers.location}`);
      return res.redirect(302, r.headers.location);
    }

    if (r.status === 200 && r.headers["content-type"]?.includes("application/json")) {
      const u = (r.data && (r.data.u || r.data.target_url)) as string | undefined;
      if (u) {
        logger.info({ slug, targetUrl: u }, `Redirecting to URL from JSON response`);
        return res.redirect(302, u);
      }
      logger.warn({ slug, responseData: r.data }, "JSON response but no valid URL found");
    }

    if (r.status === 404) {
      logger.info({ slug }, "Link not found in API");
      return res.status(404).send("not found");
    }

    logger.warn({ slug, status: r.status, data: r.data }, "Unexpected API response");
    return res.status(502).send("bad gateway");
  } catch (e) {
    const err = e as AxiosError;
    logger.error({ 
      slug, 
      error: err.message, 
      code: err.code,
      responseStatus: err.response?.status 
    }, "Error calling API service");
    
    if (err.response) {
      const status = err.response.status;
      if (status === 404) {
        logger.info({ slug }, "API returned 404 for slug");
        return res.status(404).send("not found");
      }
      logger.warn({ slug, status }, "API error response");
      return res.status(502).send("bad gateway");
    }
    
    logger.error({ slug, error: err.message }, "Network/timeout error calling API");
    return res.status(502).send("bad gateway");
  }
});
app.use(metricsMiddleware);
app.get("/metrics", async (req, res) => {
  logger.debug("Metrics endpoint requested");
  const client = await import("prom-client");
  res.set("Content-Type", client.default.register.contentType);
  res.end(await client.default.register.metrics());
});

app.listen(PORT, () => {
  logger.info({ port: PORT, apiBaseUrl: API_BASE_URL }, `🚀 Redirect service listening on :${PORT} → API ${API_BASE_URL}`);
});
