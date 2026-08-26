"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useBoardStore } from "@/lib/store";
import {
  getChildBoards,
  getDescendantBoardIds,
} from "@/lib/board-hierarchy";
import {
  extractBoardIndicators,
  stageBarSegments,
  type BoardIndicatorStats,
} from "@/lib/board-indicators";
import type { Board } from "@/lib/types";

function attentionScore(stats: BoardIndicatorStats) {
  return stats.blocked * 4 + stats.overdue * 3 + stats.highPriority + stats.wip;
}

function MetricCell({
  value,
  danger,
}: {
  value: number;
  danger?: boolean;
}) {
  if (!value) {
    return <span className="tabular-nums text-white/35">—</span>;
  }
  return (
    <span
      className={`tabular-nums font-semibold ${
        danger ? "text-rose-300" : "text-white/90"
      }`}
    >
      {value}
    </span>
  );
}

function ChildRow({
  board,
  stats,
}: {
  board: Board;
  stats: BoardIndicatorStats;
}) {
  const segments = stageBarSegments(stats);
  return (
    <Link
      href={`/board/${board.id}`}
      className="grid grid-cols-[minmax(0,1.4fr)_minmax(5.5rem,1fr)_repeat(4,minmax(2.4rem,auto))] items-center gap-2 rounded-lg px-2 py-1 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
    >
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="truncate text-sm font-medium text-white">
          {board.title}
        </span>
        <ArrowRight className="h-3 w-3 shrink-0 text-white/40" />
      </span>
      <span className="flex min-w-0 items-center gap-2">
        <span className="flex h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-black/40">
          {stats.cards === 0 ? (
            <span className="h-full w-1/5 bg-white/20" />
          ) : (
            segments.map((seg) => (
              <span
                key={seg.key}
                className={`h-full ${seg.className}`}
                style={{ width: `${seg.pct}%` }}
              />
            ))
          )}
        </span>
        <span className="w-8 shrink-0 text-right text-[11px] font-semibold tabular-nums text-white/80">
          {stats.progressPct}%
        </span>
      </span>
      <MetricCell value={stats.wip} />
      <MetricCell value={stats.overdue} danger />
      <MetricCell value={stats.blocked} danger />
      <MetricCell value={stats.highPriority} danger={stats.highPriority > 0} />
    </Link>
  );
}

export function ChildBoardMetrics({ parentId }: { parentId: string }) {
  const boards = useBoardStore((s) => s.boards);
  const lists = useBoardStore((s) => s.lists);
  const cards = useBoardStore((s) => s.cards);
  const requirements = useBoardStore((s) => s.requirements);

  const rows = useMemo(() => {
    return getChildBoards(parentId, boards)
      .map((child) => {
        const boardIds = [child.id, ...getDescendantBoardIds(child.id, boards)];
        const stats = extractBoardIndicators({
          boardIds,
          boards,
          lists,
          cards,
          requirements,
        });
        return { child, stats };
      })
      .sort(
        (a, b) =>
          attentionScore(b.stats) - attentionScore(a.stats) ||
          a.child.title.localeCompare(b.child.title),
      );
  }, [parentId, boards, lists, cards, requirements]);

  if (rows.length === 0) return null;

  return (
    <div className="mt-2 border-t border-white/10 pt-2">
      <div className="mb-1 flex items-baseline justify-between gap-2 px-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-white/60">
          Métricas dos boards filhos
        </p>
        <p className="text-[10px] text-white/45">Clique para abrir</p>
      </div>
      <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(5.5rem,1fr)_repeat(4,minmax(2.4rem,auto))] gap-2 px-2 pb-0.5 text-[9px] font-semibold uppercase tracking-wide text-white/40">
        <span>Projeto</span>
        <span>Progresso</span>
        <span>Curso</span>
        <span>Atraso</span>
        <span>Bloq.</span>
        <span>Alta</span>
      </div>
      <div>
        {rows.map(({ child, stats }) => (
          <ChildRow key={child.id} board={child} stats={stats} />
        ))}
      </div>
    </div>
  );
}
