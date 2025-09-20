import type { NextFunction, Request, Response } from "express";
import { redis } from "../redis.js";
import { logger, countRedis } from "@short/observability";

const DEFAULT_LIMIT = Number(process.env.RATE_LIMIT_CREATE_LIMIT ?? 30);
const DEFAULT_WINDOW_SECONDS = Number(process.env.RATE_LIMIT_CREATE_WINDOW_SECONDS ?? 600);

function normalizeIp(ip?: string | null): string | null {
  if (!ip) return null;
  if (ip === "::1") return "127.0.0.1";
  return ip.startsWith("::ffff:") ? ip.slice(7) : ip;
}

export async function rateLimitCreate(req: Request, res: Response, next: NextFunction) {
  const ipHeader = (req.headers["x-real-ip"] as string) || (req.headers["x-forwarded-for"] as string);
  const ip = normalizeIp(ipHeader?.split(",")[0]?.trim() || req.ip || req.socket.remoteAddress);

  if (!ip) {
    logger.warn({ ipHeader }, "Rate limiter could not determine client IP");
    return next();
  }

  const limit = DEFAULT_LIMIT;
  const windowSeconds = DEFAULT_WINDOW_SECONDS;
  const key = `rl:create:${ip}`;

  try {
    const replies = await redis
      .multi()
      .incr(key)
      .expire(key, windowSeconds, "NX")
      .exec();

    countRedis("rate_limit_incr", true);

    const requestCount = Number(replies?.[0] ?? 0);

    if (Number.isNaN(requestCount)) {
      logger.warn({ key, replies }, "Rate limiter received non-numeric counter");
      return next();
    }

    if (requestCount > limit) {
      const ttl = await redis.ttl(key);
      countRedis("rate_limit_block", true);
      logger.warn({ ip, requestCount, limit }, "Rate limit exceeded for IP");
      if (ttl > 0) {
        res.setHeader("Retry-After", String(ttl));
      }
      return res.status(429).json({ message: "Rate limit exceeded. Please try again later." });
    }

    next();
  } catch (error: any) {
    countRedis("rate_limit_error", false);
    logger.error({ error: error.message, ip }, "Rate limiter failed; allowing request");
    next();
  }
}
