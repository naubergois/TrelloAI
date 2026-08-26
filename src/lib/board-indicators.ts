import { dueUrgency, type BoardCardFilter } from "@/lib/board-filters";
import { isMayaRisksList } from "@/lib/maya-risk-column";
import { hasCardAssignees } from "@/lib/members";
import type { Board, Card, List, Requirement } from "@/lib/types";

export type ListStage =
  | "backlog"
  | "doing"
  | "review"
  | "done"
  | "risks"
  | "other";

export type IndicatorTone = "neutral" | "ok" | "warn" | "danger" | "info";

export type IndicatorChip = {
  key: string;
  label: string;
  value: string;
  tone: IndicatorTone;
  filter?: Partial<BoardCardFilter>;
};

export type BoardIndicatorStats = {
  cards: number;
  backlog: number;
  doing: number;
  review: number;
  done: number;
  other: number;
  wip: number;
  progressPct: number;
  overdue: number;
  dueSoon: number;
  dueToday: number;
  highPriority: number;
  unassigned: number;
  blocked: number;
  risks: number;
  risksHigh: number;
  requirements: number;
  requirementsDone: number;
  checklistItems: number;
  checklistDone: number;
};

export type ExtractBoardIndicatorsInput = {
  boardIds: string[];
  boards: Record<string, Board>;
  lists: Record<string, List>;
  cards: Record<string, Card>;
  requirements?: Record<string, Requirement>;
};

function normalizeTitle(title: string) {
  return title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function classifyListStage(list: {
  title?: string;
  systemKey?: string | null;
}): ListStage {
  if (isMayaRisksList(list)) return "risks";
  const t = normalizeTitle(list.title || "");
  if (!t) return "other";
  if (/(conclu|done|feito|finaliz|entregue|complete)/.test(t)) return "done";
  if (/(revis|review|\bqa\b|homolog)/.test(t)) return "review";
  if (/(andamento|progresso|doing|\bwip\b|fazendo|execuc)/.test(t)) return "doing";
  if (/(backlog|a fazer|\btodo\b|to do|pendente|inbox)/.test(t)) return "backlog";
  return "other";
}

function isMayaCard(card: Pick<Card, "origin">) {
  return card.origin === "maya";
}

function isBlockedCard(card: Pick<Card, "title" | "labels">) {
  if (/^bloqueio\b/i.test(card.title.trim())) return true;
  return (card.labels || []).some((label) =>
    /bloqueio|blocked|blocker/i.test(label.name),
  );
}

const EMPTY_STATS: BoardIndicatorStats = {
  cards: 0,
  backlog: 0,
  doing: 0,
  review: 0,
  done: 0,
  other: 0,
  wip: 0,
  progressPct: 0,
  overdue: 0,
  dueSoon: 0,
  dueToday: 0,
  highPriority: 0,
  unassigned: 0,
  blocked: 0,
  risks: 0,
  risksHigh: 0,
  requirements: 0,
  requirementsDone: 0,
  checklistItems: 0,
  checklistDone: 0,
};

export function extractBoardIndicators(
  input: ExtractBoardIndicatorsInput,
): BoardIndicatorStats {
  const stats: BoardIndicatorStats = { ...EMPTY_STATS };
  const boardIdSet = new Set(input.boardIds);

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

        if (stage === "risks" || isMayaCard(card)) {
          stats.risks += 1;
          if (card.priority === "high") stats.risksHigh += 1;
          continue;
        }

        stats.cards += 1;
        if (stage === "backlog") stats.backlog += 1;
        else if (stage === "doing") stats.doing += 1;
        else if (stage === "review") stats.review += 1;
        else if (stage === "done") stats.done += 1;
        else stats.other += 1;

        for (const item of card.checklist || []) {
          stats.checklistItems += 1;
          if (item.done) stats.checklistDone += 1;
        }

        if (stage === "done") continue;

        const urgency = dueUrgency(card.dueDate);
        if (urgency === "overdue") stats.overdue += 1;
        if (urgency === "today") stats.dueToday += 1;
        if (urgency === "today" || urgency === "soon") stats.dueSoon += 1;
        if (card.priority === "high") stats.highPriority += 1;
        if (!hasCardAssignees(card)) stats.unassigned += 1;
        if (isBlockedCard(card)) stats.blocked += 1;
      }
    }
  }

  stats.wip = stats.doing + stats.review;
  stats.progressPct =
    stats.cards > 0 ? Math.round((stats.done / stats.cards) * 100) : 0;

  for (const req of Object.values(input.requirements || {})) {
    if (!boardIdSet.has(req.boardId)) continue;
    stats.requirements += 1;
    if (req.status === "done") stats.requirementsDone += 1;
  }

  return stats;
}

export function boardIndicatorChips(
  stats: BoardIndicatorStats,
  opts?: { compact?: boolean },
): IndicatorChip[] {
  const chips: IndicatorChip[] = [];

  if (stats.cards > 0) {
    chips.push({
      key: "progress",
      label: "Concluído",
      value: `${stats.progressPct}%`,
      tone: stats.progressPct >= 80 ? "ok" : stats.overdue > 0 ? "warn" : "info",
    });
    chips.push({
      key: "flow",
      label: "Fluxo",
      value: `${stats.done}/${stats.cards}`,
      tone: "neutral",
    });
  }

  if (stats.wip > 0) {
    chips.push({
      key: "wip",
      label: "Em curso",
      value: String(stats.wip),
      tone: "info",
    });
  }

  if (stats.overdue > 0) {
    chips.push({
      key: "overdue",
      label: "Atrasados",
      value: String(stats.overdue),
      tone: "danger",
      filter: { due: "overdue" },
    });
  }

  if (stats.dueSoon > 0) {
    chips.push({
      key: "soon",
      label: "Prazo próximo",
      value: String(stats.dueSoon),
      tone: "warn",
      filter: { due: "soon" },
    });
  }

  if (stats.highPriority > 0) {
    chips.push({
      key: "high",
      label: "Alta",
      value: String(stats.highPriority),
      tone: "warn",
      filter: { priority: "high" },
    });
  }

  if (stats.blocked > 0) {
    chips.push({
      key: "blocked",
      label: "Bloqueios",
      value: String(stats.blocked),
      tone: "danger",
    });
  }

  if (stats.unassigned > 0) {
    chips.push({
      key: "unassigned",
      label: "Sem responsável",
      value: String(stats.unassigned),
      tone: "neutral",
    });
  }

  if (stats.risks > 0) {
    chips.push({
      key: "risks",
      label: stats.risksHigh > 0 ? "Riscos (alta)" : "Riscos",
      value:
        stats.risksHigh > 0
          ? `${stats.risksHigh}/${stats.risks}`
          : String(stats.risks),
      tone: stats.risksHigh > 0 ? "danger" : "warn",
    });
  }

  if (stats.requirements > 0) {
    chips.push({
      key: "reqs",
      label: "Requisitos",
      value: `${stats.requirementsDone}/${stats.requirements}`,
      tone: stats.requirementsDone === stats.requirements ? "ok" : "info",
    });
  }

  if (!opts?.compact) return chips;
  const compactKeys = new Set([
    "progress",
    "flow",
    "overdue",
    "blocked",
    "risks",
    "high",
  ]);
  return chips.filter((chip) => compactKeys.has(chip.key));
}

export function stageBarSegments(stats: BoardIndicatorStats) {
  const total = stats.cards || 1;
  return [
    { key: "backlog", count: stats.backlog, className: "bg-white/45" },
    { key: "doing", count: stats.doing, className: "bg-amber-400" },
    { key: "review", count: stats.review, className: "bg-sky-400" },
    { key: "done", count: stats.done, className: "bg-lime-400" },
    { key: "other", count: stats.other, className: "bg-violet-400/80" },
  ]
    .filter((s) => s.count > 0)
    .map((s) => ({ ...s, pct: (s.count / total) * 100 }));
}
