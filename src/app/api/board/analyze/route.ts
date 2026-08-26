import { NextResponse } from "next/server";
import { inspectGitRepo } from "@/lib/git-inspect";
import { analyzeBoardRisks } from "@/lib/risk-analysis";
import { checkRateLimit, requireSession, assertBodySize } from "@/lib/api-security";
import type { BoardRiskReport, Card, Requirement } from "@/lib/types";

export async function POST(request: Request) {
  const { session, error } = await requireSession();
  if (error) return error;

  const raw = await request.text();
  const sizeCheck = assertBodySize(raw, 800_000);
  if (!sizeCheck.ok) return sizeCheck.response;

  const rate = checkRateLimit(`git-inspect:${session!.user!.email}`, 12, 60_000);
  if (!rate.ok) return rate.response;

  try {
    const body = JSON.parse(raw) as {
      urls?: string[];
      lists?: {
        id: string;
        title: string;
        cards: Pick<Card, "id" | "title" | "priority" | "dueDate" | "assigneeId">[];
      }[];
      requirements?: Pick<Requirement, "id" | "title" | "code" | "status">[];
    };

    const lists = body.lists || [];
    const cards = lists.flatMap((l) => l.cards.map((c) => ({ id: c.id, title: c.title })));
    const requirements = (body.requirements || []).map((r) => ({
      id: r.id,
      title: r.title,
      code: r.code,
      status: r.status,
    }));

    const git = [];
    for (const url of (body.urls || []).slice(0, 4)) {
      git.push(
        await inspectGitRepo(url, {
          cards,
          requirements,
        }),
      );
    }

    const coverageRisks = git.flatMap((report) =>
      report.coverage
        .filter((item) => item.status === "missing")
        .slice(0, 8)
        .map((item) => ({
          id: `git-miss-${item.id}`,
          title: `Não encontrado no git: ${item.title}`,
          severity: "medium" as const,
          reason: `O ${item.kind === "requirement" ? "requisito" : "card"} não aparece nos arquivos de ${report.url}.`,
        })),
    );

    const risks = [
      ...analyzeBoardRisks({ lists, requirements }),
      ...coverageRisks,
    ].slice(0, 20);

    const report: BoardRiskReport = {
      analyzedAt: new Date().toISOString(),
      risks,
      git,
    };

    return NextResponse.json({ report });
  } catch {
    return NextResponse.json({ error: "Falha ao inspecionar Git / riscos." }, { status: 500 });
  }
}
