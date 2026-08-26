import { NextResponse } from "next/server";
import { inspectGitRepo } from "@/lib/git-inspect";
import { checkRateLimit, requireSession, assertBodySize } from "@/lib/api-security";
import { buildAnalyzeReportFromGit } from "@/lib/maya-git-job";
import { isMayaRisksList } from "@/lib/maya-risk-column";
import type { Card, Requirement } from "@/lib/types";

export async function POST(request: Request) {
  const { session, error } = await requireSession();
  if (error) return error;

  const raw = await request.text();
  const sizeCheck = assertBodySize(raw, 800_000);
  if (!sizeCheck.ok) return sizeCheck.response;

  const rate = checkRateLimit(`git-inspect:${session!.user!.email}`, 8, 60_000);
  if (!rate.ok) return rate.response;

  try {
    const body = JSON.parse(raw) as {
      urls?: string[];
      clone?: boolean;
      lists?: {
        id: string;
        title: string;
        systemKey?: string | null;
        cards: (Pick<Card, "id" | "title" | "priority" | "dueDate" | "assigneeId"> & {
          origin?: string | null;
        })[];
      }[];
      requirements?: Pick<Requirement, "id" | "title" | "code" | "status">[];
    };

    const lists = (body.lists || [])
      .filter((list) => !isMayaRisksList(list))
      .map((list) => ({
        ...list,
        cards: (list.cards || []).filter((c) => c.origin !== "maya"),
      }));
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
        await inspectGitRepo(
          url,
          { cards, requirements },
          { preferClone: Boolean(body.clone) },
        ),
      );
    }

    const report = buildAnalyzeReportFromGit(lists, git, requirements);
    return NextResponse.json({ report });
  } catch {
    return NextResponse.json({ error: "Falha ao inspecionar Git / riscos." }, { status: 500 });
  }
}
