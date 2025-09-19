import client from "prom-client";
import type { Request, Response, NextFunction } from "express";

if (process.env.METRICS_DEFAULT !== "false") {
  client.collectDefaultMetrics();
}

export const httpDuration = new client.Histogram({
  name: "http_server_request_duration_seconds",
  help: "HTTP request duration",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.005,0.01,0.025,0.05,0.1,0.25,0.5,1,2,5]
});

export const redisOps = new client.Counter({
  name: "redis_operations_total",
  help: "Redis operations by type",
  labelNames: ["op", "result"]
});

export const dbQueries = new client.Histogram({
  name: "db_query_duration_seconds",
  help: "DB query duration",
  labelNames: ["query"],
  buckets: [0.005,0.01,0.025,0.05,0.1,0.25,0.5,1,2]
});

export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = process.hrtime.bigint();
  res.on("finish", () => {
    const dur = Number(process.hrtime.bigint() - start) / 1e9;
    httpDuration.labels(req.method, req.route?.path ?? req.path, String(res.statusCode)).observe(dur);
  });
  next();
}

export async function metricsHandler(_req: Request, res: Response) {
  res.set("Content-Type", client.register.contentType);
  res.end(await client.register.metrics());
}

export function timeDb<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const start = process.hrtime.bigint();
  return fn().finally(() => {
    const s = Number(process.hrtime.bigint() - start) / 1e9;
    dbQueries.labels(label).observe(s);
  });
}
export function countRedis(op: string, ok: boolean) {
  redisOps.labels(op, ok ? "ok" : "err").inc();
}
