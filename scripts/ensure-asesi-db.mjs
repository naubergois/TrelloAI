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

  const { createHash, randomBytes, scryptSync } = await import("node:crypto");
  const adminEmail = (process.env.ADMIN_EMAIL || "admin@cge.ce.gov.br").trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || "Jangada@Admin";
  const adminName = (process.env.ADMIN_NAME || "Administrador").trim() || "Administrador";
  const adminUsername = (process.env.ADMIN_USERNAME || "admin").trim().toLowerCase() || "admin";
  await client.query(
    `UPDATE users SET username = split_part(email, '@', 1) WHERE username IS NULL OR btrim(username) = ''`,
  );
  const existingAdmin = await client.query("SELECT 1 FROM users WHERE email = $1 OR lower(coalesce(username,'')) = $2", [
    adminEmail,
    adminUsername,
  ]);
  let adminSeeded = false;
  if ((existingAdmin.rowCount ?? 0) === 0) {
    const salt = randomBytes(16).toString("hex");
    const passwordHash = scryptSync(adminPassword, salt, 64).toString("hex");
    const id = createHash("sha256").update(`jangada-admin:${adminEmail}`).digest("hex").slice(0, 24);
    await client.query(
      `INSERT INTO users (id, email, name, password_hash, salt, role, username)
       VALUES ($1, $2, $3, $4, $5, 'admin', $6)
       ON CONFLICT (email) DO NOTHING`,
      [id, adminEmail, adminName, passwordHash, salt, adminUsername],
    );
    adminSeeded = true;
  } else {
    await client.query(
      `UPDATE users SET username = $2 WHERE email = $1 AND (username IS NULL OR btrim(username) = '')`,
      [adminEmail, adminUsername],
    );
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        database: ping.rows[0].db,
        schema: ping.rows[0].schema,
        tables: tables.rows.map((r) => r.table_name),
        adminEmail,
        adminUsername,
        adminSeeded,
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
