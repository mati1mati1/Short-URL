import * as pinoHttpNS from "pino-http";
import type { Request, Response } from "express";
import { createLogger } from "./logger.js";
import { randomUUID } from "node:crypto";

const pinoHttp = (pinoHttpNS as any).default ?? (pinoHttpNS as any);

export const httpLogger = pinoHttp({
  logger: createLogger(process.env.SERVICE_NAME),
  genReqId: (req: Request) => (req.headers["x-request-id"] as string) || randomUUID(),
  customProps: (_req: Request, res: Response) => ({
    trace_id: (res.getHeader("x-trace-id") as string) || undefined,
    span_id: (res.getHeader("x-span-id") as string) || undefined
  }),
  customSuccessMessage: (req: Request, res: Response) =>
    `${req.method} ${req.url} -> ${res.statusCode}`,
  customErrorMessage: (req: Request, res: Response, err: Error) =>
    `ERR ${req.method} ${req.url} -> ${res.statusCode} ${err.message}`
});
