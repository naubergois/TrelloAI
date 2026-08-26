import {
  isPgConfigured,
  pgAddMembership,
  pgAddVisibleBoard,
  pgDeleteBoard,
  pgEmailHasAccess,
  pgGetBoard,
  pgGetVisibility,
  pgListAllBoards,
  pgListBoardsForEmail,
  pgSaveBoard,
  pgSetVisibility,
} from "@/lib/storage/pg";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";
import { snapshotVisibleToEmail } from "@/lib/board-access";
import type { BoardSnapshot } from "./board-snapshot";
import {
  applyVisibilityPreference,
  buildBoardCatalog,
  filterExistingBoardIds,
  withDescendantBoardIds,
  type BoardCatalogItem,
} from "./board-visibility";

export type { BoardSnapshot, BoardCatalogItem };

type SharedStore = {
  boards: Record<string, BoardSnapshot>;
  memberships: Record<string, string[]>;
  /** Explicit home selection. Missing key = show every accessible board. */
  visibility: Record<string, string[]>;
};

function dataDir() {
  return process.env.USERS_DATA_DIR || path.join(process.cwd(), "data");
}

function storePath() {
  return path.join(dataDir(), "shared-boards.json");
}

function readStore(): SharedStore {
  const file = storePath();
  if (!existsSync(file)) return { boards: {}, memberships: {}, visibility: {} };
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as SharedStore;
    return {
      boards: parsed.boards || {},
      memberships: parsed.memberships || {},
      visibility: parsed.visibility || {},
    };
  } catch {
    return { boards: {}, memberships: {}, visibility: {} };
  }
}

function writeStore(store: SharedStore) {
  mkdirSync(dataDir(), { recursive: true });
  writeFileSync(storePath(), JSON.stringify(store, null, 2), "utf8");
}

export async function getSharedBoard(boardId: string): Promise<BoardSnapshot | null> {
  if (isPgConfigured()) {
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

  if (isPgConfigured()) {
    await pgSaveBoard(next);
  }

  const store = readStore();
  store.boards[snapshot.board.id] = next;
  writeStore(store);
}

export async function listAllSharedBoards(): Promise<BoardSnapshot[]> {
  if (isPgConfigured()) {
    const pgBoards = await pgListAllBoards();
    if (pgBoards.length > 0) return pgBoards;
  }
  return Object.values(readStore().boards);
}

export async function listBoardsForEmail(email: string): Promise<BoardSnapshot[]> {
  if (isPgConfigured()) {
    return pgListBoardsForEmail(email);
  }
  const store = readStore();
  const ids = store.memberships[email.trim().toLowerCase()] || [];
  return ids.map((id) => store.boards[id]).filter(Boolean);
}

export async function getVisibleBoardPreference(
  email: string,
): Promise<string[] | null> {
  const key = email.trim().toLowerCase();
  if (isPgConfigured()) {
    return pgGetVisibility(key);
  }
  const store = readStore();
  if (!Object.prototype.hasOwnProperty.call(store.visibility, key)) return null;
  return store.visibility[key] || [];
}

export async function listBoardCatalog(
  email: string,
  isAdmin = false,
): Promise<BoardCatalogItem[]> {
  const accessible = await listBoardsVisibleToUser(email, isAdmin);
  const pref = await getVisibleBoardPreference(email);
  const selected = pref ?? accessible.map((snapshot) => snapshot.board.id);
  return buildBoardCatalog(
    accessible.map((snapshot) => ({
      id: snapshot.board.id,
      title: snapshot.board.title,
      description: snapshot.board.description,
      level: snapshot.board.level,
      parentBoardId: snapshot.board.parentBoardId,
    })),
    selected,
  );
}

export async function setVisibleBoards(
  email: string,
  boardIds: string[],
  isAdmin = false,
): Promise<{ boardIds: string[]; snapshots: BoardSnapshot[] }> {
  const accessible = await listBoardsVisibleToUser(email, isAdmin);
  const allowedIds = accessible.map((snapshot) => snapshot.board.id);
  const nextIds = filterExistingBoardIds(boardIds, allowedIds);
  const key = email.trim().toLowerCase();

  if (isPgConfigured()) {
    await pgSetVisibility(key, nextIds);
  }

  const store = readStore();
  store.visibility[key] = nextIds;
  writeStore(store);

  return {
    boardIds: nextIds,
    snapshots: applyVisibilityPreference(accessible, nextIds, (snapshot) => snapshot.board.id),
  };
}

export async function addVisibleBoard(email: string, boardId: string) {
  const key = email.trim().toLowerCase();
  if (isPgConfigured()) {
    await pgAddVisibleBoard(key, boardId);
  }
  const store = readStore();
  if (!Object.prototype.hasOwnProperty.call(store.visibility, key)) return;
  const current = new Set(store.visibility[key] || []);
  current.add(boardId);
  store.visibility[key] = [...current];
  writeStore(store);
}

export async function listBoardsForHome(
  email: string,
  isAdmin = false,
): Promise<BoardSnapshot[]> {
  const accessible = await listBoardsVisibleToUser(email, isAdmin);
  const pref = await getVisibleBoardPreference(email);
  const selected = applyVisibilityPreference(
    accessible,
    pref,
    (snapshot) => snapshot.board.id,
  );
  if (pref === null) return accessible;
  const keep = new Set(
    withDescendantBoardIds(
      selected.map((snapshot) => snapshot.board.id),
      accessible.map((snapshot) => snapshot.board),
    ),
  );
  return accessible.filter((snapshot) => keep.has(snapshot.board.id));
}

/** Admin sees every board; others see team/personal boards plus descendants of those. */
export async function listBoardsVisibleToUser(
  email: string,
  isAdmin = false,
): Promise<BoardSnapshot[]> {
  const all = await listAllSharedBoards();
  if (isAdmin) return all;
  const membershipIds = new Set(
    (await listBoardsForEmail(email)).map((snapshot) => snapshot.board.id),
  );
  const direct = all.filter((snapshot) => {
    if (snapshotVisibleToEmail(snapshot, email)) return true;
    return membershipIds.has(snapshot.board.id) && !snapshot.board.teamId;
  });
  const keep = new Set(
    withDescendantBoardIds(
      direct.map((snapshot) => snapshot.board.id),
      all.map((snapshot) => snapshot.board),
    ),
  );
  return all.filter((snapshot) => keep.has(snapshot.board.id));
}

export async function deleteSharedBoard(boardId: string) {
  if (isPgConfigured()) {
    await pgDeleteBoard(boardId);
  }
  const store = readStore();
  delete store.boards[boardId];
  for (const email of Object.keys(store.memberships)) {
    store.memberships[email] = (store.memberships[email] || []).filter((id) => id !== boardId);
  }
  for (const email of Object.keys(store.visibility)) {
    store.visibility[email] = (store.visibility[email] || []).filter((id) => id !== boardId);
  }
  writeStore(store);
}

export async function addMembership(email: string, boardId: string) {
  if (isPgConfigured()) {
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
  const snapshot = await getSharedBoard(boardId);
  if (snapshot) {
    if (snapshotVisibleToEmail(snapshot, email)) return true;
    if (snapshot.board.teamId) return false;
  }
  if (isPgConfigured()) {
    const ok = await pgEmailHasAccess(email, boardId);
    if (ok) return true;
  }
  const key = email.trim().toLowerCase();
  const store = readStore();
  return (store.memberships[key] || []).includes(boardId);
}
