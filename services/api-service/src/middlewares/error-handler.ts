import type { Request, Response, NextFunction } from "express";
import { logger } from "@short/observability";

export function errorHandler(error: Error, req: Request, res: Response, next: NextFunction) {
  logger.error({
    error: error.message,
    stack: error.stack,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  }, `Unhandled error in ${req.method} ${req.url}`);

  // Don't send stack trace in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(500).json({
    message: "Internal server error",
    ...(isDevelopment && { error: error.message, stack: error.stack })
  });
}

export function notFoundHandler(req: Request, res: Response) {
  logger.warn({
    method: req.method,
    url: req.url,
    ip: req.ip
  }, `404 - Route not found: ${req.method} ${req.url}`);
  
  res.status(404).json({
    message: "Route not found"
  });
}