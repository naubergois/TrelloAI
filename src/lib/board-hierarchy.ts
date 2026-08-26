import type { Board, BoardLevel } from "@/lib/types";

export const BOARD_LEVELS: BoardLevel[] = [
  "organization",
  "unit",
  "team",
  "project",
];

export const BOARD_LEVEL_LABELS: Record<BoardLevel, string> = {
  organization: "Organização",
  unit: "Unidade",
  team: "Time",
  project: "Projeto",
};

export const BOARD_LEVEL_ORDER: Record<BoardLevel, number> = {
  organization: 0,
  unit: 1,
  team: 2,
  project: 3,
};

export function parentLevelFor(level: BoardLevel): BoardLevel | null {
  switch (level) {
    case "organization":
      return null;
    case "unit":
      return "organization";
    case "team":
      return "unit";
    case "project":
      return "team";
    default:
      return null;
  }
}

/** Pai imediato preferido, ou qualquer nível acima (ex.: time sob organização). */
export function isValidParentLevel(
  parentLevel: BoardLevel,
  childLevel: BoardLevel,
): boolean {
  return BOARD_LEVEL_ORDER[parentLevel] < BOARD_LEVEL_ORDER[childLevel];
}

export function eligibleParentBoards<T extends { id: string; level: BoardLevel }>(
  childLevel: BoardLevel,
  boards: T[],
  childId?: string,
): T[] {
  return boards.filter(
    (board) =>
      board.id !== childId && isValidParentLevel(board.level, childLevel),
  );
}

export function normalizeBoardLevel(level?: string | null): BoardLevel {
  if (
    level === "organization" ||
    level === "unit" ||
    level === "team" ||
    level === "project"
  ) {
    return level;
  }
  return "project";
}

export function ensureBoardHierarchy(board: Board): Board {
  return {
    ...board,
    level: normalizeBoardLevel(board.level),
    parentBoardId: board.parentBoardId ?? null,
  };
}

export function getChildBoards(
  boardId: string,
  boards: Record<string, Board>,
): Board[] {
  return Object.values(boards)
    .filter((b) => b.parentBoardId === boardId)
    .sort(
      (a, b) =>
        BOARD_LEVEL_ORDER[a.level] - BOARD_LEVEL_ORDER[b.level] ||
        a.title.localeCompare(b.title),
    );
}

export function getDescendantBoardIds(
  boardId: string,
  boards: Record<string, Board>,
): string[] {
  const ids: string[] = [];
  const walk = (id: string) => {
    for (const child of getChildBoards(id, boards)) {
      ids.push(child.id);
      walk(child.id);
    }
  };
  walk(boardId);
  return ids;
}

export function getBoardAncestors(
  boardId: string,
  boards: Record<string, Board>,
): Board[] {
  const chain: Board[] = [];
  let current = boards[boardId];
  while (current?.parentBoardId) {
    const parent = boards[current.parentBoardId];
    if (!parent) break;
    chain.unshift(parent);
    current = parent;
  }
  return chain;
}

export function getDescendantBoards(
  boardId: string,
  boards: Record<string, Board>,
): Board[] {
  const ids = getDescendantBoardIds(boardId, boards);
  return ids
    .map((id) => boards[id])
    .filter(Boolean)
    .sort(
      (a, b) =>
        BOARD_LEVEL_ORDER[a.level] - BOARD_LEVEL_ORDER[b.level] ||
        a.title.localeCompare(b.title),
    );
}

export const BOARD_LEVEL_STYLES: Record<BoardLevel, string> = {
  organization: "bg-[#0079bf] text-white",
  unit: "bg-violet-500/90 text-white",
  team: "bg-emerald-500/90 text-white",
  project: "bg-amber-500/90 text-[#172b4d]",
};
