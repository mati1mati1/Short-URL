import { context, trace } from "@opentelemetry/api";
import type { Request, Response, NextFunction } from "express";

export function traceHeadersMiddleware(_req: Request, res: Response, next: NextFunction) {
  const span = trace.getSpan(context.active());
  const ctx = span?.spanContext();
  if (ctx) {
    res.setHeader("x-trace-id", ctx.traceId);
    res.setHeader("x-span-id", ctx.spanId);
  }
  next();
}
