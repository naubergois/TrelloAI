import { describe, expect, it } from "vitest";
import {
  localAiToolRespond,
  parseAiToolResponse,
  resolveEventDate,
  resolveListId,
  runBoardToolCall,
  type AiToolContext,
  type BoardToolOps,
} from "./ai-tools";

const ctx: AiToolContext = {
  boardId: "b1",
  boardTitle: "ASESI",
  today: "2026-08-25",
  lists: [
    {
      id: "todo",
      title: "A fazer",
      cards: [{ id: "c1", title: "Mapear", priority: "high" }],
    },
    { id: "risks", title: "Riscos Maya", systemKey: "maya-risks", cards: [] },
  ],
  members: [{ id: "u1", name: "Ana Costa" }],
  events: [{ id: "e1", title: "Daily ASESI", date: "2026-08-25", time: "09:00", kind: "meeting" }],
};

function ops(): BoardToolOps & {
  cards: string[];
  events: Record<string, unknown>[];
  lists: string[];
} {
  const state = {
    cards: [] as string[],
    events: [] as Record<string, unknown>[],
    lists: [] as string[],
    addList: (boardId: string, title: string) => {
      state.lists.push(title);
      return `list-${title}`;
    },
    addCard: (listId: string, title: string) => {
      state.cards.push(`${listId}:${title}`);
      return `card-${title}`;
    },
    createCalendarEvent: (input: Record<string, unknown>) => {
      state.events.push(input);
      return "ev-new";
    },
    updateCalendarEvent: () => {},
  };
  return state as unknown as BoardToolOps & {
    cards: string[];
    events: Record<string, unknown>[];
    lists: string[];
  };
}

describe("ai tools", () => {
  it("parses tool_calls JSON and legacy create_cards action", () => {
    const parsed = parseAiToolResponse(
      JSON.stringify({
        message: "Criei a daily.",
        tool_calls: [
          {
            name: "create_calendar_event",
            arguments: { title: "Daily", date: "2026-08-26", time: "09:00" },
          },
        ],
      }),
    );
    expect(parsed.toolCalls[0]?.name).toBe("create_calendar_event");
    const legacy = parseAiToolResponse(
      JSON.stringify({
        message: "ok",
        action: { type: "create_cards", listId: "todo", cards: [{ title: "X" }] },
      }),
    );
    expect(legacy.toolCalls[0]?.name).toBe("create_cards");
  });

  it("resolves dates and skips Maya list by default", () => {
    expect(resolveEventDate("amanhã", "2026-08-25")).toBe("2026-08-26");
    expect(resolveEventDate("26/08", "2026-08-25")).toBe("2026-08-26");
    expect(resolveListId(ctx)).toBe("todo");
    expect(resolveListId(ctx, null, "Riscos Maya")).toBe("risks");
  });

  it("creates cards and calendar events via tools", () => {
    const o = ops();
    const card = runBoardToolCall(
      { name: "create_card", arguments: { title: "Piloto", listTitle: "A fazer", assigneeName: "Ana" } },
      ctx,
      o,
    );
    expect(card.ok).toBe(true);
    expect(o.cards[0]).toContain("Piloto");

    const ev = runBoardToolCall(
      {
        name: "create_calendar_event",
        arguments: {
          title: "Daily",
          date: "amanhã",
          time: "09:00",
          meetingUrl: "https://teams.microsoft.com/l/meetup-join/abc",
        },
      },
      ctx,
      o,
    );
    expect(ev.ok).toBe(true);
    expect(o.events[0]?.meetingUrl).toContain("teams.microsoft.com");
    expect(o.events[0]?.date).toBe("2026-08-26");
  });

  it("local assistant schedules a Teams daily and can also create cards", () => {
    const onlyEvent = localAiToolRespond(
      "Agende a daily amanhã às 09:00 https://teams.microsoft.com/l/meetup-join/abc",
      ctx,
    );
    expect(onlyEvent.toolCalls.some((c) => c.name === "create_calendar_event")).toBe(true);

    const both = localAiToolRespond("Crie cards para o piloto e agende a review sexta 14:00", ctx);
    expect(both.toolCalls.some((c) => c.name === "create_cards")).toBe(true);
    expect(both.toolCalls.some((c) => c.name === "create_calendar_event")).toBe(true);
  });
});
