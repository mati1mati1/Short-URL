import type { Span } from "@opentelemetry/api";
import { SpanStatusCode, trace } from "@opentelemetry/api";
import { logger, countRedis } from "@short/observability";
import { redis } from "./redis.js";
import { getLinkBySlug } from "./db.js";

interface LinkRecord {
  target_url: string;
  expires_at: string | null;
  is_active: boolean;
}

interface CacheValue {
  u: string;
  x?: string | null;
  a: boolean;
}

const CACHE_PREFIX = "s:";
const CACHE_TTL_SECONDS = Number(process.env.CACHE_TTL_SECONDS ?? 60 * 60 * 24);
const CACHE_JITTER_MAX = Number(process.env.CACHE_JITTER_MAX ?? 300);

function cacheTTL(): number {
  const jitter = Math.floor(Math.random() * CACHE_JITTER_MAX);
  return CACHE_TTL_SECONDS + jitter;
}

function fromCache(value: CacheValue): LinkRecord {
  return {
    target_url: value.u,
    expires_at: value.x ?? null,
    is_active: value.a,
  };
}

export async function resolveSlug(slug: string): Promise<LinkRecord | null> {
  const cacheKey = `${CACHE_PREFIX}${slug}`;

  try {
    const cached = await runWithSpan("redis.get", () => redis.get(cacheKey));
    if (cached) {
      countRedis("redirect_get", true);
      try {
        const parsed = JSON.parse(cached) as CacheValue;
        logger.debug({ slug }, "Redirect cache hit");
        return fromCache(parsed);
      } catch (error) {
        logger.warn({ slug, cached }, "Redirect cache contained invalid JSON");
        await redis.del(cacheKey).catch(() => undefined);
      }
    }
  } catch (error: any) {
    countRedis("redirect_get", false);
    logger.error({ error: error.message, slug }, "Failed to read from redirect cache");
  }

  logger.debug({ slug }, "Redirect cache miss, querying database");

  try {
    const row = await getLinkBySlug(slug);
    if (!row) {
      return null;
    }

    const expiresAt = row.expires_at instanceof Date ? row.expires_at.toISOString() : row.expires_at;

    const record: LinkRecord = {
      target_url: row.target_url,
      expires_at: (expiresAt ?? null) as string | null,
      is_active: row.is_active,
    };

    try {
      const shouldCache =
        record.is_active && (!record.expires_at || new Date(record.expires_at) > new Date());
      if (shouldCache) {
        await runWithSpan("redis.set", () =>
          redis.set(cacheKey, JSON.stringify({ u: record.target_url, x: record.expires_at, a: record.is_active }), {
            EX: cacheTTL(),
          }),
        );
        countRedis("redirect_set", true);
      } else {
        await redis.del(cacheKey).catch(() => undefined);
      }
    } catch (error: any) {
      countRedis("redirect_set", false);
      logger.error({ error: error.message, slug }, "Failed to write redirect cache entry");
    }

    return record;
  } catch (error: any) {
    logger.error({ error: error.message, slug }, "Database lookup for redirect failed");
    throw error;
  }
}
const tracer = trace.getTracer("redirect-service");

async function runWithSpan<T>(name: string, fn: (span: Span) => Promise<T>): Promise<T> {
  return tracer.startActiveSpan(name, async (span) => {
    try {
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error: any) {
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error?.message });
      throw error;
    } finally {
      span.end();
    }
  });
}
