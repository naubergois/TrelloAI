import { describe, expect, it } from "vitest";
import { localManagerChat, type ManagerContext } from "./manager";

function context(over: Partial<ManagerContext> = {}): ManagerContext {
  return {
    boardTitle: "ASESI",
    managerName: "Maya",
    members: [],
    memberNames: {},
    checkIns: [],
    lists: [
      {
        id: "backlog",
        title: "Backlog",
        cards: [{ id: "c1", title: "Login admin", description: "", priority: "high" }],
      },
    ],
    risks: [
      {
        title: "Alta prioridade parada: Login admin",
        severity: "high",
        reason: "Card de prioridade alta ainda no backlog.",
      },
    ],
    git: [
      {
        url: "http://git.cge.local/g_asesi/jangada.git",
        ok: true,
        fileCount: 2,
        files: ["src/app/login/page.tsx"],
        hints: ["Next.js"],
        coverage: [
          { title: "Login admin", status: "implemented", evidence: "login, admin" },
          { title: "Cadastro SIGE", status: "missing" },
        ],
      },
    ],
    ...over,
  };
}

describe("Maya local risk/git chat", () => {
  it("summarizes implemented vs missing and creates a gap card", () => {
    const result = localManagerChat("Analise os riscos e o Git", context());
    expect(result.message).toMatch(/Login admin/);
    expect(result.message).toMatch(/Cadastro SIGE/);
    expect(result.action.type).toBe("create_cards");
    if (result.action.type === "create_cards") {
      expect(result.action.cards.some((c) => /Cadastro SIGE/.test(c.title))).toBe(true);
    }
  });

  it("asks to link git when there is no repo", () => {
    const result = localManagerChat("Compare o que está implementado", context({ git: [], risks: [] }));
    expect(result.message).toMatch(/Ligue um repositório Git/);
  });

  it("answers from board memory before inventing work", () => {
    const result = localManagerChat(
      "Qual a situação deste board?",
      context({
        executiveSummary: "Piloto Jangada.",
        memoryBrief: "Board atual: ASESI (time).\nIndicadores deste board: 40% concluído · 10 cards.",
      }),
    );
    expect(result.action.type).toBe("none");
    expect(result.message).toMatch(/ASESI/);
    expect(result.message).toMatch(/Piloto Jangada/);
    expect(result.message).toMatch(/40%/);
  });
});
