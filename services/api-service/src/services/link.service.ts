import { createHash, randomBytes } from "node:crypto";
import { pool } from "../db.js";
import type { Link } from "../modules/link.js"
import { redis } from "../redis.js";
import { logger } from "@short/observability";

export function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex");
}

async function generateSlug(length = 7): Promise<string> {
  logger.info({ length }, "Generating unique slug");
  
  for (let i = 0; i < 3; i++) {
      const slug = randomBytes(Math.ceil(length / 2))
        .toString("hex")
        .slice(0, length);    
      
      logger.debug({ slug, attempt: i + 1 }, "Checking slug availability");
      const { rows } = await pool.query(
        "SELECT 1 FROM links WHERE slug = $1",
        [slug]
      );
      
      if (rows.length === 0) {
        logger.info({ slug }, "Generated unique slug");
        return slug;
      }
      
      logger.warn({ slug, attempt: i + 1 }, "Slug already exists, retrying");
  }
  
  logger.error({ length }, "Failed to generate unique slug after 3 attempts");
  throw new Error("Failed to generate unique slug after 3 attempts");
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
  
  const slug = await generateSlug(7);

  try {
    const result = await pool.query(
      `INSERT INTO links (id, slug, target_url, expires_at, is_active, created_ip_hash)
       VALUES (gen_random_uuid(), $1, $2, $3, COALESCE($4, true), $5)
       RETURNING slug, target_url::text, expires_at::text, is_active`,
      [
        slug,
        input.target_url,
        input.expires_at ?? null,
        input.is_active ?? true,
        input.created_ip_hash ?? null
      ]
    );

    const link = result.rows[0];
    logger.info({ slug, target_url: input.target_url }, "Successfully created link in database");
    return link;
  } catch (error: any) {
    logger.error({ error: error.message, target_url: input.target_url }, "Failed to create link in database");
    throw error;
  }
}


export async function resolveLink(slug: string) {
  logger.info({ slug }, "Resolving link from cache or database");
  
  const cacheKey = `s:${slug}`;

  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      logger.info({ slug }, `Cache hit for ${slug}`);
      return JSON.parse(cached);
    }

    logger.debug({ slug }, "Cache miss, querying database");
    const { rows } = await pool.query(
      `SELECT slug, target_url, expires_at, is_active
       FROM links
       WHERE slug = $1
         AND is_active = true
         AND (expires_at IS NULL OR expires_at > now())`,
      [slug]
    );

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
      await redis.set(cacheKey, JSON.stringify(cacheValue), { EX: cacheTTL() });
      logger.debug({ slug }, "Cached link for future requests");
    }
    
    return cacheValue;
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
