import { describe, expect, it } from "vitest";
import type { StandupChatMessage, StandupSession } from "./types";
import {
  collectMayaDayMessages,
  formatMayaChatTranscript,
  listMayaChatDays,
  mayaChatFileName,
  mergeMayaMessages,
  upsertMayaDayLog,
} from "./maya-chat";

function msg(
  over: Partial<StandupChatMessage> & Pick<StandupChatMessage, "id" | "content">,
): StandupChatMessage {
  return {
    role: "member",
    memberId: "ana",
    createdAt: "2026-08-26T12:00:00.000Z",
    ...over,
  };
}

function standup(over: Partial<StandupSession> & Pick<StandupSession, "id" | "date">): StandupSession {
  return {
    boardId: "board-1",
    status: "closed",
    questions: [],
    checkIns: [],
    chat: [],
    currentMemberIndex: 0,
    currentQuestionIndex: 0,
    awaitingReplyFrom: null,
    managerSummary: "",
    meetingId: null,
    createdAt: "2026-08-26T12:00:00.000Z",
    updatedAt: "2026-08-26T12:00:00.000Z",
    ...over,
  };
}

describe("Maya day chat history", () => {
  it("dedupes messages by id and keeps chronological order", () => {
    const merged = mergeMayaMessages(
      [msg({ id: "a", content: "oi", createdAt: "2026-08-26T12:01:00.000Z" })],
      [
        msg({ id: "a", content: "oi de novo", createdAt: "2026-08-26T12:01:00.000Z" }),
        msg({ id: "b", content: "depois", createdAt: "2026-08-26T12:02:00.000Z" }),
      ],
    );
    expect(merged.map((m) => m.id)).toEqual(["a", "b"]);
    expect(merged[0].content).toBe("oi de novo");
  });

  it("collects today's log plus standup chat without duplicating ids", () => {
    const logs = upsertMayaDayLog(
      {},
      "board-1",
      "2026-08-26",
      [msg({ id: "m1", content: "Ana aqui" })],
    );
    const standups = {
      s1: standup({
        id: "s1",
        date: "2026-08-26",
        chat: [
          msg({ id: "m1", content: "Ana aqui" }),
          msg({
            id: "m2",
            role: "manager",
            memberId: "ana",
            content: "Certo, Ana.",
            createdAt: "2026-08-26T12:03:00.000Z",
          }),
        ],
      }),
    };
    const collected = collectMayaDayMessages("board-1", "2026-08-26", logs, standups);
    expect(collected.map((m) => m.id)).toEqual(["m1", "m2"]);
  });

  it("lists previous days newest first and skips empty sessions", () => {
    const logs = upsertMayaDayLog(
      {},
      "board-1",
      "2026-08-25",
      [msg({ id: "old", content: "ontem" })],
    );
    const standups = {
      empty: standup({ id: "empty", date: "2026-08-24", chat: [] }),
      today: standup({
        id: "today",
        date: "2026-08-26",
        chat: [msg({ id: "now", content: "hoje" })],
      }),
    };
    expect(listMayaChatDays("board-1", logs, standups)).toEqual(["2026-08-26", "2026-08-25"]);
  });

  it("formats a downloadable transcript file", () => {
    const text = formatMayaChatTranscript({
      boardTitle: "ASESI",
      managerName: "Maya",
      date: "2026-08-25",
      members: { ana: { name: "Ana Costa" } },
      messages: [
        msg({
          id: "1",
          role: "manager",
          memberId: "ana",
          content: "Ana, o que você fez ontem?",
          createdAt: "2026-08-25T12:30:00.000Z",
        }),
        msg({
          id: "2",
          content: "Fechei o convite.",
          createdAt: "2026-08-25T12:31:00.000Z",
        }),
      ],
    });
    expect(text).toMatch(/Maya — conversa de/);
    expect(text).toMatch(/Board: ASESI/);
    expect(text).toMatch(/Maya · Ana Costa/);
    expect(text).toMatch(/Fechei o convite/);
    expect(mayaChatFileName("ASESI / CGE", "2026-08-25")).toBe("maya-asesi-cge-2026-08-25.txt");
  });
});
