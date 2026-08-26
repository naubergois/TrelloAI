import { describe, expect, it } from "vitest";
import { extractBoardIndicators, type BoardIndicatorStats } from "./board-indicators";
import {
  draftExecutiveSummary,
  EXECUTIVE_SUMMARY_MAX,
  executiveSummaryExcerpt,
  sanitizeExecutiveSummary,
} from "./executive-summary";
import type { Board, Card, List } from "./types";

function emptyStats(overrides: Partial<BoardIndicatorStats> = {}): BoardIndicatorStats {
  return {
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
    ...overrides,
  };
}

describe("sanitizeExecutiveSummary", () => {
  it("trims, normalizes newlines and caps length", () => {
    expect(sanitizeExecutiveSummary("  olá\r\nmundo  ")).toBe("olá\nmundo");
    expect(sanitizeExecutiveSummary("x".repeat(EXECUTIVE_SUMMARY_MAX + 20))).toHaveLength(
      EXECUTIVE_SUMMARY_MAX,
    );
    expect(sanitizeExecutiveSummary(null)).toBe("");
  });
});

describe("executiveSummaryExcerpt", () => {
  it("collapses whitespace and ellipsizes", () => {
    expect(executiveSummaryExcerpt("um   texto\ncurto")).toBe("um texto curto");
    expect(executiveSummaryExcerpt("abcdefghij", 6)).toBe("abcde…");
  });
});

describe("draftExecutiveSummary", () => {
  it("builds a leadership-facing text from indicators", () => {
    const text = draftExecutiveSummary({
      title: "ASESI",
      description: "Time de sistemas",
      descendantCount: 2,
      stats: emptyStats({
        cards: 10,
        done: 4,
        doing: 2,
        review: 1,
        backlog: 3,
        wip: 3,
        progressPct: 40,
        overdue: 1,
        blocked: 1,
        risks: 2,
        risksHigh: 1,
        requirements: 3,
        requirementsDone: 1,
      }),
    });
    expect(text).toContain("ASESI — resumo executivo");
    expect(text).toContain("Time de sistemas");
    expect(text).toContain("40% concluído");
    expect(text).toContain("Atrasados: 1");
    expect(text).toContain("Riscos: 2 (1 alta)");
    expect(text).toContain("Requisitos: 1/3");
    expect(text).toContain("2 boards inferiores");
  });

  it("stays in sync with live board stats", () => {
    const board: Board = {
      id: "b1",
      title: "Projeto",
      description: "",
      listIds: ["todo", "done"],
      memberIds: [],
      teamId: null,
      level: "project",
      parentBoardId: null,
      backgroundId: "trello",
      designId: "classic",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const lists: Record<string, List> = {
      todo: { id: "todo", boardId: "b1", title: "A fazer", cardIds: ["c1"] },
      done: { id: "done", boardId: "b1", title: "Concluído", cardIds: ["c2"] },
    };
    const cards: Record<string, Card> = {
      c1: {
        id: "c1",
        listId: "todo",
        title: "Mapear",
        description: "",
        labels: [],
        dueDate: null,
        priority: "high",
        assigneeId: null,
        requirementId: null,
        acceptanceCriteria: "",
        checklist: [],
        comments: [],
        archived: false,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      c2: {
        id: "c2",
        listId: "done",
        title: "Entregar",
        description: "",
        labels: [],
        dueDate: null,
        priority: "low",
        assigneeId: null,
        requirementId: null,
        acceptanceCriteria: "",
        checklist: [],
        comments: [],
        archived: false,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    };
    const stats = extractBoardIndicators({
      boardIds: ["b1"],
      boards: { b1: board },
      lists,
      cards,
    });
    const text = draftExecutiveSummary({ title: "Projeto", stats });
    expect(text).toContain("50% concluído (1/2 cards)");
    expect(text).toContain("Alta prioridade: 1");
  });
});
