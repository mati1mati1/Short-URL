import type { Request, Response, NextFunction } from "express";
import { logger } from "@short/observability";

export function httpLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  
  // Log request
  logger.info({
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    body: req.method !== 'GET' ? req.body : undefined
  }, `${req.method} ${req.url} - Request received`);

  // Override res.end to log response
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
}