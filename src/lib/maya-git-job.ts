import type { BoardSnapshot } from "@/lib/board-snapshot";
import type { BoardRisk, BoardRiskReport, Card } from "@/lib/types";
import { inspectGitRepo } from "@/lib/git-inspect";
import { analyzeBoardRisks } from "@/lib/risk-analysis";
import { shouldRefreshClone } from "@/lib/git-clone";
import {
  cloneBoardPieces,
  isMayaRisksList,
  syncMayaRiskCards,
} from "@/lib/maya-risk-column";
import { listAllSharedBoards, saveSharedBoard } from "@/lib/shared-boards";

function snapshotLists(snapshot: BoardSnapshot) {
  return (snapshot.board.listIds || [])
    .map((id) => snapshot.lists[id])
    .filter(Boolean)
    .filter((list) => !isMayaRisksList(list))
    .map((list) => ({
      id: list.id,
      title: list.title,
      cards: (list.cardIds || [])
        .map((cid) => snapshot.cards[cid])
        .filter(Boolean)
        .filter((card) => card.origin !== "maya")
        .map((card) => ({
          id: card.id,
          title: card.title,
          priority: card.priority,
          dueDate: card.dueDate,
          assigneeId: card.assigneeId ?? null,
        })),
    }));
}

function kanbanItems(snapshot: BoardSnapshot) {
  const cards = snapshotLists(snapshot).flatMap((list) =>
    list.cards.map((c) => ({ id: c.id, title: c.title })),
  );
  const requirements = Object.values(snapshot.requirements || {})
    .filter((r) => r.boardId === snapshot.board.id)
    .map((r) => ({ id: r.id, title: r.title, code: r.code }));
  return { cards, requirements };
}

export async function analyzeSnapshot(
  snapshot: BoardSnapshot,
  opts?: { forceClone?: boolean },
): Promise<BoardSnapshot> {
  const urls = (snapshot.board.gitRepos || []).map((r) => r.url).slice(0, 4);
  const preferClone =
    Boolean(opts?.forceClone) || shouldRefreshClone(snapshot.board.riskReport?.clonedAt);
  const items = kanbanItems(snapshot);
  const git = [];
  for (const url of urls) {
    git.push(await inspectGitRepo(url, items, { preferClone }));
  }

  const coverageRisks: BoardRisk[] = git.flatMap((report) =>
    report.coverage
      .filter((item) => item.status === "missing")
      .slice(0, 8)
      .map((item) => ({
        id: `git-miss-${item.id}`,
        title: `Não encontrado no git: ${item.title}`,
        severity: "medium" as const,
        source: "git" as const,
        reason: `O ${item.kind === "requirement" ? "requisito" : "card"} não aparece nos arquivos de ${report.url}.`,
      })),
  );
  const sourceRisks: BoardRisk[] = git.flatMap((report) => report.sourceRisks || []);
  const boardRisks = analyzeBoardRisks({
    lists: snapshotLists(snapshot),
    requirements: Object.values(snapshot.requirements || {}).filter(
      (r) => r.boardId === snapshot.board.id,
    ),
  }).map((risk) => ({ ...risk, source: "board" as const }));

  const clonedAt =
    git.find((g) => g.clonedAt)?.clonedAt ||
    (preferClone && git.some((g) => g.cloned) ? new Date().toISOString() : snapshot.board.riskReport?.clonedAt || null);

  const report: BoardRiskReport = {
    analyzedAt: new Date().toISOString(),
    clonedAt,
    cloneMode: git.some((g) => g.cloned) ? "clone" : urls.length ? "api" : "none",
    risks: [...boardRisks, ...coverageRisks, ...sourceRisks].slice(0, 24),
    git,
  };

  const pieces = cloneBoardPieces(snapshot.board, snapshot.lists, snapshot.cards);
  syncMayaRiskCards(pieces, report);
  return {
    ...snapshot,
    board: pieces.board,
    lists: { ...snapshot.lists, ...pieces.lists },
    cards: { ...snapshot.cards, ...pieces.cards },
    updatedAt: new Date().toISOString(),
  };
}

export async function runMayaGitJob(opts?: { forceClone?: boolean; boardId?: string }) {
  const all = await listAllSharedBoards();
  const selected = opts?.boardId ? all.filter((s) => s.board.id === opts.boardId) : all;
  const results: { boardId: string; title: string; risks: number; cloned: boolean }[] = [];
  for (const snapshot of selected) {
    if (!opts?.forceClone && !(snapshot.board.gitRepos || []).length) {
      const next = await analyzeSnapshot(snapshot, { forceClone: false });
      await saveSharedBoard(next);
      results.push({
        boardId: next.board.id,
        title: next.board.title,
        risks: next.board.riskReport?.risks.length || 0,
        cloned: false,
      });
      continue;
    }
    const next = await analyzeSnapshot(snapshot, { forceClone: opts?.forceClone });
    await saveSharedBoard(next);
    results.push({
      boardId: next.board.id,
      title: next.board.title,
      risks: next.board.riskReport?.risks.length || 0,
      cloned: next.board.riskReport?.cloneMode === "clone",
    });
  }
  return results;
}

export function buildAnalyzeReportFromGit(
  lists: {
    id: string;
    title: string;
    cards: Pick<Card, "id" | "title" | "priority" | "dueDate" | "assigneeId">[];
  }[],
  git: BoardRiskReport["git"],
  requirements?: Parameters<typeof analyzeBoardRisks>[0]["requirements"],
): BoardRiskReport {
  const coverageRisks: BoardRisk[] = git.flatMap((report) =>
    report.coverage
      .filter((item) => item.status === "missing")
      .slice(0, 8)
      .map((item) => ({
        id: `git-miss-${item.id}`,
        title: `Não encontrado no git: ${item.title}`,
        severity: "medium" as const,
        source: "git" as const,
        reason: `O ${item.kind === "requirement" ? "requisito" : "card"} não aparece nos arquivos de ${report.url}.`,
      })),
  );
  const sourceRisks: BoardRisk[] = git.flatMap((report) => report.sourceRisks || []);
  return {
    analyzedAt: new Date().toISOString(),
    clonedAt: git.find((g) => g.clonedAt)?.clonedAt || null,
    cloneMode: git.some((g) => g.cloned) ? "clone" : git.length ? "api" : "none",
    risks: [
      ...analyzeBoardRisks({ lists, requirements }).map((r) => ({ ...r, source: "board" as const })),
      ...coverageRisks,
      ...sourceRisks,
    ].slice(0, 24),
    git,
  };
}
