import type { Pool, PoolConfig } from "pg";
import type { BoardSnapshot } from "@/lib/board-snapshot";
import type { BoardInvite } from "@/lib/invites";
import type { StoredUser } from "@/lib/users";
import { createAsesiBoardSnapshot } from "@/lib/asesi-seed";
import { ASESI_BOARD_ID } from "@/lib/constants";
import { isPgConfigured, readPgConfig } from "@/lib/storage/config";

export { isPgConfigured, readPgConfig };

let pool: Pool | null = null;
let schemaReady = false;
let activeSchema = "trelloai";

function ident(schema: string) {
  return `"${schema.replace(/"/g, "")}"`;
}

function poolConfig(): PoolConfig {
  const cfg = readPgConfig();
  if (!cfg) {
    throw new Error(
      "PostgreSQL ASESI não configurado (DATABASE_URL ou PG_HOST/PG_DATABASE/PG_USER/PG_PASSWORD).",
    );
  }
  activeSchema = cfg.schema;
  const common: PoolConfig = {
    max: cfg.max,
    connectionTimeoutMillis: cfg.connectionTimeoutMillis,
    ssl: cfg.ssl,
    options: `-c search_path=${cfg.schema},public`,
  };
  if (cfg.connectionString) {
    return { ...common, connectionString: cfg.connectionString };
  }
  return {
    ...common,
    host: cfg.host,
    port: cfg.port,
    database: cfg.database,
    user: cfg.user,
    password: cfg.password,
  };
}

async function getPool(): Promise<Pool | null> {
  if (!isPgConfigured()) return null;
  if (!pool) {
    const { Pool: PgPool } = await import("pg");
    pool = new PgPool(poolConfig());
  }
  if (!schemaReady) {
    await ensureSchema(pool);
    schemaReady = true;
  }
  return pool;
}

function ddl(schema: string) {
  const s = ident(schema);
  return `
    CREATE SCHEMA IF NOT EXISTS ${s};

    CREATE TABLE IF NOT EXISTS ${s}.board_snapshots (
      board_id TEXT PRIMARY KEY,
      snapshot JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS ${s}.board_memberships (
      email TEXT NOT NULL,
      board_id TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (email, board_id)
    );

    CREATE TABLE IF NOT EXISTS ${s}.users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS ${s}.invites (
      token TEXT PRIMARY KEY,
      board_id TEXT NOT NULL,
      board_title TEXT NOT NULL,
      created_by_email TEXT NOT NULL,
      created_by_name TEXT NOT NULL,
      invitee_email TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      used_by_email TEXT,
      accepted_emails JSONB NOT NULL DEFAULT '[]'::jsonb
    );

    CREATE INDEX IF NOT EXISTS invites_board_id_idx ON ${s}.invites (board_id);
    CREATE INDEX IF NOT EXISTS memberships_board_id_idx ON ${s}.board_memberships (board_id);
  `;
}

async function ensureSchema(p: Pool) {
  const schema = readPgConfig()?.schema || activeSchema;
  await p.query(ddl(schema));

  const existing = await p.query("SELECT 1 FROM board_snapshots WHERE board_id = $1", [
    ASESI_BOARD_ID,
  ]);
  if ((existing.rowCount ?? 0) === 0) {
    const snapshot = createAsesiBoardSnapshot();
    await p.query(
      `INSERT INTO board_snapshots (board_id, snapshot, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (board_id) DO NOTHING`,
      [ASESI_BOARD_ID, JSON.stringify(snapshot)],
    );
  }
}

export async function pgPing(): Promise<{
  ok: boolean;
  configured: boolean;
  schema?: string;
  database?: string;
  host?: string;
  error?: string;
}> {
  const cfg = readPgConfig();
  if (!cfg) {
    return { ok: false, configured: false, error: "PostgreSQL não configurado" };
  }
  try {
    const p = await getPool();
    if (!p) return { ok: false, configured: true, error: "pool indisponível" };
    const res = await p.query<{ schema: string; db: string }>(
      "SELECT current_schema() AS schema, current_database() AS db",
    );
    return {
      ok: true,
      configured: true,
      schema: res.rows[0]?.schema || cfg.schema,
      database: res.rows[0]?.db || cfg.database,
      host: cfg.host,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "falha na conexão";
    return {
      ok: false,
      configured: true,
      schema: cfg.schema,
      database: cfg.database,
      host: cfg.host,
      error: message,
    };
  }
}

export async function pgGetBoard(boardId: string): Promise<BoardSnapshot | null> {
  const p = await getPool();
  if (!p) return null;
  const res = await p.query<{ snapshot: BoardSnapshot }>(
    "SELECT snapshot FROM board_snapshots WHERE board_id = $1",
    [boardId],
  );
  return res.rows[0]?.snapshot ?? null;
}

export async function pgSaveBoard(snapshot: BoardSnapshot) {
  const p = await getPool();
  if (!p) return false;
  await p.query(
    `INSERT INTO board_snapshots (board_id, snapshot, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (board_id) DO UPDATE SET snapshot = $2::jsonb, updated_at = NOW()`,
    [snapshot.board.id, JSON.stringify(snapshot)],
  );
  return true;
}

export async function pgListBoardsForEmail(email: string): Promise<BoardSnapshot[]> {
  const p = await getPool();
  if (!p) return [];
  const key = email.trim().toLowerCase();
  const res = await p.query<{ snapshot: BoardSnapshot }>(
    `SELECT s.snapshot FROM board_memberships m
     JOIN board_snapshots s ON s.board_id = m.board_id
     WHERE m.email = $1
     ORDER BY s.updated_at DESC`,
    [key],
  );
  return res.rows.map((r) => r.snapshot);
}

export async function pgAddMembership(email: string, boardId: string) {
  const p = await getPool();
  if (!p) return false;
  const key = email.trim().toLowerCase();
  await p.query(
    `INSERT INTO board_memberships (email, board_id) VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [key, boardId],
  );
  return true;
}

export async function pgEmailHasAccess(email: string, boardId: string) {
  const p = await getPool();
  if (!p) return false;
  const key = email.trim().toLowerCase();
  const res = await p.query(
    "SELECT 1 FROM board_memberships WHERE email = $1 AND board_id = $2",
    [key, boardId],
  );
  return (res.rowCount ?? 0) > 0;
}

export async function pgFindUserByEmail(email: string): Promise<StoredUser | undefined> {
  const p = await getPool();
  if (!p) return undefined;
  const res = await p.query<{
    id: string;
    email: string;
    name: string;
    password_hash: string;
    salt: string;
    created_at: Date | string;
  }>("SELECT id, email, name, password_hash, salt, created_at FROM users WHERE email = $1", [
    email.trim().toLowerCase(),
  ]);
  const row = res.rows[0];
  if (!row) return undefined;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    passwordHash: row.password_hash,
    salt: row.salt,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
  };
}

export async function pgInsertUser(user: StoredUser) {
  const p = await getPool();
  if (!p) return false;
  await p.query(
    `INSERT INTO users (id, email, name, password_hash, salt, created_at)
     VALUES ($1, $2, $3, $4, $5, $6::timestamptz)`,
    [user.id, user.email, user.name, user.passwordHash, user.salt, user.createdAt],
  );
  return true;
}

function iso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : value;
}

type InviteRow = {
  token: string;
  board_id: string;
  board_title: string;
  created_by_email: string;
  created_by_name: string;
  invitee_email: string | null;
  created_at: Date | string;
  expires_at: Date | string;
  used_at: Date | string | null;
  used_by_email: string | null;
  accepted_emails: string[] | string | null;
};

function mapInvite(row: InviteRow): BoardInvite {
  const accepted = Array.isArray(row.accepted_emails)
    ? row.accepted_emails
    : typeof row.accepted_emails === "string"
      ? (JSON.parse(row.accepted_emails) as string[])
      : [];
  return {
    token: row.token,
    boardId: row.board_id,
    boardTitle: row.board_title,
    createdByEmail: row.created_by_email,
    createdByName: row.created_by_name,
    inviteeEmail: row.invitee_email,
    createdAt: iso(row.created_at),
    expiresAt: iso(row.expires_at),
    usedAt: row.used_at ? iso(row.used_at) : null,
    usedByEmail: row.used_by_email,
    acceptedEmails: accepted,
  };
}

const INVITE_SELECT = `token, board_id, board_title, created_by_email, created_by_name,
            invitee_email, created_at, expires_at, used_at, used_by_email, accepted_emails`;

export async function pgInsertInvite(invite: BoardInvite) {
  const p = await getPool();
  if (!p) return false;
  await p.query(
    `INSERT INTO invites (
      token, board_id, board_title, created_by_email, created_by_name,
      invitee_email, created_at, expires_at, used_at, used_by_email, accepted_emails
    ) VALUES ($1,$2,$3,$4,$5,$6,$7::timestamptz,$8::timestamptz,$9::timestamptz,$10,$11::jsonb)`,
    [
      invite.token,
      invite.boardId,
      invite.boardTitle,
      invite.createdByEmail,
      invite.createdByName,
      invite.inviteeEmail,
      invite.createdAt,
      invite.expiresAt,
      invite.usedAt,
      invite.usedByEmail,
      JSON.stringify(invite.acceptedEmails),
    ],
  );
  return true;
}

export async function pgGetInvite(token: string): Promise<BoardInvite | null> {
  const p = await getPool();
  if (!p) return null;
  const res = await p.query<InviteRow>(`SELECT ${INVITE_SELECT} FROM invites WHERE token = $1`, [
    token,
  ]);
  const row = res.rows[0];
  return row ? mapInvite(row) : null;
}

export async function pgRecordInviteAcceptance(token: string, usedByEmail: string) {
  const p = await getPool();
  if (!p) return null;
  const email = usedByEmail.trim().toLowerCase();
  const current = await pgGetInvite(token);
  if (!current) return null;
  const accepted = current.acceptedEmails.includes(email)
    ? current.acceptedEmails
    : [...current.acceptedEmails, email];
  const usedAt = current.usedAt || new Date().toISOString();
  const usedByEmailNext = current.usedByEmail || email;
  await p.query(
    `UPDATE invites
     SET accepted_emails = $2::jsonb,
         used_at = COALESCE(used_at, $3::timestamptz),
         used_by_email = COALESCE(used_by_email, $4)
     WHERE token = $1`,
    [token, JSON.stringify(accepted), usedAt, usedByEmailNext],
  );
  return { ...current, acceptedEmails: accepted, usedAt, usedByEmail: usedByEmailNext };
}

export async function pgListInvitesForBoard(boardId: string): Promise<BoardInvite[]> {
  const p = await getPool();
  if (!p) return [];
  const res = await p.query<InviteRow>(
    `SELECT ${INVITE_SELECT} FROM invites WHERE board_id = $1 ORDER BY created_at DESC`,
    [boardId],
  );
  return res.rows.map(mapInvite);
}

export function pgSchemaDdl(schema = readPgConfig()?.schema || "trelloai") {
  return ddl(schema);
}
