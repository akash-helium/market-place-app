import mysql from "mysql2/promise";
import { env } from "../config/env";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(join(import.meta.dir, "schema.sql"), "utf8");

function sslOptions() {
  if (!env.DB_SSL) return undefined;
  const candidates = [
    env.DB_SSL_CA,
    "/etc/ssl/cert.pem",
    "/etc/ssl/certs/ca-certificates.crt",
    "/etc/pki/tls/certs/ca-bundle.crt",
  ];
  for (const path of candidates) {
    if (path && existsSync(path)) {
      return { minVersion: "TLSv1.2" as const, ca: readFileSync(path) };
    }
  }
  // Alpine / managed hosts: trust system store
  return { minVersion: "TLSv1.2" as const };
}

console.log(`Migrating DB at ${env.DB_HOST}:${env.DB_PORT}/${env.DB_NAME} (ssl=${env.DB_SSL})…`);

const conn = await mysql.createConnection({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  multipleStatements: true,
  ssl: sslOptions(),
});

console.log("Running schema.sql ...");
await conn.query(sql);
await conn.end();
console.log("✅ Migration complete");
