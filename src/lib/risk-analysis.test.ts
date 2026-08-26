import { describe, expect, it } from "vitest";
import { analyzeBoardRisks, analyzeGitCoverage, matchCoverage } from "./risk-analysis";

describe("Maya risk and git coverage", () => {
  it("marks login as implemented when files mention login", () => {
    expect(
      matchCoverage("Login admin", "src/app/login/page.tsx\nsrc/app/admin/usuarios/page.tsx").status,
    ).toBe("implemented");
    expect(matchCoverage("Integração SIGE metas", "src/app/login/page.tsx").status).toBe(
      "missing",
    );
  });

  it("flags overdue high-priority backlog cards", () => {
    const risks = analyzeBoardRisks({
      today: "2026-08-25",
      lists: [
        {
          id: "backlog",
          title: "Backlog",
          cards: [
            {
              id: "c1",
              title: "Deploy homolog",
              priority: "high",
              dueDate: "2026-08-01",
              assigneeId: null,
            },
          ],
        },
      ],
    });
    expect(risks.some((r) => r.id.startsWith("overdue"))).toBe(true);
    expect(risks.some((r) => r.id.startsWith("stuck-high"))).toBe(true);
    expect(risks.some((r) => r.id.startsWith("unassigned"))).toBe(true);
  });

  it("covers cards against a file list", () => {
    const coverage = analyzeGitCoverage({
      cards: [
        { id: "1", title: "Login admin" },
        { id: "2", title: "Cadastro SIGE" },
      ],
      requirements: [{ id: "r1", title: "Auth credentials", code: "ASESI-R01" }],
      files: ["src/app/login/page.tsx", "src/auth.ts", "src/app/admin/usuarios/page.tsx"],
      readmeExcerpt: "Jangada login com usuário e senha",
    });
    expect(coverage.find((c) => c.id === "1")?.status).toBe("implemented");
    expect(coverage.find((c) => c.id === "2")?.status).toBe("missing");
  });
});
