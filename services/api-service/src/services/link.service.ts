import { createHash, randomBytes } from "node:crypto";
import { pool } from "../db.js";
import type { Link } from "../modules/link.js"
import { redis } from "../redis.js";

export function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex");
}

async function generateSlug(length = 7): Promise<string> {
  for (let i = 0; i < 3; i++) {
      const slug = randomBytes(Math.ceil(length / 2))
        .toString("hex")
        .slice(0, length);    
      const { rows } = await pool.query(
        "SELECT 1 FROM links WHERE slug = $1",
        [slug]
      );
      if (rows.length === 0) {
        return slug;
      }
  }
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
  const slug = await generateSlug(7);

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

  return result.rows[0];
}


export async function resolveLink(slug: string) {
  const cacheKey = `s:${slug}`;

  const cached = await redis.get(cacheKey);
  if (cached) {
    console.log(`Cache hit for ${slug}`);
    return JSON.parse(cached);
  }

  const { rows } = await pool.query(
    `SELECT slug, target_url, expires_at, is_active
     FROM links
     WHERE slug = $1
       AND is_active = true
       AND (expires_at IS NULL OR expires_at > now())`,
    [slug]
  );

  if (rows.length === 0) {
    return null;
  }

  const link = rows[0];

  const cacheValue = {
    u: link.target_url,
    x: link.expires_at,
    a: link.is_active
  };

  if (link.is_active && (!link.expires_at || new Date(link.expires_at) > new Date())) {
    await redis.set(cacheKey, JSON.stringify(cacheValue), { EX: cacheTTL() });
  }
  
  return cacheValue;
}
export async function getLinkBySlug(slug: string): Promise<Link> {

  const { rows } = await pool.query<Link>(
    `SELECT id::text, slug, target_url, created_at::text, expires_at::text, is_active, created_ip_hash
       FROM links
      WHERE slug = $1`,
    [slug]
  );
  return rows[0] || null;
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
