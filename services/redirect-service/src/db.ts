import "dotenv/config";
import { Pool } from "pg";
import { logger } from "@short/observability";
import { SpanStatusCode, trace } from "@opentelemetry/api";

const tracer = trace.getTracer("redirect-service");

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
  return tracer.startActiveSpan("db.select", async (span) => {
    span.setAttribute("db.system", "postgresql");
    span.setAttribute("db.operation", "select");
    span.setAttribute("db.table", "links");
    span.setAttribute(
      "db.statement",
      "SELECT slug, target_url, expires_at, is_active FROM links WHERE slug = $1",
    );

    try {
      const { rows } = await pool.query(
        `SELECT slug, target_url, expires_at, is_active
           FROM links
          WHERE slug = $1`,
        [slug]
      );

      span.setStatus({ code: SpanStatusCode.OK });
      return rows[0] ?? null;
    } catch (error: any) {
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      throw error;
    } finally {
      span.end();
    }
  });
}
