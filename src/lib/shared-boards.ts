import { mkdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";
import type { BoardSnapshot } from "./board-snapshot";

export type { BoardSnapshot };

type SharedStore = {
  boards: Record<string, BoardSnapshot>;
  /** email lowercased → boardIds */
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

export function getSharedBoard(boardId: string): BoardSnapshot | null {
  return readStore().boards[boardId] ?? null;
}

export function saveSharedBoard(snapshot: BoardSnapshot) {
  const store = readStore();
  store.boards[snapshot.board.id] = {
    ...snapshot,
    updatedAt: new Date().toISOString(),
  };
  writeStore(store);
}

export function listBoardsForEmail(email: string): BoardSnapshot[] {
  const store = readStore();
  const ids = store.memberships[email.trim().toLowerCase()] || [];
  return ids.map((id) => store.boards[id]).filter(Boolean);
}

export function addMembership(email: string, boardId: string) {
  const store = readStore();
  const key = email.trim().toLowerCase();
  const current = new Set(store.memberships[key] || []);
  current.add(boardId);
  store.memberships[key] = [...current];
  writeStore(store);
}

export function emailHasBoardAccess(email: string, boardId: string) {
  const key = email.trim().toLowerCase();
  const store = readStore();
  return (store.memberships[key] || []).includes(boardId);
}
