import { describe, expect, it } from "vitest";
import { calendarDayKey, shiftCalendarDay } from "./calendar-report";
import {
  TEAM_BOARD_OVERDUE,
  TEAM_BOARD_UNDATED,
  buildTeamBoard,
  cardTeamBoardColumnKey,
  upcomingDayKeys,
} from "./team-board";
import type {
  Board,
  Card,
  List,
  TeamCalendarEvent,
  TeamMember,
} from "./types";
import { EMPTY_BOARD_FILTER } from "./board-filters";

const TODAY = "2026-08-26";

function member(id: string, name: string, extra?: Partial<TeamMember>): TeamMember {
  return {
    id,
    name,
    email: `${id}@cge.local`,
    role: "member",
    color: "teal",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...extra,
  };
}

function board(partial?: Partial<Board>): Board {
  return {
    id: "b1",
    title: "ASESI",
    description: "",
    listIds: ["todo", "doing", "done", "risks"],
    memberIds: ["ana", "leo"],
    teamId: null,
    level: "project",
    parentBoardId: null,
    backgroundId: "trello",
    designId: "classic",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

function list(id: string, title: string, cardIds: string[], extra?: Partial<List>): List {
  return { id, boardId: "b1", title, cardIds, ...extra };
}

function card(partial: Partial<Card> & Pick<Card, "id" | "listId" | "title">): Card {
  return {
    description: "",
    labels: [],
    dueDate: null,
    priority: null,
    assigneeId: null,
    requirementId: null,
    acceptanceCriteria: "",
    checklist: [],
    comments: [],
    archived: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

function fixture(cards: Card[], extra?: { events?: TeamCalendarEvent[]; members?: TeamMember[] }) {
  const lists: Record<string, List> = {
    todo: list("todo", "A fazer", cards.filter((c) => c.listId === "todo").map((c) => c.id)),
    doing: list("doing", "Em andamento", cards.filter((c) => c.listId === "doing").map((c) => c.id)),
    done: list("done", "Concluído", cards.filter((c) => c.listId === "done").map((c) => c.id)),
    risks: list("risks", "Riscos Maya", cards.filter((c) => c.listId === "risks").map((c) => c.id), {
      systemKey: "maya-risks",
    }),
  };
  const members: Record<string, TeamMember> = {
    ana: member("ana", "Ana Costa", { color: "amber" }),
    leo: member("leo", "Leo Martins", { color: "sky" }),
    ext: member("ext", "Consultor", { kind: "external", color: "violet" }),
  };
  for (const m of extra?.members || []) members[m.id] = m;
  return {
    boardIds: ["b1"],
    boards: { b1: board() },
    lists,
    cards: Object.fromEntries(cards.map((c) => [c.id, c])),
    members,
    events: extra?.events,
    today: TODAY,
    dayCount: 7,
  };
}

describe("upcomingDayKeys", () => {
  it("starts at today and spans the requested window", () => {
    expect(upcomingDayKeys(TODAY, 3)).toEqual([
      TODAY,
      "2026-08-27",
      "2026-08-28",
    ]);
  });
});

describe("cardTeamBoardColumnKey", () => {
  const days = new Set(upcomingDayKeys(TODAY, 7));

  it("places overdue, undated and in-window dates", () => {
    expect(cardTeamBoardColumnKey("2026-08-20", TODAY, days)).toBe(TEAM_BOARD_OVERDUE);
    expect(cardTeamBoardColumnKey(null, TODAY, days)).toBe(TEAM_BOARD_UNDATED);
    expect(cardTeamBoardColumnKey(TODAY, TODAY, days)).toBe(TODAY);
    expect(cardTeamBoardColumnKey("2026-08-28", TODAY, days)).toBe("2026-08-28");
  });

  it("ignores dates after the window", () => {
    expect(cardTeamBoardColumnKey("2026-09-20", TODAY, days)).toBeNull();
  });
});

describe("buildTeamBoard", () => {
  it("groups assigned work by person and upcoming day", () => {
    const model = buildTeamBoard(
      fixture([
        card({
          id: "c1",
          listId: "doing",
          title: "Validar piloto",
          assigneeId: "ana",
          dueDate: TODAY,
          priority: "high",
        }),
        card({
          id: "c2",
          listId: "todo",
          title: "Mapear processos",
          assigneeId: "leo",
          dueDate: "2026-08-28",
        }),
        card({
          id: "c3",
          listId: "todo",
          title: "Atrasada da Ana",
          assigneeId: "ana",
          dueDate: "2026-08-20",
        }),
        card({
          id: "c4",
          listId: "doing",
          title: "Sem prazo",
          assigneeId: "leo",
          dueDate: null,
        }),
      ]),
    );

    const ana = model.rows.find((r) => r.memberId === "ana");
    const leo = model.rows.find((r) => r.memberId === "leo");
    expect(ana?.cells[TODAY].cards.map((c) => c.cardId)).toEqual(["c1"]);
    expect(ana?.cells[TEAM_BOARD_OVERDUE].cards.map((c) => c.cardId)).toEqual(["c3"]);
    expect(ana?.overdueCount).toBe(1);
    expect(leo?.cells["2026-08-28"].cards.map((c) => c.cardId)).toEqual(["c2"]);
    expect(leo?.cells[TEAM_BOARD_UNDATED].cards.map((c) => c.cardId)).toEqual(["c4"]);
    expect(model.cardCount).toBe(4);
  });

  it("keeps every team member visible even without cards", () => {
    const model = buildTeamBoard(
      fixture([
        card({
          id: "c1",
          listId: "todo",
          title: "Só da Ana",
          assigneeId: "ana",
          dueDate: TODAY,
        }),
      ]),
    );
    expect(model.rows.map((r) => r.memberId)).toEqual(["ana", "leo"]);
    expect(model.rows.find((r) => r.memberId === "leo")?.assignedCount).toBe(0);
  });

  it("duplicates shared cards on each assignee and lists unassigned work", () => {
    const model = buildTeamBoard(
      fixture([
        card({
          id: "shared",
          listId: "doing",
          title: "Pair",
          assigneeIds: ["ana", "leo"],
          dueDate: TODAY,
        }),
        card({
          id: "free",
          listId: "todo",
          title: "Ninguém",
          dueDate: TODAY,
        }),
      ]),
    );
    expect(
      model.rows.find((r) => r.memberId === "ana")?.cells[TODAY].cards[0].cardId,
    ).toBe("shared");
    expect(
      model.rows.find((r) => r.memberId === "leo")?.cells[TODAY].cards[0].cardId,
    ).toBe("shared");
    const none = model.rows.find((r) => r.kind === "unassigned");
    expect(none?.cells[TODAY].cards.map((c) => c.cardId)).toEqual(["free"]);
  });

  it("skips done, risks, archived and dates beyond the window", () => {
    const model = buildTeamBoard(
      fixture([
        card({
          id: "done",
          listId: "done",
          title: "Já concluído",
          assigneeId: "ana",
          dueDate: TODAY,
        }),
        card({
          id: "risk",
          listId: "risks",
          title: "Risco Maya",
          assigneeId: "ana",
          dueDate: TODAY,
        }),
        card({
          id: "arch",
          listId: "todo",
          title: "Arquivado",
          assigneeId: "ana",
          dueDate: TODAY,
          archived: true,
        }),
        card({
          id: "later",
          listId: "todo",
          title: "Daqui a um mês",
          assigneeId: "ana",
          dueDate: "2026-09-26",
        }),
      ]),
    );
    expect(model.cardCount).toBe(0);
    expect(model.beyondWindowCount).toBe(1);
    expect(model.rows.find((r) => r.memberId === "ana")?.assignedCount).toBe(0);
  });

  it("merges members that share the same email into one row", () => {
    const model = buildTeamBoard(
      fixture(
        [
          card({
            id: "c1",
            listId: "todo",
            title: "Do clone",
            assigneeId: "ana-clone",
            dueDate: TODAY,
          }),
        ],
        {
          members: [
            member("ana-clone", "Ana Costa", {
              email: "ana@cge.local",
              color: "rose",
            }),
          ],
        },
      ),
    );
    const anaRows = model.rows.filter((r) => /Ana Costa/i.test(r.name));
    expect(anaRows).toHaveLength(1);
    expect(anaRows[0].cells[TODAY].cards.map((c) => c.cardId)).toEqual(["c1"]);
  });

  it("places calendar events on the matching people and day", () => {
    const model = buildTeamBoard(
      fixture([], {
        events: [
          {
            id: "e1",
            boardId: "b1",
            teamId: null,
            title: "Daily",
            description: "",
            kind: "meeting",
            date: TODAY,
            time: "09:00",
            memberIds: ["ana", "leo"],
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      }),
    );
    expect(
      model.rows.find((r) => r.memberId === "ana")?.cells[TODAY].events[0].title,
    ).toBe("Daily");
    expect(model.eventCount).toBe(1);
  });

  it("honors the board card filter", () => {
    const model = buildTeamBoard({
      ...fixture([
        card({
          id: "c1",
          listId: "todo",
          title: "Alta da Ana",
          assigneeId: "ana",
          priority: "high",
          dueDate: TODAY,
        }),
        card({
          id: "c2",
          listId: "todo",
          title: "Média do Leo",
          assigneeId: "leo",
          priority: "medium",
          dueDate: TODAY,
        }),
      ]),
      filter: { ...EMPTY_BOARD_FILTER, assigneeId: "ana" },
    });
    expect(model.cardCount).toBe(1);
    expect(
      model.rows.find((r) => r.memberId === "ana")?.cells[TODAY].cards[0].cardId,
    ).toBe("c1");
    expect(
      model.rows.find((r) => r.memberId === "leo")?.cells[TODAY].cards,
    ).toEqual([]);
  });
});

describe("calendar helpers stay aligned", () => {
  it("uses the same local day key as the rest of the app", () => {
    expect(shiftCalendarDay(calendarDayKey(new Date(2026, 7, 26)), 1)).toBe(
      "2026-08-27",
    );
  });
});
