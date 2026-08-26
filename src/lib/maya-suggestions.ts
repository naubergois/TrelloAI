import {
  calendarDayFromDate,
  dueUrgency,
  type BoardCardFilter,
} from "./board-filters";
import { classifyListStage, type ListStage } from "./board-indicators";
import { cardAssigneeLabel, hasCardAssignees } from "./members";
import type { Board, Card, List, Requirement } from "./types";

export type MayaSuggestionTone = "danger" | "warn" | "info" | "ok";

export type MayaSuggestionKind =
  | "blocked"
  | "overdue"
  | "due-today"
  | "due-soon"
  | "unassigned"
  | "stuck"
  | "review"
  | "pull"
  | "requirement"
  | "risk"
  | "empty"
  | "next";

export type MayaSuggestion = {
  id: string;
  kind: MayaSuggestionKind;
  title: string;
  detail: string;
  tone: MayaSuggestionTone;
  score: number;
  cardId?: string;
  boardId: string;
  boardTitle?: string;
  filter?: Partial<BoardCardFilter>;
  openMaya?: boolean;
};

export type SuggestMayaActivitiesInput = {
  boardIds: string[];
  boards: Record<string, Board>;
  lists: Record<string, List>;
  cards: Record<string, Card>;
  requirements?: Record<string, Requirement>;
  members?: Record<string, { id: string; name: string }>;
  rootBoardId?: string;
  limit?: number;
  today?: string;
};

type WorkItem = {
  card: Card;
  list: List;
  stage: ListStage;
  board: Board;
};

const MAX_PER_KIND = 2;

function isBlockedCard(card: Pick<Card, "title" | "labels">) {
  if (/^bloqueio\b/i.test(card.title.trim())) return true;
  return (card.labels || []).some((label) =>
    /bloqueio|blocked|blocker/i.test(label.name),
  );
}

function daysBetween(from: string, to: string) {
  const a = Date.parse(`${from}T00:00:00`);
  const b = Date.parse(`${to}T00:00:00`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

function plural(n: number, one: string, many: string) {
  return n === 1 ? one : many;
}

function otherBoardTitle(board: Board, rootBoardId: string | undefined) {
  if (!rootBoardId || board.id === rootBoardId) return undefined;
  return board.title;
}

function cardFilter(card: Card): Partial<BoardCardFilter> {
  return { query: card.title };
}

function collectWorkItems(input: SuggestMayaActivitiesInput): {
  items: WorkItem[];
  riskCount: number;
  firstRiskTitle: string;
} {
  const items: WorkItem[] = [];
  let riskCount = 0;
  let firstRiskTitle = "";

  for (const boardId of input.boardIds) {
    const board = input.boards[boardId];
    if (!board) continue;
    for (const listId of board.listIds) {
      const list = input.lists[listId];
      if (!list) continue;
      const stage = classifyListStage(list);
      for (const cardId of list.cardIds) {
        const card = input.cards[cardId];
        if (!card || card.archived) continue;
        if (stage === "risks" || card.origin === "maya") {
          riskCount += 1;
          if (!firstRiskTitle) firstRiskTitle = card.title;
          continue;
        }
        items.push({ card, list, stage, board });
      }
    }
  }

  return { items, riskCount, firstRiskTitle };
}

function rankAndLimit(suggestions: MayaSuggestion[], limit: number) {
  const byKind = new Map<MayaSuggestionKind, MayaSuggestion[]>();
  const sorted = [...suggestions].sort(
    (a, b) => b.score - a.score || a.title.localeCompare(b.title, "pt-BR"),
  );
  const seenCards = new Set<string>();
  const picked: MayaSuggestion[] = [];
  for (const suggestion of sorted) {
    if (suggestion.cardId) {
      if (seenCards.has(suggestion.cardId)) continue;
      const bucket = byKind.get(suggestion.kind) ?? [];
      if (bucket.length >= MAX_PER_KIND) continue;
      seenCards.add(suggestion.cardId);
      bucket.push(suggestion);
      byKind.set(suggestion.kind, bucket);
    }
    picked.push(suggestion);
  }
  return picked
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, "pt-BR"))
    .slice(0, limit);
}

export function suggestMayaActivities(
  input: SuggestMayaActivitiesInput,
): MayaSuggestion[] {
  const today = input.today || calendarDayFromDate();
  const limit = input.limit ?? 5;
  const rootBoardId = input.rootBoardId || input.boardIds[0];
  const { items, riskCount, firstRiskTitle } = collectWorkItems(input);
  const suggestions: MayaSuggestion[] = [];
  const active = items.filter((item) => item.stage !== "done");

  const pushCard = (
    item: WorkItem,
    partial: Omit<MayaSuggestion, "id" | "boardId" | "boardTitle" | "cardId"> & {
      id?: string;
    },
  ) => {
    const elsewhere = otherBoardTitle(item.board, rootBoardId);
    suggestions.push({
      ...partial,
      id: partial.id || `${partial.kind}-${item.card.id}`,
      cardId: item.card.id,
      boardId: item.board.id,
      boardTitle: elsewhere,
      filter: partial.filter ?? cardFilter(item.card),
      detail: elsewhere
        ? `${partial.detail} · ${elsewhere}`
        : partial.detail,
    });
  };

  if (items.length === 0) {
    return [
      {
        id: "empty",
        kind: "empty",
        title: "Criar as primeiras atividades",
        detail: "O board está vazio. Peça à Maya para montar o backlog.",
        tone: "info",
        score: 50,
        boardId: rootBoardId || input.boardIds[0] || "",
        openMaya: true,
      },
    ];
  }

  const overdueItems = active
    .filter((item) => dueUrgency(item.card.dueDate) === "overdue")
    .sort(
      (a, b) =>
        daysBetween(b.card.dueDate || today, today) -
        daysBetween(a.card.dueDate || today, today),
    );

  if (overdueItems.length >= 2) {
    suggestions.push({
      id: "overdue-all",
      kind: "overdue",
      title: `Tratar ${overdueItems.length} cards atrasados`,
      detail: "Filtre o board e feche os prazos vencidos primeiro.",
      tone: "danger",
      score: 96,
      boardId: rootBoardId || "",
      filter: { due: "overdue" },
    });
  }

  for (const item of overdueItems) {
    const late = daysBetween(item.card.dueDate || today, today);
    const who = cardAssigneeLabel(input.members, item.card);
    pushCard(item, {
      kind: "overdue",
      title: `Tratar atraso: ${item.card.title}`,
      detail: `${late} ${plural(late, "dia", "dias")} em atraso${
        who ? ` · ${who}` : " · sem responsável"
      }`,
      tone: "danger",
      score: 90 + Math.min(8, late),
    });
  }

  for (const item of active) {
    if (!isBlockedCard(item.card)) continue;
    pushCard(item, {
      kind: "blocked",
      title: `Desbloquear: ${item.card.title}`,
      detail: "Marcado como bloqueio — precisa de ação agora.",
      tone: "danger",
      score: 100,
    });
  }

  for (const item of active) {
    if (dueUrgency(item.card.dueDate) !== "today") continue;
    const who = cardAssigneeLabel(input.members, item.card);
    pushCard(item, {
      kind: "due-today",
      title: `Entregar hoje: ${item.card.title}`,
      detail: who ? `Prazo é hoje · ${who}` : "Prazo é hoje · sem responsável",
      tone: "warn",
      score: 82,
    });
  }

  for (const item of active) {
    if (dueUrgency(item.card.dueDate) !== "soon") continue;
    pushCard(item, {
      kind: "due-soon",
      title: `Antecipar: ${item.card.title}`,
      detail: `Prazo ${item.card.dueDate} — falta pouco.`,
      tone: "warn",
      score: 74,
    });
  }

  for (const item of active) {
    if (item.card.priority !== "high" || hasCardAssignees(item.card)) continue;
    pushCard(item, {
      kind: "unassigned",
      title: `Atribuir: ${item.card.title}`,
      detail: "Alta prioridade sem responsável.",
      tone: "warn",
      score: 68,
    });
  }

  for (const item of active) {
    if (item.card.priority !== "high" || item.stage !== "backlog") continue;
    pushCard(item, {
      kind: "stuck",
      title: `Puxar para andamento: ${item.card.title}`,
      detail: "Prioridade alta ainda no backlog.",
      tone: "warn",
      score: 64,
    });
  }

  for (const item of active) {
    if (item.stage !== "review") continue;
    const who = cardAssigneeLabel(input.members, item.card);
    pushCard(item, {
      kind: "review",
      title: `Revisar: ${item.card.title}`,
      detail: who ? `Aguardando review · ${who}` : "Aguardando review.",
      tone: "info",
      score: 58,
    });
  }

  const wip = active.filter(
    (item) => item.stage === "doing" || item.stage === "review",
  );
  const backlog = active.filter((item) => item.stage === "backlog");
  if (wip.length === 0 && backlog.length > 0) {
    const next = backlog.find((item) => item.card.priority === "high") || backlog[0];
    pushCard(next, {
      kind: "pull",
      title: `Começar: ${next.card.title}`,
      detail: "Nada em curso — puxe um card do backlog.",
      tone: "info",
      score: 56,
    });
  }

  if (riskCount > 0) {
    suggestions.push({
      id: "risks",
      kind: "risk",
      title:
        riskCount === 1
          ? `Olhar risco Maya: ${firstRiskTitle}`
          : `Olhar ${riskCount} riscos Maya`,
      detail: "A Maya registrou riscos neste board — vale conferir a coluna.",
      tone: "warn",
      score: 54,
      boardId: rootBoardId || "",
      openMaya: true,
    });
  }

  const boardIdSet = new Set(input.boardIds);
  for (const req of Object.values(input.requirements || {})) {
    if (!boardIdSet.has(req.boardId)) continue;
    if (req.status === "done" || req.status === "rejected") continue;
    const linked = items.some((item) => item.card.requirementId === req.id);
    if (linked) continue;
    const code = req.code ? `${req.code} · ` : "";
    suggestions.push({
      id: `req-${req.id}`,
      kind: "requirement",
      title: `Abrir card: ${code}${req.title}`,
      detail: "Requisito sem atividade no kanban.",
      tone: "info",
      score: 46,
      boardId: req.boardId,
      openMaya: true,
    });
  }

  const ranked = rankAndLimit(suggestions, limit);
  if (ranked.length > 0) return ranked;

  const next =
    wip[0] ||
    backlog.find((item) => item.card.priority === "high") ||
    backlog[0] ||
    active[0];
  if (!next) {
    return [
      {
        id: "ok",
        kind: "next",
        title: "Board em dia",
        detail: "Nenhuma pendência crítica agora.",
        tone: "ok",
        score: 10,
        boardId: rootBoardId || "",
      },
    ];
  }

  return [
    {
      id: `next-${next.card.id}`,
      kind: "next",
      title: `Seguir: ${next.card.title}`,
      detail: "Nenhum atraso crítico — avance o trabalho em curso.",
      tone: "ok",
      score: 20,
      cardId: next.card.id,
      boardId: next.board.id,
      boardTitle: otherBoardTitle(next.board, rootBoardId),
      filter: cardFilter(next.card),
    },
  ];
}
