import type { Pool, PoolConfig } from "pg";
import type { BoardSnapshot } from "@/lib/board-snapshot";
import type { BoardInvite } from "@/lib/invites";
import type { MayaDayLog } from "@/lib/types";
import type { StoredUser } from "@/lib/users";
import { mayaLogsRecord, normalizeMayaDayLog } from "@/lib/maya-chat";
import { createOfficialHierarchySnapshots } from "@/lib/asesi-seed";
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
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      role TEXT NOT NULL DEFAULT 'user',
      username TEXT
    );

    ALTER TABLE ${s}.users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';
    ALTER TABLE ${s}.users ADD COLUMN IF NOT EXISTS username TEXT;
    UPDATE ${s}.users SET username = split_part(email, '@', 1) WHERE username IS NULL OR btrim(username) = '';
    CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_idx ON ${s}.users (lower(username));

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
      accepted_emails JSONB NOT NULL DEFAULT '[]'::jsonb,
      kind TEXT NOT NULL DEFAULT 'board',
      team_id TEXT,
      team_name TEXT
    );

    ALTER TABLE ${s}.invites ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'board';
    ALTER TABLE ${s}.invites ADD COLUMN IF NOT EXISTS team_id TEXT;
    ALTER TABLE ${s}.invites ADD COLUMN IF NOT EXISTS team_name TEXT;
    CREATE INDEX IF NOT EXISTS invites_board_id_idx ON ${s}.invites (board_id);
    CREATE INDEX IF NOT EXISTS invites_team_id_idx ON ${s}.invites (team_id);
    CREATE INDEX IF NOT EXISTS memberships_board_id_idx ON ${s}.board_memberships (board_id);

    CREATE TABLE IF NOT EXISTS ${s}.user_board_visibility (
      email TEXT PRIMARY KEY,
      board_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS ${s}.card_attachment_blobs (
      id TEXT PRIMARY KEY,
      board_id TEXT NOT NULL,
      card_id TEXT NOT NULL,
      name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      byte_size INTEGER NOT NULL,
      data BYTEA NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS card_attachment_blobs_card_idx
      ON ${s}.card_attachment_blobs (board_id, card_id);

    CREATE TABLE IF NOT EXISTS ${s}.maya_chats (
      user_email TEXT NOT NULL,
      board_id TEXT NOT NULL,
      date TEXT NOT NULL,
      messages JSONB NOT NULL DEFAULT '[]'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_email, board_id, date)
    );
    CREATE INDEX IF NOT EXISTS maya_chats_user_idx ON ${s}.maya_chats (user_email);
    CREATE INDEX IF NOT EXISTS maya_chats_board_idx ON ${s}.maya_chats (board_id);
  `;
}

const DEFAULT_APP_ROLE = "asesi_jangada";

function appRoleName() {
  const raw = (process.env.PG_APP_ROLE || DEFAULT_APP_ROLE).trim().toLowerCase();
  return /^[a-z][a-z0-9_]{0,62}$/.test(raw) ? raw : DEFAULT_APP_ROLE;
}

/** CREATE TABLE as postgres leaves homolog (asesi_jangada) without INSERT/UPDATE. */
function grantAppRole(schema: string) {
  const role = appRoleName();
  return `
    DO $grant$
    DECLARE
      rec record;
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${role}') THEN
        RETURN;
      END IF;
      EXECUTE format('GRANT USAGE, CREATE ON SCHEMA %I TO %I', '${schema}', '${role}');
      FOR rec IN
        SELECT c.relname, c.relkind
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = '${schema}'
          AND c.relkind IN ('r', 'S')
      LOOP
        IF rec.relkind = 'S' THEN
          EXECUTE format('ALTER SEQUENCE %I.%I OWNER TO %I', '${schema}', rec.relname, '${role}');
        ELSE
          EXECUTE format('ALTER TABLE %I.%I OWNER TO %I', '${schema}', rec.relname, '${role}');
        END IF;
      END LOOP;
      EXECUTE format(
        'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA %I TO %I',
        '${schema}',
        '${role}'
      );
    EXCEPTION
      WHEN insufficient_privilege THEN
        NULL;
    END
    $grant$;
  `;
}

async function ensureSchema(p: Pool) {
  const schema = readPgConfig()?.schema || activeSchema;
  await p.query(ddl(schema));
  try {
    await p.query(grantAppRole(schema));
  } catch {
    /* app user cannot reassign ownership */
  }

  const existing = await p.query<{ n: number }>("SELECT COUNT(*)::int AS n FROM board_snapshots");
  if ((existing.rows[0]?.n ?? 0) === 0) {
    for (const snapshot of createOfficialHierarchySnapshots()) {
      await p.query(
        `INSERT INTO board_snapshots (board_id, snapshot, updated_at)
         VALUES ($1, $2::jsonb, NOW())
         ON CONFLICT (board_id) DO NOTHING`,
        [snapshot.board.id, JSON.stringify(snapshot)],
      );
    }
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

export async function pgDeleteBoard(boardId: string) {
  const p = await getPool();
  if (!p) return false;
  await p.query("DELETE FROM card_attachment_blobs WHERE board_id = $1", [boardId]);
  await p.query("DELETE FROM maya_chats WHERE board_id = $1", [boardId]);
  await p.query("DELETE FROM invites WHERE board_id = $1", [boardId]);
  await p.query("DELETE FROM board_memberships WHERE board_id = $1", [boardId]);
  await p.query("DELETE FROM board_snapshots WHERE board_id = $1", [boardId]);
  return true;
}

export async function pgListAllBoards(): Promise<BoardSnapshot[]> {
  const p = await getPool();
  if (!p) return [];
  const res = await p.query<{ snapshot: BoardSnapshot }>(
    "SELECT snapshot FROM board_snapshots ORDER BY updated_at DESC",
  );
  return res.rows.map((r) => r.snapshot);
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

export async function pgGetVisibility(email: string): Promise<string[] | null> {
  const p = await getPool();
  if (!p) return null;
  const key = email.trim().toLowerCase();
  const res = await p.query<{ board_ids: string[] | string }>(
    "SELECT board_ids FROM user_board_visibility WHERE email = $1",
    [key],
  );
  const row = res.rows[0];
  if (!row) return null;
  if (Array.isArray(row.board_ids)) return row.board_ids.map(String);
  if (typeof row.board_ids === "string") {
    try {
      const parsed = JSON.parse(row.board_ids) as unknown;
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

export async function pgSetVisibility(email: string, boardIds: string[]) {
  const p = await getPool();
  if (!p) return false;
  const key = email.trim().toLowerCase();
  await p.query(
    `INSERT INTO user_board_visibility (email, board_ids, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (email) DO UPDATE SET board_ids = $2::jsonb, updated_at = NOW()`,
    [key, JSON.stringify(boardIds)],
  );
  return true;
}

export async function pgAddVisibleBoard(email: string, boardId: string) {
  const p = await getPool();
  if (!p) return false;
  const key = email.trim().toLowerCase();
  const current = await pgGetVisibility(key);
  if (current === null) return true;
  if (current.includes(boardId)) return true;
  return pgSetVisibility(key, [...current, boardId]);
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

type UserRow = {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  salt: string;
  created_at: Date | string;
  role?: string | null;
  username?: string | null;
};

function mapUser(row: UserRow): StoredUser {
  const email = row.email;
  const username = (row.username || email.split("@")[0] || email).trim().toLowerCase();
  return {
    id: row.id,
    email,
    name: row.name,
    passwordHash: row.password_hash,
    salt: row.salt,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    role: row.role === "admin" ? "admin" : "user",
    username,
  };
}

const USER_SELECT = "id, email, name, password_hash, salt, created_at, role, username";

export async function pgFindUserByEmail(email: string): Promise<StoredUser | undefined> {
  const p = await getPool();
  if (!p) return undefined;
  const res = await p.query<UserRow>(`SELECT ${USER_SELECT} FROM users WHERE lower(email) = $1`, [
    email.trim().toLowerCase(),
  ]);
  const row = res.rows[0];
  return row ? mapUser(row) : undefined;
}

export async function pgFindUserByLogin(login: string): Promise<StoredUser | undefined> {
  const p = await getPool();
  if (!p) return undefined;
  const key = login.trim().toLowerCase();
  if (!key) return undefined;
  const res = await p.query<UserRow>(
    `SELECT ${USER_SELECT}
     FROM users
     WHERE lower(email) = $1
        OR lower(coalesce(username, '')) = $1
        OR split_part(lower(email), '@', 1) = $1
     LIMIT 1`,
    [key],
  );
  const row = res.rows[0];
  return row ? mapUser(row) : undefined;
}

export async function pgListUsers(): Promise<StoredUser[]> {
  const p = await getPool();
  if (!p) return [];
  const res = await p.query<UserRow>(`SELECT ${USER_SELECT} FROM users ORDER BY created_at ASC`);
  return res.rows.map(mapUser);
}

export async function pgInsertUser(user: StoredUser) {
  const p = await getPool();
  if (!p) return false;
  await p.query(
    `INSERT INTO users (id, email, name, password_hash, salt, created_at, role, username)
     VALUES ($1, $2, $3, $4, $5, $6::timestamptz, $7, $8)`,
    [
      user.id,
      user.email,
      user.name,
      user.passwordHash,
      user.salt,
      user.createdAt,
      user.role,
      user.username,
    ],
  );
  return true;
}

export async function pgFindUserById(id: string): Promise<StoredUser | undefined> {
  const p = await getPool();
  if (!p) return undefined;
  const res = await p.query<UserRow>(`SELECT ${USER_SELECT} FROM users WHERE id = $1`, [id]);
  const row = res.rows[0];
  return row ? mapUser(row) : undefined;
}

export async function pgUpdateUser(user: StoredUser, previousEmail?: string) {
  const p = await getPool();
  if (!p) return false;
  await p.query(
    `UPDATE users
     SET email = $2, name = $3, password_hash = $4, salt = $5, role = $6, username = $7
     WHERE id = $1`,
    [
      user.id,
      user.email,
      user.name,
      user.passwordHash,
      user.salt,
      user.role,
      user.username,
    ],
  );
  const from = previousEmail?.trim().toLowerCase();
  const to = user.email.trim().toLowerCase();
  if (from && from !== to) {
    await p.query(`UPDATE board_memberships SET email = $2 WHERE lower(email) = $1`, [from, to]);
    await p.query(
      `UPDATE user_board_visibility
       SET email = $2
       WHERE lower(email) = $1
         AND NOT EXISTS (
           SELECT 1 FROM user_board_visibility other WHERE lower(other.email) = $2
         )`,
      [from, to],
    );
    await p.query(`DELETE FROM user_board_visibility WHERE lower(email) = $1`, [from]);
    await p.query(
      `UPDATE maya_chats AS src
       SET user_email = $2
       WHERE lower(src.user_email) = $1
         AND NOT EXISTS (
           SELECT 1 FROM maya_chats other
           WHERE lower(other.user_email) = $2
             AND other.board_id = src.board_id
             AND other.date = src.date
         )`,
      [from, to],
    );
    await p.query(`DELETE FROM maya_chats WHERE lower(user_email) = $1`, [from]);
  }
  return true;
}

export async function pgEnsureUsername(email: string, username: string) {
  const p = await getPool();
  if (!p) return false;
  await p.query(`UPDATE users SET username = $2 WHERE lower(email) = $1 AND (username IS NULL OR btrim(username) = '')`, [
    email.trim().toLowerCase(),
    username.trim().toLowerCase(),
  ]);
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
  kind?: string | null;
  team_id?: string | null;
  team_name?: string | null;
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
    kind: row.kind === "team" ? "team" : "board",
    teamId: row.team_id ?? null,
    teamName: row.team_name ?? null,
  };
}

const INVITE_SELECT = `token, board_id, board_title, created_by_email, created_by_name,
            invitee_email, created_at, expires_at, used_at, used_by_email, accepted_emails,
            kind, team_id, team_name`;

export async function pgInsertInvite(invite: BoardInvite) {
  const p = await getPool();
  if (!p) return false;
  await p.query(
    `INSERT INTO invites (
      token, board_id, board_title, created_by_email, created_by_name,
      invitee_email, created_at, expires_at, used_at, used_by_email, accepted_emails,
      kind, team_id, team_name
    ) VALUES ($1,$2,$3,$4,$5,$6,$7::timestamptz,$8::timestamptz,$9::timestamptz,$10,$11::jsonb,$12,$13,$14)`,
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
      invite.kind || "board",
      invite.teamId,
      invite.teamName,
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

type AttachmentBlobRow = {
  id: string;
  board_id: string;
  card_id: string;
  name: string;
  mime_type: string;
  byte_size: number;
  data: Buffer;
};

export async function pgSaveAttachmentBlob(opts: {
  id: string;
  boardId: string;
  cardId: string;
  name: string;
  mimeType: string;
  bytes: Buffer;
}) {
  const p = await getPool();
  if (!p) return false;
  await p.query(
    `INSERT INTO card_attachment_blobs (id, board_id, card_id, name, mime_type, byte_size, data)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (id) DO UPDATE SET
       board_id = EXCLUDED.board_id,
       card_id = EXCLUDED.card_id,
       name = EXCLUDED.name,
       mime_type = EXCLUDED.mime_type,
       byte_size = EXCLUDED.byte_size,
       data = EXCLUDED.data`,
    [opts.id, opts.boardId, opts.cardId, opts.name, opts.mimeType, opts.bytes.length, opts.bytes],
  );
  return true;
}

export async function pgGetAttachmentBlob(opts: {
  id: string;
  boardId: string;
  cardId: string;
}): Promise<{ name: string; mimeType: string; data: Buffer } | null> {
  const p = await getPool();
  if (!p) return null;
  const res = await p.query<AttachmentBlobRow>(
    `SELECT id, board_id, card_id, name, mime_type, byte_size, data
     FROM card_attachment_blobs
     WHERE id = $1 AND board_id = $2 AND card_id = $3`,
    [opts.id, opts.boardId, opts.cardId],
  );
  const row = res.rows[0];
  if (!row) return null;
  return { name: row.name, mimeType: row.mime_type, data: row.data };
}

export async function pgDeleteAttachmentBlob(opts: {
  id: string;
  boardId: string;
  cardId: string;
}) {
  const p = await getPool();
  if (!p) return false;
  await p.query(
    "DELETE FROM card_attachment_blobs WHERE id = $1 AND board_id = $2 AND card_id = $3",
    [opts.id, opts.boardId, opts.cardId],
  );
  return true;
}

type MayaChatRow = {
  user_email: string;
  board_id: string;
  date: string;
  messages: unknown;
  updated_at: Date | string;
};

function mapMayaChatRow(row: MayaChatRow): MayaDayLog | null {
  let messages: unknown = row.messages;
  if (typeof messages === "string") {
    try {
      messages = JSON.parse(messages);
    } catch {
      messages = [];
    }
  }
  return normalizeMayaDayLog(row.board_id, row.date, Array.isArray(messages) ? messages : [], iso(row.updated_at));
}

export async function pgListMayaChats(
  email: string,
  boardId?: string,
): Promise<Record<string, MayaDayLog>> {
  const p = await getPool();
  if (!p) return {};
  const key = email.trim().toLowerCase();
  const res = boardId
    ? await p.query<MayaChatRow>(
        `SELECT user_email, board_id, date, messages, updated_at
         FROM maya_chats
         WHERE lower(user_email) = $1 AND board_id = $2
         ORDER BY date ASC`,
        [key, boardId],
      )
    : await p.query<MayaChatRow>(
        `SELECT user_email, board_id, date, messages, updated_at
         FROM maya_chats
         WHERE lower(user_email) = $1
         ORDER BY board_id ASC, date ASC`,
        [key],
      );
  return mayaLogsRecord(res.rows.map(mapMayaChatRow).filter((log): log is MayaDayLog => Boolean(log)));
}

export async function pgSaveMayaDayChat(email: string, log: MayaDayLog) {
  const p = await getPool();
  if (!p) return false;
  const key = email.trim().toLowerCase();
  await p.query(
    `INSERT INTO maya_chats (user_email, board_id, date, messages, updated_at)
     VALUES ($1, $2, $3, $4::jsonb, $5::timestamptz)
     ON CONFLICT (user_email, board_id, date)
     DO UPDATE SET messages = $4::jsonb, updated_at = $5::timestamptz`,
    [key, log.boardId, log.date, JSON.stringify(log.messages), log.updatedAt],
  );
  return true;
}

export async function pgSaveMayaChats(email: string, logs: MayaDayLog[]) {
  for (const log of logs) {
    await pgSaveMayaDayChat(email, log);
  }
  return true;
}

export async function pgDeleteMayaDayChat(email: string, boardId: string, date: string) {
  const p = await getPool();
  if (!p) return false;
  const key = email.trim().toLowerCase();
  await p.query(
    `DELETE FROM maya_chats
     WHERE lower(user_email) = $1 AND board_id = $2 AND date = $3`,
    [key, boardId, date],
  );
  return true;
}

export function pgSchemaDdl(schema = readPgConfig()?.schema || "trelloai") {
  return ddl(schema);
}
