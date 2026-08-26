import { nanoid } from "nanoid";
import type {
  Board,
  BoardRisk,
  BoardRiskReport,
  Card,
  List,
} from "@/lib/types";
import { MAYA_RISKS_LIST_KEY, MAYA_RISKS_LIST_TITLE } from "@/lib/constants";

export type BoardPieces = {
  board: Board;
  lists: Record<string, List>;
  cards: Record<string, Card>;
};

export function isMayaRisksList(list: { systemKey?: string | null; title?: string } | null | undefined) {
  if (!list) return false;
  return list.systemKey === MAYA_RISKS_LIST_KEY || /^riscos maya$/i.test(list.title?.trim() || "");
}

export function findMayaRisksListId(pieces: BoardPieces): string | null {
  for (const listId of pieces.board.listIds) {
    const list = pieces.lists[listId];
    if (isMayaRisksList(list)) return listId;
  }
  return null;
}

export function ensureMayaRisksList(pieces: BoardPieces, now = new Date().toISOString()): string {
  const existing = findMayaRisksListId(pieces);
  if (existing) {
    const list = pieces.lists[existing];
    if (list && list.systemKey !== MAYA_RISKS_LIST_KEY) {
      pieces.lists[existing] = { ...list, systemKey: MAYA_RISKS_LIST_KEY };
    }
    return existing;
  }

  const listId = nanoid();
  pieces.lists[listId] = {
    id: listId,
    boardId: pieces.board.id,
    title: MAYA_RISKS_LIST_TITLE,
    cardIds: [],
    systemKey: MAYA_RISKS_LIST_KEY,
  };
  pieces.board = {
    ...pieces.board,
    listIds: [...pieces.board.listIds, listId],
    updatedAt: now,
  };
  return listId;
}

function coverForSeverity(severity: BoardRisk["severity"]) {
  if (severity === "high") return "red";
  if (severity === "medium") return "orange";
  return "sky";
}

function labelForRisk(risk: BoardRisk) {
  const color = risk.source === "git" ? "violet" : risk.severity === "high" ? "rose" : "amber";
  const name = risk.source === "git" ? "git" : "risco";
  return { id: `maya-${name}`, name, color: color as Card["labels"][number]["color"] };
}

export function emptyMayaCard(
  listId: string,
  risk: BoardRisk,
  now: string,
): Card {
  return {
    id: nanoid(),
    listId,
    title: risk.title.slice(0, 140),
    description: risk.reason,
    labels: [labelForRisk(risk)],
    coverColor: coverForSeverity(risk.severity),
    origin: "maya",
    originKey: risk.id,
    dueDate: null,
    priority: risk.severity === "low" ? "low" : risk.severity === "high" ? "high" : "medium",
    assigneeId: null,
    requirementId: null,
    acceptanceCriteria: "",
    checklist: [],
    comments: [],
    archived: false,
    createdAt: now,
    updatedAt: now,
  };
}

export function syncMayaRiskCards(pieces: BoardPieces, report: BoardRiskReport | null | undefined) {
  const now = new Date().toISOString();
  const listId = ensureMayaRisksList(pieces, now);
  const list = pieces.lists[listId];
  if (!list) return pieces;

  const risks = report?.risks || [];
  const wanted = new Set(risks.map((r) => r.id));
  const byKey = new Map<string, Card>();
  for (const card of Object.values(pieces.cards)) {
    if (card.origin === "maya" && card.originKey) byKey.set(card.originKey, card);
  }

  const nextCardIds = [...list.cardIds];

  for (const risk of risks) {
    const existing = byKey.get(risk.id);
    if (existing) {
      pieces.cards[existing.id] = {
        ...existing,
        title: risk.title.slice(0, 140),
        description: risk.reason,
        labels: [labelForRisk(risk)],
        coverColor: coverForSeverity(risk.severity),
        priority: risk.severity === "low" ? "low" : risk.severity === "high" ? "high" : "medium",
        archived: false,
        updatedAt: now,
      };
      if (existing.listId === listId && !nextCardIds.includes(existing.id)) {
        nextCardIds.push(existing.id);
      }
      continue;
    }
    const card = emptyMayaCard(listId, risk, now);
    pieces.cards[card.id] = card;
    nextCardIds.push(card.id);
  }

  for (const [key, card] of byKey) {
    if (wanted.has(key)) continue;
    if (card.listId !== listId) continue;
    delete pieces.cards[card.id];
    const idx = nextCardIds.indexOf(card.id);
    if (idx >= 0) nextCardIds.splice(idx, 1);
  }

  pieces.lists[listId] = { ...list, cardIds: nextCardIds };
  pieces.board = {
    ...pieces.board,
    riskReport: report ?? pieces.board.riskReport ?? null,
    updatedAt: now,
  };
  return pieces;
}

export function cloneBoardPieces(
  board: Board,
  lists: Record<string, List>,
  cards: Record<string, Card>,
): BoardPieces {
  const boardLists: Record<string, List> = {};
  const boardCards: Record<string, Card> = {};
  for (const listId of board.listIds) {
    const list = lists[listId];
    if (!list) continue;
    boardLists[listId] = { ...list, cardIds: [...list.cardIds] };
    for (const cardId of list.cardIds) {
      const card = cards[cardId];
      if (card) boardCards[cardId] = { ...card };
    }
  }
  return { board: { ...board, listIds: [...board.listIds] }, lists: boardLists, cards: boardCards };
}

export function mergePiecesInto(
  target: {
    boards: Record<string, Board>;
    lists: Record<string, List>;
    cards: Record<string, Card>;
  },
  pieces: BoardPieces,
) {
  const previousCardIds = new Set<string>();
  for (const listId of target.boards[pieces.board.id]?.listIds || []) {
    for (const cardId of target.lists[listId]?.cardIds || []) previousCardIds.add(cardId);
  }
  const keep = new Set(Object.keys(pieces.cards));
  for (const cardId of previousCardIds) {
    if (!keep.has(cardId) && target.cards[cardId]?.origin === "maya") {
      delete target.cards[cardId];
    }
  }
  target.boards[pieces.board.id] = pieces.board;
  Object.assign(target.lists, pieces.lists);
  Object.assign(target.cards, pieces.cards);
}
