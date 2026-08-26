import {
  applyOfficialBoardHierarchy,
  BOARD_LEVEL_ORDER,
  normalizeBoardLevel,
} from "@/lib/board-hierarchy";
import { ASESI_BOARD_ID, CGE_BOARD_ID } from "@/lib/constants";
import type { BoardLevel } from "@/lib/types";

/** Organização + time — sempre no destaque da home. */
export const FEATURED_HOME_BOARD_IDS: readonly string[] = [
  CGE_BOARD_ID,
  ASESI_BOARD_ID,
];

export function isFeaturedHomeBoard(boardId: string): boolean {
  return FEATURED_HOME_BOARD_IDS.includes(boardId);
}

/** Org first, then team. Falls back to any boards at those levels. */
export function featuredHomeBoards<T extends { id: string; level: BoardLevel }>(
  boards: T[],
): T[] {
  const byId = new Map(boards.map((board) => [board.id, board]));
  const official = FEATURED_HOME_BOARD_IDS.map((id) => byId.get(id)).filter(
    (board): board is T => board !== undefined,
  );
  if (official.length === 2) return official;

  const picked: T[] = [];
  const used = new Set<string>();
  const take = (board: T | undefined) => {
    if (!board || used.has(board.id)) return;
    used.add(board.id);
    picked.push(board);
  };
  take(
    official.find((board) => board.level === "organization") ??
      boards.find((board) => board.level === "organization"),
  );
  take(
    official.find((board) => board.level === "team") ??
      boards.find((board) => board.level === "team"),
  );
  for (const board of official) take(board);
  return picked.slice(0, 2);
}

export function withoutFeaturedHomeBoardIds(ids: string[]): string[] {
  return uniqueBoardIds(ids).filter((id) => !isFeaturedHomeBoard(id));
}

export function withFeaturedHomeBoardIds(
  selectedIds: string[],
  accessibleIds: string[],
): string[] {
  const accessible = new Set(accessibleIds);
  const pinned = FEATURED_HOME_BOARD_IDS.filter((id) => accessible.has(id));
  return uniqueBoardIds([
    ...pinned,
    ...selectedIds.filter((id) => accessible.has(id)),
  ]);
}

export function withPinnedFeaturedBoards<T>(
  selected: T[],
  accessible: T[],
  getId: (item: T) => string,
): T[] {
  const have = new Set(selected.map(getId));
  const extra = FEATURED_HOME_BOARD_IDS.map((id) =>
    accessible.find((item) => getId(item) === id),
  ).filter((item): item is T => {
    if (!item) return false;
    return !have.has(getId(item));
  });
  return [...extra, ...selected];
}

export type BoardCatalogItem = {
  id: string;
  title: string;
  description: string;
  level: BoardLevel;
  parentBoardId: string | null;
  selected: boolean;
};

export function uniqueBoardIds(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    const key = id.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

export function filterExistingBoardIds(
  requested: string[],
  existingIds: string[],
): string[] {
  const existing = new Set(existingIds);
  return uniqueBoardIds(requested).filter((id) => existing.has(id));
}

export function buildBoardCatalog(
  boards: Array<{
    id: string;
    title: string;
    description?: string | null;
    level?: string | null;
    parentBoardId?: string | null;
  }>,
  selectedIds: string[],
): BoardCatalogItem[] {
  const selected = new Set(selectedIds);
  return boards
    .map((board) => {
      const hierarchy = applyOfficialBoardHierarchy({
        id: board.id,
        level: normalizeBoardLevel(board.level),
        parentBoardId: board.parentBoardId ?? null,
      });
      return {
        id: board.id,
        title: board.title,
        description: board.description || "",
        level: hierarchy.level,
        parentBoardId: hierarchy.parentBoardId,
        selected: selected.has(board.id),
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));
}

/** Roots first, then children under their parent (orphans treated as roots). */
export function orderedCatalog(items: BoardCatalogItem[]): BoardCatalogItem[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  const children = new Map<string | null, BoardCatalogItem[]>();

  for (const item of items) {
    const parentId =
      item.parentBoardId && byId.has(item.parentBoardId)
        ? item.parentBoardId
        : null;
    const list = children.get(parentId) ?? [];
    list.push(item);
    children.set(parentId, list);
  }

  for (const list of children.values()) {
    list.sort(
      (a, b) =>
        BOARD_LEVEL_ORDER[a.level] - BOARD_LEVEL_ORDER[b.level] ||
        a.title.localeCompare(b.title, "pt-BR"),
    );
  }

  const out: BoardCatalogItem[] = [];
  const walk = (parentId: string | null) => {
    for (const item of children.get(parentId) ?? []) {
      out.push(item);
      walk(item.id);
    }
  };
  walk(null);
  return out;
}

export function applyVisibilityPreference<T>(
  accessible: T[],
  preference: string[] | null,
  getId: (item: T) => string,
): T[] {
  if (preference === null) return accessible;
  const want = new Set(preference);
  return accessible.filter((item) => want.has(getId(item)));
}

/** Pinning a parent also keeps its descendants so the parent board can show the carteira. */
export function withDescendantBoardIds(
  selectedIds: string[],
  boards: Array<{ id: string; parentBoardId?: string | null }>,
): string[] {
  const childrenByParent = new Map<string, string[]>();
  for (const board of boards) {
    const parentId = board.parentBoardId;
    if (!parentId) continue;
    const list = childrenByParent.get(parentId) ?? [];
    list.push(board.id);
    childrenByParent.set(parentId, list);
  }

  const out = new Set(selectedIds.filter(Boolean));
  const walk = (id: string) => {
    for (const childId of childrenByParent.get(id) ?? []) {
      if (out.has(childId)) continue;
      out.add(childId);
      walk(childId);
    }
  };
  for (const id of [...out]) walk(id);
  return [...out];
}

export function catalogDepth(
  item: BoardCatalogItem,
  items: BoardCatalogItem[],
): number {
  const byId = new Map(items.map((entry) => [entry.id, entry]));
  let depth = 0;
  let current: BoardCatalogItem | undefined = item;
  const seen = new Set<string>();
  while (
    current?.parentBoardId &&
    byId.has(current.parentBoardId) &&
    !seen.has(current.id)
  ) {
    seen.add(current.id);
    depth += 1;
    current = byId.get(current.parentBoardId);
  }
  return depth;
}
