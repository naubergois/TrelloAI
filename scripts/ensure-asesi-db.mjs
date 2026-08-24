import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv(file) {
  const envPath = path.join(root, file);
  if (!fs.existsSync(envPath)) return;
  for (const raw of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const eq = line.indexOf("=");
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

loadEnv(".env.local");
loadEnv(".env");

const schema = (process.env.PG_SCHEMA || "trelloai").toLowerCase();
if (!/^[a-z][a-z0-9_]{0,62}$/.test(schema)) {
  throw new Error(`PG_SCHEMA inválido: ${schema}`);
}

const sslRaw = (process.env.PG_SSL || process.env.PGSSLMODE || "").toLowerCase();
const ssl = ["1", "true", "require", "on"].includes(sslRaw)
  ? { rejectUnauthorized: false }
  : false;

const config = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl,
      connectionTimeoutMillis: 8000,
    }
  : {
      host: process.env.PG_HOST,
      port: Number(process.env.PG_PORT || 5432),
      database: process.env.PG_DATABASE,
      user: process.env.PG_USER,
      password: process.env.PG_PASSWORD,
      ssl,
      connectionTimeoutMillis: 8000,
    };

if (!config.connectionString && !(config.host && config.database && config.user && config.password)) {
  console.error("Configure PG_* ou DATABASE_URL em .env.local (ver docs/ASESI_DATABASE.md).");
  process.exit(1);
}

const sql = fs.readFileSync(path.join(root, "infra", "asesi-schema.sql"), "utf8");
const client = new pg.Client(config);

try {
  await client.connect();
  await client.query(`SET search_path TO ${schema}, public`);
  await client.query(sql);
  const ping = await client.query("SELECT current_database() AS db, current_schema() AS schema");
  const tables = await client.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = $1 ORDER BY 1`,
    [schema],
  );
  console.log(
    JSON.stringify(
      {
        ok: true,
        database: ping.rows[0].db,
        schema: ping.rows[0].schema,
        tables: tables.rows.map((r) => r.table_name),
      },
      null,
      2,
    ),
  );
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
} finally {
  await client.end().catch(() => null);
}
