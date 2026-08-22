import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Parse NUMERIC / DECIMAL (1700) as float so calculations return JS numbers
pg.types.setTypeParser(1700, (val: string) => (val === null ? null : parseFloat(val)));
// Parse BIGINT (20) as integer
pg.types.setTypeParser(20, (val: string) => (val === null ? null : parseInt(val, 10)));

const host = process.env.PGHOST || 'localhost';
const port = Number(process.env.PGPORT) || 5432;
const user = process.env.PGUSER || 'postgres';
const password = process.env.PGPASSWORD || 'root';
const database = process.env.PGDATABASE || 'distributor_db';

/**
 * Ensure target database exists; if not, create it via admin connection
 */
export async function ensureDatabaseExists(): Promise<void> {
  if (process.env.DATABASE_URL) {
    return;
  }
  const adminClient = new pg.Client({
    host,
    port,
    user,
    password,
    database: 'postgres',
  });

  try {
    await adminClient.connect();
    const res = await adminClient.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [database]
    );
    if (res.rowCount === 0) {
      console.log(`Database "${database}" not found. Creating it now...`);
      // Escape database name safely
      await adminClient.query(`CREATE DATABASE "${database.replace(/"/g, '""')}"`);
      console.log(`Database "${database}" created successfully.`);
    }
  } catch (err: any) {
    console.warn('Database existence check note:', err.message);
  } finally {
    try {
      await adminClient.end();
    } catch {}
  }
}

export const pool = process.env.DATABASE_URL
  ? new pg.Pool({ connectionString: process.env.DATABASE_URL })
  : new pg.Pool({
      host,
      port,
      user,
      password,
      database,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
});

export async function query<T extends pg.QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<pg.QueryResult<T>> {
  return pool.query<T>(text, params);
}

export async function runTransaction<T>(
  fn: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
