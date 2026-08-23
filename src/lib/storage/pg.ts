import type { Pool } from "pg";
import type { BoardSnapshot } from "@/lib/board-snapshot";

let pool: Pool | null = null;
let schemaReady = false;

async function getPool(): Promise<Pool | null> {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return null;
  if (!pool) {
    const { Pool: PgPool } = await import("pg");
    pool = new PgPool({ connectionString: url, max: 5 });
  }
  if (!schemaReady) {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS board_snapshots (
        board_id TEXT PRIMARY KEY,
        snapshot JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS board_memberships (
        email TEXT NOT NULL,
        board_id TEXT NOT NULL,
        PRIMARY KEY (email, board_id)
      );
    `);
    schemaReady = true;
  }
  return pool;
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
