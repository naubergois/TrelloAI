import { calendarDayKey } from "./calendar-report";
import { BOARD_LEVEL_LABELS, getBoardAncestors, getDescendantBoardIds } from "./board-hierarchy";
import { extractBoardIndicators, type BoardIndicatorStats } from "./board-indicators";
import { executiveSummaryExcerpt } from "./executive-summary";
import {
  collectMayaDayMessages,
  listMayaChatDays,
  mayaChatSpeakerName,
} from "./maya-chat";
import type {
  Board,
  Card,
  List,
  MayaDayLog,
  Requirement,
  StandupChatMessage,
  StandupSession,
  TeamMember,
} from "./types";

export const MAYA_MEMORY_CHAT_LIMIT = 24;
export const MAYA_MEMORY_RELATED_LIMIT = 20;
const TURN_CONTENT_MAX = 480;

export type MayaBoardRelation = "self" | "ancestor" | "child";

export type MayaRelatedBoardMemory = {
  id: string;
  title: string;
  level: string;
  relation: MayaBoardRelation;
  description: string;
  executiveSummary: string;
  stats: Pick<
    BoardIndicatorStats,
    "cards" | "progressPct" | "overdue" | "blocked" | "wip" | "risks" | "highPriority"
  >;
};

export type MayaMemoryTurn = {
  date: string;
  role: StandupChatMessage["role"];
  who: string;
  content: string;
};

export type MayaBoardMemory = {
  self: MayaRelatedBoardMemory;
  related: MayaRelatedBoardMemory[];
  chat: MayaMemoryTurn[];
};

function compactStats(stats: BoardIndicatorStats): MayaRelatedBoardMemory["stats"] {
  return {
    cards: stats.cards,
    progressPct: stats.progressPct,
    overdue: stats.overdue,
    blocked: stats.blocked,
    wip: stats.wip,
    risks: stats.risks,
    highPriority: stats.highPriority,
  };
}

function boardStats(
  boardId: string,
  boards: Record<string, Board>,
  lists: Record<string, List>,
  cards: Record<string, Card>,
  requirements?: Record<string, Requirement>,
) {
  return extractBoardIndicators({
    boardIds: [boardId],
    boards,
    lists,
    cards,
    requirements,
  });
}

function toRelated(
  board: Board,
  relation: MayaBoardRelation,
  boards: Record<string, Board>,
  lists: Record<string, List>,
  cards: Record<string, Card>,
  requirements?: Record<string, Requirement>,
): MayaRelatedBoardMemory {
  return {
    id: board.id,
    title: board.title,
    level: board.level,
    relation,
    description: board.description || "",
    executiveSummary: board.executiveSummary || "",
    stats: compactStats(boardStats(board.id, boards, lists, cards, requirements)),
  };
}

export function collectMayaChatMemory(opts: {
  boardId: string;
  managerName: string;
  members: Record<string, Pick<TeamMember, "name">>;
  logs?: Record<string, MayaDayLog>;
  standups?: Record<string, StandupSession>;
  limit?: number;
}): MayaMemoryTurn[] {
  const days = listMayaChatDays(opts.boardId, opts.logs, opts.standups);
  const turns: MayaMemoryTurn[] = [];
  for (const date of [...days].reverse()) {
    for (const msg of collectMayaDayMessages(opts.boardId, date, opts.logs, opts.standups)) {
      const content = msg.content.trim().slice(0, TURN_CONTENT_MAX);
      if (!content) continue;
      turns.push({
        date,
        role: msg.role,
        who: mayaChatSpeakerName(msg, opts.managerName, opts.members),
        content,
      });
    }
  }
  const limit = opts.limit ?? MAYA_MEMORY_CHAT_LIMIT;
  return turns.slice(Math.max(0, turns.length - limit));
}

export function buildMayaBoardMemory(opts: {
  boardId: string;
  boards: Record<string, Board>;
  lists: Record<string, List>;
  cards: Record<string, Card>;
  requirements?: Record<string, Requirement>;
  members: Record<string, Pick<TeamMember, "name">>;
  managerName: string;
  logs?: Record<string, MayaDayLog>;
  standups?: Record<string, StandupSession>;
}): MayaBoardMemory | null {
  const board = opts.boards[opts.boardId];
  if (!board) return null;

  const self = toRelated(
    board,
    "self",
    opts.boards,
    opts.lists,
    opts.cards,
    opts.requirements,
  );
  const related: MayaRelatedBoardMemory[] = [];
  for (const ancestor of getBoardAncestors(opts.boardId, opts.boards)) {
    related.push(
      toRelated(ancestor, "ancestor", opts.boards, opts.lists, opts.cards, opts.requirements),
    );
  }
  for (const id of getDescendantBoardIds(opts.boardId, opts.boards)) {
    const child = opts.boards[id];
    if (!child) continue;
    related.push(
      toRelated(child, "child", opts.boards, opts.lists, opts.cards, opts.requirements),
    );
  }

  return {
    self,
    related: related.slice(0, MAYA_MEMORY_RELATED_LIMIT),
    chat: collectMayaChatMemory({
      boardId: opts.boardId,
      managerName: opts.managerName,
      members: opts.members,
      logs: opts.logs,
      standups: opts.standups,
    }),
  };
}

function statsLine(stats: MayaRelatedBoardMemory["stats"]) {
  const parts = [`${stats.progressPct}% concluído`, `${stats.cards} cards`];
  if (stats.wip > 0) parts.push(`${stats.wip} em curso`);
  if (stats.overdue > 0) parts.push(`${stats.overdue} atrasados`);
  if (stats.blocked > 0) parts.push(`${stats.blocked} bloqueios`);
  if (stats.highPriority > 0) parts.push(`${stats.highPriority} alta`);
  if (stats.risks > 0) parts.push(`${stats.risks} riscos Maya`);
  return parts.join(" · ");
}

function relatedLine(board: MayaRelatedBoardMemory) {
  const level = BOARD_LEVEL_LABELS[board.level as keyof typeof BOARD_LEVEL_LABELS] || board.level;
  const relation =
    board.relation === "ancestor" ? "acima" : board.relation === "child" ? "abaixo" : "atual";
  const excerpt = executiveSummaryExcerpt(board.executiveSummary, 180);
  const bits = [
    `- ${board.title} (${level}, ${relation}) — ${statsLine(board.stats)}`,
  ];
  if (excerpt) bits.push(`  Resumo: ${excerpt}`);
  return bits.join("\n");
}

/** Texto injetado no system prompt da Maya antes da pergunta do usuário. */
export function formatMayaMemoryPrompt(memory: MayaBoardMemory, today = calendarDayKey()): string {
  const level =
    BOARD_LEVEL_LABELS[memory.self.level as keyof typeof BOARD_LEVEL_LABELS] || memory.self.level;
  const parent = memory.related.find((b) => b.relation === "ancestor");
  const lines = [
    `Board atual: ${memory.self.title} (${level}, id ${memory.self.id}).`,
    parent ? `Carteira: abaixo de ${parent.title}.` : null,
    memory.self.description ? `Descrição: ${memory.self.description}` : null,
    memory.self.executiveSummary
      ? `Resumo executivo:\n${memory.self.executiveSummary.trim().slice(0, 1200)}`
      : null,
    `Indicadores deste board: ${statsLine(memory.self.stats)}.`,
  ].filter(Boolean) as string[];

  if (memory.related.length > 0) {
    lines.push("", "Contexto dos outros boards da carteira (use para não misturar projetos):");
    for (const board of memory.related) lines.push(relatedLine(board));
  }

  if (memory.chat.length > 0) {
    lines.push("", `Memória de conversas neste board (até ${today}):`);
    for (const turn of memory.chat) {
      const tag = turn.role === "manager" ? "Maya" : turn.who;
      lines.push(`[${turn.date}] ${tag}: ${turn.content}`);
    }
  } else {
    lines.push("", "Ainda não há histórico de chat neste board.");
  }

  lines.push(
    "",
    "Regras da memória: não invente cards, prazos ou decisões que não estejam acima; se faltar dado, pergunte.",
  );
  return lines.join("\n");
}

export function mayaHistoryForModel(
  recentChat: { role: string; content: string; who?: string }[],
  currentUserMessage: string,
): { role: "user" | "assistant"; content: string }[] {
  const current = currentUserMessage.trim();
  const out: { role: "user" | "assistant"; content: string }[] = [];
  for (const turn of recentChat) {
    const content = turn.content.trim();
    if (!content) continue;
    const role = turn.role === "manager" ? "assistant" : "user";
    const labeled =
      role === "user" && turn.who ? `${turn.who}: ${content}` : content;
    out.push({ role, content: labeled });
  }
  if (current) {
    const last = out[out.length - 1];
    if (last?.role === "user" && (last.content === current || last.content.endsWith(current))) {
      return out;
    }
    out.push({ role: "user", content: current });
  }
  return out.slice(-MAYA_MEMORY_CHAT_LIMIT);
}
