import { describe, expect, it } from "vitest";
import {
  buildMayaBoardMemory,
  formatMayaMemoryPrompt,
  mayaHistoryForModel,
} from "./maya-board-memory";
import type { Board, Card, List, MayaDayLog, StandupChatMessage } from "./types";

function board(over: Partial<Board> & Pick<Board, "id" | "title" | "level">): Board {
  return {
    description: "",
    listIds: [],
    memberIds: [],
    teamId: null,
    parentBoardId: null,
    backgroundId: "trello",
    designId: "classic",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...over,
  };
}

function list(over: Partial<List> & Pick<List, "id" | "boardId" | "title">): List {
  return { cardIds: [], ...over };
}

function card(over: Partial<Card> & Pick<Card, "id" | "listId" | "title">): Card {
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
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...over,
  };
}

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

describe("Maya board memory", () => {
  const boards = {
    cge: board({
      id: "cge",
      title: "CGE",
      level: "organization",
      executiveSummary: "Visão da controladoria.",
    }),
    asesi: board({
      id: "asesi",
      title: "ASESI",
      level: "team",
      parentBoardId: "cge",
      description: "Time de sistemas",
      executiveSummary: "Piloto Jangada e carteira de projetos.",
      listIds: ["todo", "done"],
    }),
    farol: board({
      id: "farol",
      title: "Farol",
      level: "project",
      parentBoardId: "asesi",
      executiveSummary: "Transparência de gastos.",
      objectives: "Publicar o painel de gastos.",
      applicationUrl: "https://farol.cge.ce.gov.br",
      listIds: ["f-todo"],
    }),
  };
  const lists: Record<string, List> = {
    todo: list({ id: "todo", boardId: "asesi", title: "A fazer", cardIds: ["c1"] }),
    done: list({ id: "done", boardId: "asesi", title: "Concluído", cardIds: ["c2"] }),
    "f-todo": list({
      id: "f-todo",
      boardId: "farol",
      title: "A fazer",
      cardIds: ["c3"],
    }),
  };
  const cards: Record<string, Card> = {
    c1: card({ id: "c1", listId: "todo", title: "Convite", dueDate: "2000-01-01" }),
    c2: card({ id: "c2", listId: "done", title: "Login" }),
    c3: card({ id: "c3", listId: "f-todo", title: "Painel" }),
  };
  const logs: Record<string, MayaDayLog> = {
    "asesi:2026-08-25": {
      id: "asesi:2026-08-25",
      boardId: "asesi",
      date: "2026-08-25",
      updatedAt: "2026-08-25T18:00:00.000Z",
      messages: [
        msg({
          id: "m1",
          role: "manager",
          content: "Ana, o convite ficou pendente.",
          createdAt: "2026-08-25T12:00:00.000Z",
        }),
        msg({
          id: "m2",
          content: "Fecho amanhã.",
          createdAt: "2026-08-25T12:01:00.000Z",
        }),
      ],
    },
  };

  it("loads this board, ancestors, children and prior chat", () => {
    const memory = buildMayaBoardMemory({
      boardId: "asesi",
      boards,
      lists,
      cards,
      members: { ana: { name: "Ana Costa" } },
      managerName: "Maya",
      logs,
    });
    expect(memory?.self.title).toBe("ASESI");
    expect(memory?.self.stats.cards).toBe(2);
    expect(memory?.self.stats.overdue).toBe(1);
    expect(memory?.related.map((b) => b.id)).toEqual(["cge", "farol"]);
    expect(memory?.chat.map((t) => t.content)).toEqual([
      "Ana, o convite ficou pendente.",
      "Fecho amanhã.",
    ]);
  });

  it("formats memory for the model before the user turn", () => {
    const memory = buildMayaBoardMemory({
      boardId: "asesi",
      boards,
      lists,
      cards,
      members: { ana: { name: "Ana Costa" } },
      managerName: "Maya",
      logs,
    });
    const prompt = formatMayaMemoryPrompt(memory!, "2026-08-26");
    expect(prompt).toMatch(/Board atual: ASESI/);
    expect(prompt).toMatch(/Piloto Jangada/);
    expect(prompt).toMatch(/atrasados/);
    expect(prompt).toMatch(/Farol/);
    expect(prompt).toMatch(/CGE/);
    expect(prompt).toMatch(/Fecho amanhã/);
    expect(prompt).toMatch(/não invente/i);
  });

  it("includes project objectives and application url", () => {
    const memory = buildMayaBoardMemory({
      boardId: "farol",
      boards,
      lists,
      cards,
      members: { ana: { name: "Ana Costa" } },
      managerName: "Maya",
      logs,
    });
    const prompt = formatMayaMemoryPrompt(memory!, "2026-08-26");
    expect(prompt).toMatch(/Objetivos:\nPublicar o painel de gastos/);
    expect(prompt).toMatch(/Link da aplicação: https:\/\/farol.cge.ce.gov.br/);
  });

  it("keeps chat history and avoids duplicating the latest user message", () => {
    const history = mayaHistoryForModel(
      [
        { role: "manager", content: "Oi, Ana." },
        { role: "member", who: "Ana Costa", content: "E o Farol?" },
      ],
      "E o Farol?",
    );
    expect(history).toEqual([
      { role: "assistant", content: "Oi, Ana." },
      { role: "user", content: "Ana Costa: E o Farol?" },
    ]);
  });
});
