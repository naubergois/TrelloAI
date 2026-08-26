import { describe, expect, it } from "vitest";
import { createAsesiBoardSeed } from "./asesi-seed";
import { calendarDayFromDate } from "./board-filters";
import {
  boardIndicatorChips,
  classifyListStage,
  extractBoardIndicators,
} from "./board-indicators";
import type { Board, Card, List } from "./types";

function shiftDay(days: number) {
  const d = new Date();
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

describe("classifyListStage", () => {
  it("maps common kanban titles", () => {
    expect(classifyListStage({ title: "A fazer" })).toBe("backlog");
    expect(classifyListStage({ title: "Backlog" })).toBe("backlog");
    expect(classifyListStage({ title: "Em progresso" })).toBe("doing");
    expect(classifyListStage({ title: "Em andamento" })).toBe("doing");
    expect(classifyListStage({ title: "Em revisão" })).toBe("review");
    expect(classifyListStage({ title: "Concluído" })).toBe("done");
    expect(classifyListStage({ title: "Riscos Maya", systemKey: "maya-risks" })).toBe(
      "risks",
    );
  });
});

describe("extractBoardIndicators", () => {
  it("computes flow, due dates and skips Maya risk cards from progress", () => {
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
        checklist: [
          { id: "i1", text: "a", done: true },
          { id: "i2", text: "b", done: false },
        ],
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
    const stats = extractBoardIndicators({
      boardIds: ["b1"],
      ...boardFixture(lists, cards),
    });

    expect(stats.cards).toBe(4);
    expect(stats.backlog).toBe(2);
    expect(stats.doing).toBe(1);
    expect(stats.done).toBe(1);
    expect(stats.progressPct).toBe(25);
    expect(stats.overdue).toBe(1);
    expect(stats.dueSoon).toBe(1);
    expect(stats.highPriority).toBe(1);
    expect(stats.blocked).toBe(1);
    expect(stats.unassigned).toBe(1);
    expect(stats.risks).toBe(1);
    expect(stats.risksHigh).toBe(1);
    expect(stats.checklistItems).toBe(2);
    expect(stats.checklistDone).toBe(1);
    expect(stats.wip).toBe(1);
  });

  it("extracts ASESI seed KPIs", () => {
    const seed = createAsesiBoardSeed();
    const stats = extractBoardIndicators({
      boardIds: [seed.board.id],
      boards: { [seed.board.id]: seed.board },
      lists: seed.lists,
      cards: seed.cards,
      requirements: seed.requirements,
    });

    expect(stats.cards).toBe(5);
    expect(stats.backlog).toBe(2);
    expect(stats.doing).toBe(1);
    expect(stats.review).toBe(1);
    expect(stats.done).toBe(1);
    expect(stats.progressPct).toBe(20);
    expect(stats.highPriority).toBe(2);
    expect(stats.unassigned).toBe(2);
    expect(stats.requirements).toBe(3);
    expect(stats.requirementsDone).toBe(0);
  });

  it("builds chips only for active signals", () => {
    const chips = boardIndicatorChips({
      cards: 4,
      backlog: 2,
      doing: 1,
      review: 0,
      done: 1,
      other: 0,
      wip: 1,
      progressPct: 25,
      overdue: 2,
      dueSoon: 0,
      dueToday: 0,
      highPriority: 1,
      unassigned: 0,
      blocked: 0,
      risks: 3,
      risksHigh: 1,
      requirements: 0,
      requirementsDone: 0,
      checklistItems: 0,
      checklistDone: 0,
    });
    const keys = chips.map((c) => c.key);
    expect(keys).toEqual(["progress", "flow", "wip", "overdue", "high", "risks"]);
    expect(chips.find((c) => c.key === "overdue")?.filter).toEqual({
      due: "overdue",
    });
    expect(
      boardIndicatorChips(
        {
          cards: 4,
          backlog: 2,
          doing: 1,
          review: 0,
          done: 1,
          other: 0,
          wip: 1,
          progressPct: 25,
          overdue: 2,
          dueSoon: 1,
          dueToday: 0,
          highPriority: 1,
          unassigned: 3,
          blocked: 0,
          risks: 3,
          risksHigh: 1,
          requirements: 2,
          requirementsDone: 0,
          checklistItems: 0,
          checklistDone: 0,
        },
        { compact: true },
      ).map((c) => c.key),
    ).toEqual(["progress", "flow", "overdue", "high", "risks"]);
  });
});
