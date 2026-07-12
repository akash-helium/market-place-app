import mysql, { type Pool, type RowDataPacket, type ResultSetHeader } from "mysql2/promise";
import { readFileSync } from "node:fs";
import { env } from "./env";

function sslOptions() {
  if (!env.DB_SSL) return undefined;
  const candidates = [
    env.DB_SSL_CA,
    "/etc/ssl/cert.pem",
    "/etc/ssl/certs/ca-certificates.crt",
    "/etc/pki/tls/certs/ca-bundle.crt",
  ];
  for (const path of candidates) {
    try {
      return {
        minVersion: "TLSv1.2" as const,
        ca: readFileSync(path),
      };
    } catch {
      /* try next */
    }
  }
  // Last resort: system trust store via Node/Bun defaults
  return { minVersion: "TLSv1.2" as const };
}

export const pool: Pool = mysql.createPool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  namedPlaceholders: true,
  timezone: "Z",
  supportBigNumbers: true,
  ssl: sslOptions(),
});

/** SELECT returning rows */
export async function query<T extends RowDataPacket = RowDataPacket>(
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  const [rows] = await pool.query<T[]>(sql, params);
  return rows;
}

/** SELECT returning a single row or null */
export async function queryOne<T extends RowDataPacket = RowDataPacket>(
  sql: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

/** INSERT/UPDATE/DELETE */
export async function execute(
  sql: string,
  params?: unknown[]
): Promise<ResultSetHeader> {
  const [result] = await pool.execute<ResultSetHeader>(sql, params as never);
  return result;
}

/** Run a set of statements inside a transaction */
export async function withTransaction<T>(
  fn: (conn: mysql.PoolConnection) => Promise<T>
): Promise<T> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
