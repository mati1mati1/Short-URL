import { createHash } from "node:crypto";
import type { Span } from "@opentelemetry/api";
import { SpanStatusCode, trace } from "@opentelemetry/api";
import { pool } from "../db.js";
import type { Link } from "../modules/link.js";
import { redis } from "../redis.js";
import { logger } from "@short/observability";
import { generateSlug } from "../utils/slug.js";

const tracer = trace.getTracer("api-service");

async function withSpan<T>(name: string, fn: (span: Span) => Promise<T>): Promise<T> {
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

export function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex");
}

function fromCacheValue(value: { u: string; x?: string | null; a: boolean }) {
  return {
    u: value.u,
    expires_at: value.x ?? null,
    is_active: value.a,
  };
}

function cacheTTL(): number {
  const base = 60 * 60 * 24; 
  const jitter = Math.floor(Math.random() * 300); 
  return base + jitter;
}


export async function createLink(input: {
  target_url: string;
  expires_at?: string | null;
  is_active?: boolean;
  created_ip_hash?: string | null;
  title?: string | null;
}): Promise<Link> {
  logger.info({ target_url: input.target_url }, "Creating new link in database");
  for (let i = 0; i < 3; i++) {
    logger.info({ length: 7 }, "Generating unique slug");
    const slug = generateSlug(7);

    const result = await pool.query(
      `INSERT INTO links (id, slug, target_url, expires_at, is_active, created_ip_hash)
       VALUES (gen_random_uuid(), $1, $2, $3, COALESCE($4, true), $5)
       ON CONFLICT (slug) DO NOTHING
       RETURNING slug, target_url::text, expires_at::text, is_active`,
      [slug, input.target_url, input.expires_at ?? null, input.is_active ?? true, input.created_ip_hash ?? null]
    );

    if (result.rowCount === 1) {
      logger.info({ slug, target_url: input.target_url }, "Successfully created link in database");
      return result.rows[0];
    }

    logger.warn({ slug, attempt: i + 1 }, "Slug collision, retrying");
  }
  throw new Error("Failed to create link after 3 attempts");
}


export async function resolveLink(slug: string) {
  logger.info({ slug }, "Resolving link from cache or database");
  
  const cacheKey = `s:${slug}`;

  try {
    const cached = await withSpan("redis.get", () => redis.get(cacheKey));
    if (cached) {
      logger.info({ slug }, `Cache hit for ${slug}`);
      return fromCacheValue(JSON.parse(cached));
    }

    logger.debug({ slug }, "Cache miss, querying database");
    const { rows } = await withSpan("db.select", (span) => {
      span.setAttribute("db.system", "postgresql");
      span.setAttribute("db.operation", "select");
      span.setAttribute("db.table", "links");
      span.setAttribute(
        "db.statement",
        "SELECT slug, target_url, expires_at, is_active FROM links WHERE slug = $1",
      );

      return pool.query(
        `SELECT slug, target_url, expires_at, is_active
         FROM links
         WHERE slug = $1`,
        [slug],
      );
    });

    if (rows.length === 0) {
      logger.info({ slug }, "Link not found or inactive/expired");
      return null;
    }

    const link = rows[0];
    logger.info({ slug, target_url: link.target_url }, "Found active link in database");

    const cacheValue = {
      u: link.target_url,
      x: link.expires_at,
      a: link.is_active
    };

    if (link.is_active && (!link.expires_at || new Date(link.expires_at) > new Date())) {
      await withSpan("redis.set", () =>
        redis.set(cacheKey, JSON.stringify(cacheValue), { EX: cacheTTL() }),
      );
      logger.debug({ slug }, "Cached link for future requests");
    }

    return {
      u: link.target_url,
      expires_at: link.expires_at,
      is_active: link.is_active,
    };
  } catch (error: any) {
    logger.error({ error: error.message, slug }, "Failed to resolve link");
    throw error;
  }
}
export async function getLinkBySlug(slug: string): Promise<Link> {
  logger.info({ slug }, "Getting link by slug from database");
  
  try {
    const { rows } = await pool.query<Link>(
      `SELECT id::text, slug, target_url, created_at::text, expires_at::text, is_active, created_ip_hash
         FROM links
        WHERE slug = $1`,
      [slug]
    );
    
    const result = rows[0] || null;
    if (result) {
      logger.info({ slug }, "Successfully retrieved link by slug");
    } else {
      logger.info({ slug }, "Link not found by slug");
    }
    
    return result;
  } catch (error: any) {
    logger.error({ error: error.message, slug }, "Failed to get link by slug");
    throw error;
  }
}


export async function listLinks(): Promise<Link[]> {
  const { rows } = await pool.query<Link>(
    `SELECT id::text, slug, target_url, created_at::text, expires_at::text, is_active, created_ip_hash
       FROM links
      ORDER BY created_at DESC`
  );
  return rows;
}

export async function updateLink(slug: string, patch: Partial<Pick<Link, "target_url" | "expires_at" | "is_active">>): Promise<Link | undefined> {
  const { rows } = await pool.query<Link>(
    `UPDATE links
        SET target_url = COALESCE($2, target_url),
            expires_at = COALESCE($3, expires_at),
            is_active  = COALESCE($4, is_active)
      WHERE slug = $1
      RETURNING id::text, slug, target_url, created_at::text, expires_at::text, is_active, created_ip_hash`,
    [slug, patch.target_url ?? null, patch.expires_at ?? null, patch.is_active ?? null]
  );
  await redis.del(`s:${slug}`);
  return rows[0];
}

export async function deleteBySlug(slug: string): Promise<boolean> {
  const { rowCount } = await pool.query(`DELETE FROM links WHERE slug = $1`, [slug]);
  await redis.del(`s:${slug}`);
  return rowCount === 1;
}
