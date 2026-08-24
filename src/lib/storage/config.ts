export const DEFAULT_PG_SCHEMA = "trelloai";
export const DEFAULT_PG_HOST = "192.168.3.26";
export const DEFAULT_PG_PORT = 5432;
export const DEFAULT_PG_DATABASE = "h_asesi";

const SCHEMA_RE = /^[a-z][a-z0-9_]{0,62}$/;

export type PgSsl = false | { rejectUnauthorized: boolean };

export type PgConnectionConfig = {
  connectionString?: string;
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  ssl: PgSsl;
  schema: string;
  max: number;
  connectionTimeoutMillis: number;
};

export function sanitizePgSchema(raw: string | undefined, fallback = DEFAULT_PG_SCHEMA): string {
  const schema = (raw || fallback).trim().toLowerCase();
  if (!SCHEMA_RE.test(schema)) {
    throw new Error(`PG_SCHEMA inválido: ${raw}`);
  }
  return schema;
}

type EnvMap = Record<string, string | undefined>;

export function isPgConfigured(env: EnvMap = process.env): boolean {
  if (env.DATABASE_URL?.trim()) return true;
  return Boolean(
    env.PG_HOST?.trim() && env.PG_DATABASE?.trim() && env.PG_USER?.trim() && env.PG_PASSWORD,
  );
}

function readSsl(env: EnvMap): PgSsl {
  const raw = (env.PG_SSL || env.PGSSLMODE || "").trim().toLowerCase();
  if (["1", "true", "require", "on"].includes(raw)) {
    return { rejectUnauthorized: false };
  }
  return false;
}

export function readPgConfig(env: EnvMap = process.env): PgConnectionConfig | null {
  if (!isPgConfigured(env)) return null;

  const schema = sanitizePgSchema(env.PG_SCHEMA || env.PG_TRELLOAI_SCHEMA);
  const ssl = readSsl(env);
  const max = Math.max(1, Number(env.PG_POOL_MAX || 5) || 5);
  const connectionTimeoutMillis = Math.max(1000, Number(env.PG_CONNECT_TIMEOUT_MS || 8000) || 8000);

  if (env.DATABASE_URL?.trim()) {
    return {
      connectionString: env.DATABASE_URL.trim(),
      ssl,
      schema,
      max,
      connectionTimeoutMillis,
    };
  }

  return {
    host: env.PG_HOST!.trim(),
    port: Number(env.PG_PORT || DEFAULT_PG_PORT) || DEFAULT_PG_PORT,
    database: env.PG_DATABASE!.trim(),
    user: env.PG_USER!.trim(),
    password: env.PG_PASSWORD,
    ssl,
    schema,
    max,
    connectionTimeoutMillis,
  };
}
