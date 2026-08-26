import { describe, expect, it } from "vitest";
import { buildMayaGreetingMessage } from "./maya-voice";

describe("Maya nerd greeting", () => {
  it("mentions the live board instead of a generic hello", () => {
    const text = buildMayaGreetingMessage({
      managerName: "Maya",
      boardTitle: "Carteira ASESI",
      lists: [{ cards: [{ id: "c1" }] }],
    });
    expect(text).toMatch(/Carteira ASESI/);
    expect(text).toMatch(/1 card/);
    expect(text).toMatch(/observo o board/);
  });

  it("uses conversation history and refuses to replay the last action", () => {
    const text = buildMayaGreetingMessage({
      managerName: "Maya",
      boardTitle: "Carteira ASESI",
      lists: [{ cards: [{}, {}] }],
      recentChat: [
        { role: "member", content: "oi" },
        {
          role: "manager",
          content:
            "Atribuí a tarefa de alta prioridade 'Carteira ASESI no Jangada' ao Charles Marques.",
        },
        { role: "member", content: "oi" },
      ],
    });
    expect(text).toMatch(/Carteira ASESI/);
    expect(text).toMatch(/replay/);
    expect(text).not.toMatch(/Atribuí/);
  });

  it("recalls the last real request after a greeting", () => {
    const text = buildMayaGreetingMessage({
      managerName: "Maya",
      boardTitle: "ASESI",
      lists: [{ cards: [] }],
      recentChat: [
        { role: "member", content: "Crie cards para o plano ASESI" },
        { role: "manager", content: "Criei 3 cards no backlog." },
        { role: "member", content: "oi" },
      ],
    });
    expect(text).toMatch(/Crie cards para o plano ASESI/);
    expect(text).toMatch(/não mexo no kanban/);
  });
});
