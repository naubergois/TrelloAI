import { calendarDayKey, formatCalendarDayLabel, shiftCalendarDay } from "./calendar-report";
import { classifyListStage, type ListStage } from "./board-indicators";
import { cardMatchesFilter, type BoardCardFilter } from "./board-filters";
import { isMayaRisksList } from "./maya-risk-column";
import { boardAssigneeOptions, cardAssigneeIds } from "./members";
import type {
  Board,
  Card,
  List,
  Team,
  TeamCalendarEvent,
  TeamEventKind,
  TeamMember,
} from "./types";

export const TEAM_BOARD_OVERDUE = "overdue";
export const TEAM_BOARD_UNDATED = "undated";

export type TeamBoardColumnKind = "overdue" | "day" | "undated";

export type TeamBoardColumn = {
  key: string;
  kind: TeamBoardColumnKind;
  date?: string;
  label: string;
  weekday?: string;
  dayNumber?: string;
};

export type TeamBoardCardItem = {
  cardId: string;
  title: string;
  dueDate: string | null;
  priority: Card["priority"];
  listTitle: string;
  listStage: ListStage;
  boardId: string;
  boardTitle: string;
};

export type TeamBoardEventItem = {
  eventId: string;
  title: string;
  time: string | null;
  kind: TeamEventKind;
  date: string;
};

export type TeamBoardCell = {
  cards: TeamBoardCardItem[];
  events: TeamBoardEventItem[];
};

export type TeamBoardRow = {
  memberId: string | null;
  name: string;
  member: TeamMember | null;
  kind: "team" | "external" | "unassigned";
  cells: Record<string, TeamBoardCell>;
  assignedCount: number;
  overdueCount: number;
};

export type TeamBoardModel = {
  today: string;
  dayCount: number;
  columns: TeamBoardColumn[];
  rows: TeamBoardRow[];
  beyondWindowCount: number;
  cardCount: number;
  eventCount: number;
};

export type BuildTeamBoardInput = {
  boardIds: string[];
  boards: Record<string, Board>;
  lists: Record<string, List>;
  cards: Record<string, Card>;
  members: Record<string, TeamMember>;
  team?: Team | null;
  events?: TeamCalendarEvent[];
  filter?: BoardCardFilter;
  today?: string;
  dayCount?: number;
  includeDone?: boolean;
};

function emptyCell(): TeamBoardCell {
  return { cards: [], events: [] };
}

export function upcomingDayKeys(today: string, count: number): string[] {
  const n = Math.max(1, Math.min(31, Math.floor(count)));
  return Array.from({ length: n }, (_, i) => shiftCalendarDay(today, i));
}

export function formatTeamBoardWeekday(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat("pt-BR", { weekday: "short" }).format(dt);
}

export function cardTeamBoardColumnKey(
  dueDate: string | null | undefined,
  today: string,
  daySet: Set<string>,
): string | null {
  if (!dueDate) return TEAM_BOARD_UNDATED;
  if (dueDate < today) return TEAM_BOARD_OVERDUE;
  if (daySet.has(dueDate)) return dueDate;
  return null;
}

export function buildTeamBoardColumns(
  today: string,
  dayCount = 7,
): TeamBoardColumn[] {
  const days = upcomingDayKeys(today, dayCount);
  return [
    {
      key: TEAM_BOARD_OVERDUE,
      kind: "overdue",
      label: "Atrasadas",
    },
    ...days.map((date) => ({
      key: date,
      kind: "day" as const,
      date,
      label: formatCalendarDayLabel(date),
      weekday: formatTeamBoardWeekday(date),
      dayNumber: String(Number(date.slice(-2))),
    })),
    {
      key: TEAM_BOARD_UNDATED,
      kind: "undated",
      label: "Sem prazo",
    },
  ];
}

function sortCards(a: TeamBoardCardItem, b: TeamBoardCardItem) {
  const rank = { high: 0, medium: 1, low: 2 } as const;
  const pa = a.priority ? rank[a.priority] : 3;
  const pb = b.priority ? rank[b.priority] : 3;
  if (pa !== pb) return pa - pb;
  return a.title.localeCompare(b.title, "pt-BR");
}

function sortEvents(a: TeamBoardEventItem, b: TeamBoardEventItem) {
  return `${a.time || "99:99"}${a.title}`.localeCompare(
    `${b.time || "99:99"}${b.title}`,
    "pt-BR",
  );
}

function ensureCell(row: TeamBoardRow, key: string): TeamBoardCell {
  if (!row.cells[key]) row.cells[key] = emptyCell();
  return row.cells[key];
}

export function buildTeamBoard(input: BuildTeamBoardInput): TeamBoardModel {
  const today = input.today ?? calendarDayKey();
  const dayCount = input.dayCount ?? 7;
  const columns = buildTeamBoardColumns(today, dayCount);
  const daySet = new Set(
    columns.filter((c) => c.kind === "day").map((c) => c.key),
  );
  const includeDone = input.includeDone ?? false;
  const filter = input.filter;
  const rootBoard = input.boards[input.boardIds[0] ?? ""];

  const options = rootBoard
    ? boardAssigneeOptions({
        board: rootBoard,
        members: input.members,
        team: input.team,
      })
    : { team: [] as TeamMember[], external: [] as TeamMember[] };

  const rowsById = new Map<string, TeamBoardRow>();
  const makeRow = (
    memberId: string | null,
    name: string,
    member: TeamMember | null,
    kind: TeamBoardRow["kind"],
  ): TeamBoardRow => ({
    memberId,
    name,
    member,
    kind,
    cells: Object.fromEntries(columns.map((col) => [col.key, emptyCell()])),
    assignedCount: 0,
    overdueCount: 0,
  });

  const rowByEmail = new Map<string, TeamBoardRow>();
  for (const member of options.team) {
    const email = member.email?.trim().toLowerCase() || "";
    const merged = email ? rowByEmail.get(email) : undefined;
    if (merged) {
      rowsById.set(member.id, merged);
      continue;
    }
    const row = makeRow(member.id, member.name, member, "team");
    rowsById.set(member.id, row);
    if (email) rowByEmail.set(email, row);
  }

  const rowForAssignee = (id: string): TeamBoardRow => {
    const existing = rowsById.get(id);
    if (existing) return existing;
    const member = input.members[id] ?? null;
    const email = member?.email?.trim().toLowerCase() || "";
    const merged = email ? rowByEmail.get(email) : undefined;
    if (merged) {
      rowsById.set(id, merged);
      return merged;
    }
    const row = makeRow(
      id,
      member?.name || "Pessoa",
      member,
      "external",
    );
    rowsById.set(id, row);
    if (email) rowByEmail.set(email, row);
    return row;
  };

  const unassigned = makeRow(null, "Sem responsável", null, "unassigned");
  let beyondWindowCount = 0;
  let cardCount = 0;

  const seenCards = new Set<string>();
  for (const boardId of input.boardIds) {
    const board = input.boards[boardId];
    if (!board) continue;
    for (const listId of board.listIds) {
      const list = input.lists[listId];
      if (!list) continue;
      const stage = classifyListStage(list);
      if (stage === "risks" || isMayaRisksList(list)) continue;
      if (!includeDone && stage === "done") continue;

      for (const cardId of list.cardIds) {
        if (seenCards.has(cardId)) continue;
        const card = input.cards[cardId];
        if (!card || card.archived) continue;
        seenCards.add(cardId);
        if (filter && !cardMatchesFilter(card, filter)) continue;

        const columnKey = cardTeamBoardColumnKey(card.dueDate, today, daySet);
        if (!columnKey) {
          beyondWindowCount += 1;
          continue;
        }

        const item: TeamBoardCardItem = {
          cardId: card.id,
          title: card.title,
          dueDate: card.dueDate,
          priority: card.priority,
          listTitle: list.title,
          listStage: stage,
          boardId: board.id,
          boardTitle: board.title,
        };

        const assigneeIds = cardAssigneeIds(card);
        const targetRows: TeamBoardRow[] = [];
        if (assigneeIds.length === 0) {
          targetRows.push(unassigned);
        } else {
          const seenRows = new Set<TeamBoardRow>();
          for (const id of assigneeIds) {
            const row = rowForAssignee(id);
            if (seenRows.has(row)) continue;
            seenRows.add(row);
            targetRows.push(row);
          }
        }

        cardCount += 1;
        for (const row of targetRows) {
          ensureCell(row, columnKey).cards.push(item);
          row.assignedCount += 1;
          if (columnKey === TEAM_BOARD_OVERDUE) row.overdueCount += 1;
        }
      }
    }
  }

  const events = (input.events || []).filter((ev) =>
    input.boardIds.includes(ev.boardId),
  );
  let eventCount = 0;
  for (const ev of events) {
    if (!daySet.has(ev.date)) continue;
    const item: TeamBoardEventItem = {
      eventId: ev.id,
      title: ev.title,
      time: ev.time,
      kind: ev.kind,
      date: ev.date,
    };
    const memberIds =
      ev.memberIds.length > 0
        ? ev.memberIds
        : options.team.map((m) => m.id);
    let placed = false;
    const seenEventRows = new Set<TeamBoardRow>();
    for (const id of memberIds) {
      const row = rowsById.get(id);
      if (!row || seenEventRows.has(row)) continue;
      seenEventRows.add(row);
      ensureCell(row, ev.date).events.push(item);
      placed = true;
    }
    if (placed) eventCount += 1;
  }

  const uniqueRows = [...new Map(
    [...rowsById.values()].map((row) => [row.memberId, row]),
  ).values()];
  const teamRows = uniqueRows
    .filter((row) => row.kind === "team")
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const extraRows = uniqueRows
    .filter((row) => row.kind !== "team")
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  const hasUnassigned = Object.values(unassigned.cells).some(
    (cell) => cell.cards.length > 0,
  );

  for (const row of [...teamRows, ...extraRows, unassigned]) {
    for (const cell of Object.values(row.cells)) {
      cell.cards.sort(sortCards);
      cell.events.sort(sortEvents);
    }
  }

  return {
    today,
    dayCount,
    columns,
    rows: [...teamRows, ...extraRows, ...(hasUnassigned ? [unassigned] : [])],
    beyondWindowCount,
    cardCount,
    eventCount,
  };
}
