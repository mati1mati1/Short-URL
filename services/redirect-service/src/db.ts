import "dotenv/config";
import { Pool } from "pg";
import { logger } from "@short/observability";

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on("connect", () => {
  logger.info("✅ Redirect service connected a new database client");
});

pool.on("error", (err) => {
  logger.error({ error: err.message }, "❌ Redirect service database pool error");
});

export async function getLinkBySlug(slug: string) {
  const { rows } = await pool.query(
    `SELECT slug, target_url, expires_at, is_active
       FROM links
      WHERE slug = $1`,
    [slug]
  );

  return rows[0] ?? null;
}
