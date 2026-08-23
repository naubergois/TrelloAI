import {
  pgAddMembership,
  pgEmailHasAccess,
  pgGetBoard,
  pgListBoardsForEmail,
  pgSaveBoard,
} from "@/lib/storage/pg";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";
import type { BoardSnapshot } from "./board-snapshot";

export type { BoardSnapshot };

type SharedStore = {
  boards: Record<string, BoardSnapshot>;
  memberships: Record<string, string[]>;
};

function dataDir() {
  return process.env.USERS_DATA_DIR || path.join(process.cwd(), "data");
}

function storePath() {
  return path.join(dataDir(), "shared-boards.json");
}

function readStore(): SharedStore {
  const file = storePath();
  if (!existsSync(file)) return { boards: {}, memberships: {} };
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as SharedStore;
    return {
      boards: parsed.boards || {},
      memberships: parsed.memberships || {},
    };
  } catch {
    return { boards: {}, memberships: {} };
  }
}

function writeStore(store: SharedStore) {
  mkdirSync(dataDir(), { recursive: true });
  writeFileSync(storePath(), JSON.stringify(store, null, 2), "utf8");
}

export async function getSharedBoard(boardId: string): Promise<BoardSnapshot | null> {
  if (process.env.DATABASE_URL) {
    const pg = await pgGetBoard(boardId);
    if (pg) return pg;
  }
  return readStore().boards[boardId] ?? null;
}

/** Sync read for legacy callers — prefers file cache when DB enabled */
export function getSharedBoardSync(boardId: string): BoardSnapshot | null {
  return readStore().boards[boardId] ?? null;
}

export async function saveSharedBoard(snapshot: BoardSnapshot) {
  const next: BoardSnapshot = {
    ...snapshot,
    updatedAt: new Date().toISOString(),
  };

  if (process.env.DATABASE_URL) {
    await pgSaveBoard(next);
  }

  const store = readStore();
  store.boards[snapshot.board.id] = next;
  writeStore(store);
}

export async function listBoardsForEmail(email: string): Promise<BoardSnapshot[]> {
  if (process.env.DATABASE_URL) {
    const pgBoards = await pgListBoardsForEmail(email);
    if (pgBoards.length > 0) return pgBoards;
  }
  const store = readStore();
  const ids = store.memberships[email.trim().toLowerCase()] || [];
  return ids.map((id) => store.boards[id]).filter(Boolean);
}

export async function addMembership(email: string, boardId: string) {
  if (process.env.DATABASE_URL) {
    await pgAddMembership(email, boardId);
  }
  const store = readStore();
  const key = email.trim().toLowerCase();
  const current = new Set(store.memberships[key] || []);
  current.add(boardId);
  store.memberships[key] = [...current];
  writeStore(store);
}

export async function emailHasBoardAccess(email: string, boardId: string) {
  if (process.env.DATABASE_URL) {
    const ok = await pgEmailHasAccess(email, boardId);
    if (ok) return true;
  }
  const key = email.trim().toLowerCase();
  const store = readStore();
  return (store.memberships[key] || []).includes(boardId);
}
