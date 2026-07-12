import mysql from "mysql2/promise";
import { env } from "../config/env";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(join(import.meta.dir, "schema.sql"), "utf8");

const conn = await mysql.createConnection({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  multipleStatements: true,
  ssl: env.DB_SSL
    ? { minVersion: "TLSv1.2", ca: readFileSync(env.DB_SSL_CA) }
    : undefined,
});

console.log("Running schema.sql ...");
await conn.query(sql);
await conn.end();
console.log("✅ Migration complete");
