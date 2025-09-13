import 'dotenv/config';
import { Pool } from 'pg';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

export async function ping() {
  const { rows } = await pool.query('SELECT NOW() as now');
  return rows[0].now as Date;
}
