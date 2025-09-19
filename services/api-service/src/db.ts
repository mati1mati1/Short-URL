import 'dotenv/config';
import { Pool } from 'pg';
import { logger } from '@short/observability';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Log database connection events
pool.on('connect', () => {
  logger.info('✅ New database client connected');
});

pool.on('error', (err) => {
  logger.error({ error: err.message }, '❌ Database pool error');
});

export async function ping() {
  try {
    logger.debug('Pinging database');
    const { rows } = await pool.query('SELECT NOW() as now');
    logger.info('✅ Database ping successful');
    return rows[0].now as Date;
  } catch (error: any) {
    logger.error({ error: error.message }, '❌ Database ping failed');
    throw error;
  }
}
