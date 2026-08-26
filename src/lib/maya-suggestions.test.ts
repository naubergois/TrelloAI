import { describe, expect, it } from "vitest";
import { calendarDayFromDate } from "./board-filters";
import type { Board, Card, List, Requirement } from "./types";
import { suggestMayaActivities } from "./maya-suggestions";

function shiftDay(days: number, from = calendarDayFromDate()) {
  const d = new Date(`${from}T12:00:00`);
  d.setDate(d.getDate() + days);
  return calendarDayFromDate(d);
}

function boardFixture(lists: List[], cards: Card[]): {
  boards: Record<string, Board>;
  lists: Record<string, List>;
  cards: Record<string, Card>;
} {
  const board: Board = {
    id: "b1",
    title: "Projeto",
    description: "",
    listIds: lists.map((l) => l.id),
    memberIds: [],
    teamId: null,
    level: "project",
    parentBoardId: null,
    backgroundId: "trello",
    designId: "classic",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
  return {
    boards: { b1: board },
    lists: Object.fromEntries(lists.map((l) => [l.id, l])),
    cards: Object.fromEntries(cards.map((c) => [c.id, c])),
  };
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

describe("suggestMayaActivities", () => {
  it("asks Maya to create work when the board is empty", () => {
    const lists: List[] = [
      { id: "todo", boardId: "b1", title: "A fazer", cardIds: [] },
    ];
    const suggestions = suggestMayaActivities({
      boardIds: ["b1"],
      ...boardFixture(lists, []),
    });
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].kind).toBe("empty");
    expect(suggestions[0].openMaya).toBe(true);
  });

  it("prioritizes blocked and overdue cards as next activities", () => {
    const lists: List[] = [
      { id: "todo", boardId: "b1", title: "A fazer", cardIds: ["c1", "c2"] },
      { id: "doing", boardId: "b1", title: "Em progresso", cardIds: ["c3"] },
      { id: "done", boardId: "b1", title: "Concluído", cardIds: ["c4"] },
      {
        id: "risks",
        boardId: "b1",
        title: "Riscos Maya",
        cardIds: ["c5"],
        systemKey: "maya-risks",
      },
    ];
    const cards: Card[] = [
      card({
        id: "c1",
        listId: "todo",
        title: "Tarefa atrasada",
        dueDate: "2000-01-01",
        priority: "high",
      }),
      card({
        id: "c2",
        listId: "todo",
        title: "Bloqueio: API",
        dueDate: shiftDay(1),
        assigneeId: "u1",
      }),
      card({
        id: "c3",
        listId: "doing",
        title: "Em curso",
        assigneeId: "u1",
      }),
      card({ id: "c4", listId: "done", title: "Feito", dueDate: "2000-01-01" }),
      card({
        id: "c5",
        listId: "risks",
        title: "Risco git",
        origin: "maya",
        priority: "high",
      }),
    ];
    const suggestions = suggestMayaActivities({
      boardIds: ["b1"],
      rootBoardId: "b1",
      members: { u1: { id: "u1", name: "Ana" } },
      ...boardFixture(lists, cards),
    });

    expect(suggestions[0].kind).toBe("blocked");
    expect(suggestions[0].cardId).toBe("c2");
    expect(suggestions.some((s) => s.kind === "overdue" && s.cardId === "c1")).toBe(
      true,
    );
    expect(suggestions.some((s) => s.kind === "risk")).toBe(true);
    expect(suggestions.some((s) => s.cardId === "c5")).toBe(false);
    expect(suggestions.some((s) => s.cardId === "c4")).toBe(false);
  });

  it("groups multiple overdue cards and suggests assigning high-priority work", () => {
    const lists: List[] = [
      { id: "todo", boardId: "b1", title: "A fazer", cardIds: ["a", "b", "c"] },
    ];
    const cards: Card[] = [
      card({
        id: "a",
        listId: "todo",
        title: "Atraso 1",
        dueDate: "2000-01-01",
        priority: "high",
      }),
      card({
        id: "b",
        listId: "todo",
        title: "Atraso 2",
        dueDate: "2001-01-01",
        priority: "medium",
      }),
      card({
        id: "c",
        listId: "todo",
        title: "Alta parada",
        priority: "high",
      }),
    ];
    const suggestions = suggestMayaActivities({
      boardIds: ["b1"],
      limit: 6,
      ...boardFixture(lists, cards),
    });
    expect(suggestions.some((s) => s.id === "overdue-all")).toBe(true);
    expect(suggestions.find((s) => s.id === "overdue-all")?.filter).toEqual({
      due: "overdue",
    });
    expect(suggestions.some((s) => s.kind === "unassigned" && s.cardId === "c")).toBe(
      true,
    );
    expect(suggestions.filter((s) => s.cardId === "a").length).toBeLessThanOrEqual(1);
  });

  it("suggests a requirement without a kanban card", () => {
    const lists: List[] = [
      { id: "todo", boardId: "b1", title: "A fazer", cardIds: ["c1"] },
    ];
    const cards: Card[] = [
      card({ id: "c1", listId: "todo", title: "Algo em curso", priority: "low" }),
    ];
    const requirements: Record<string, Requirement> = {
      r1: {
        id: "r1",
        boardId: "b1",
        code: "REQ-1",
        title: "Login corporativo",
        description: "",
        status: "approved",
        priority: "high",
        ownerId: null,
        dueDate: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    };
    const suggestions = suggestMayaActivities({
      boardIds: ["b1"],
      requirements,
      ...boardFixture(lists, cards),
    });
    expect(suggestions.some((s) => s.kind === "requirement")).toBe(true);
    expect(suggestions.find((s) => s.kind === "requirement")?.openMaya).toBe(true);
  });

  it("falls back to the work in progress when the board is healthy", () => {
    const lists: List[] = [
      { id: "doing", boardId: "b1", title: "Em progresso", cardIds: ["c1"] },
    ];
    const cards: Card[] = [
      card({
        id: "c1",
        listId: "doing",
        title: "Homologar piloto",
        assigneeId: "u1",
        priority: "medium",
      }),
    ];
    const suggestions = suggestMayaActivities({
      boardIds: ["b1"],
      ...boardFixture(lists, cards),
    });
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].kind).toBe("next");
    expect(suggestions[0].cardId).toBe("c1");
    expect(suggestions[0].filter).toEqual({ query: "Homologar piloto" });
  });

  it("labels suggestions that come from a child board", () => {
    const parent: Board = {
      id: "cge",
      title: "CGE",
      description: "",
      listIds: [],
      memberIds: [],
      teamId: null,
      level: "organization",
      parentBoardId: null,
      backgroundId: "trello",
      designId: "classic",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const child: Board = {
      ...parent,
      id: "farol",
      title: "Farol",
      listIds: ["doing"],
      level: "project",
      parentBoardId: "cge",
    };
    const suggestions = suggestMayaActivities({
      boardIds: ["cge", "farol"],
      rootBoardId: "cge",
      boards: { cge: parent, farol: child },
      lists: {
        doing: { id: "doing", boardId: "farol", title: "Em progresso", cardIds: ["c1"] },
      },
      cards: {
        c1: card({
          id: "c1",
          listId: "doing",
          title: "Bloqueio: homologação",
          priority: "high",
        }),
      },
    });
    expect(suggestions[0].kind).toBe("blocked");
    expect(suggestions[0].boardTitle).toBe("Farol");
    expect(suggestions[0].detail).toContain("Farol");
  });

  it("respects the suggestion limit", () => {
    const ids = ["a", "b", "c", "d", "e", "f"];
    const lists: List[] = [
      { id: "todo", boardId: "b1", title: "A fazer", cardIds: ids },
    ];
    const cards = ids.map((id, i) =>
      card({
        id,
        listId: "todo",
        title: `Atraso ${id}`,
        dueDate: `200${i}-01-01`,
        priority: "high",
      }),
    );
    const suggestions = suggestMayaActivities({
      boardIds: ["b1"],
      limit: 3,
      ...boardFixture(lists, cards),
    });
    expect(suggestions.length).toBeLessThanOrEqual(3);
  });
});
