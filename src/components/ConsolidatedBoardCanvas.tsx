"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, FolderKanban, Search } from "lucide-react";
import { useBoardStore } from "@/lib/store";
import {
  BOARD_LEVEL_LABELS,
  BOARD_LEVEL_STYLES,
  getChildBoards,
  getDescendantBoardIds,
} from "@/lib/board-hierarchy";
import type { BoardCardFilter } from "@/lib/board-filters";
import {
  extractBoardIndicators,
  stageBarSegments,
  type BoardIndicatorStats,
} from "@/lib/board-indicators";
import type { Board } from "@/lib/types";

type SortKey = "attention" | "name" | "progress";

function attentionScore(stats: BoardIndicatorStats) {
  return stats.blocked * 5 + stats.overdue * 4 + stats.risksHigh * 2 + stats.highPriority + stats.wip;
}

function compareRows(
  a: { board: Board; stats: BoardIndicatorStats },
  b: { board: Board; stats: BoardIndicatorStats },
  sort: SortKey,
) {
  if (sort === "name") return a.board.title.localeCompare(b.board.title, "pt-BR");
  if (sort === "progress") return b.stats.progressPct - a.stats.progressPct;
  return (
    attentionScore(b.stats) - attentionScore(a.stats) ||
    a.board.title.localeCompare(b.board.title, "pt-BR")
  );
}

function StatChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "danger" | "warn" | "info" | "neutral";
}) {
  if (!value) return null;
  const cls =
    tone === "danger"
      ? "bg-rose-500/90 text-white"
      : tone === "warn"
        ? "bg-amber-400/90 text-slate-950"
        : tone === "info"
          ? "bg-sky-400/90 text-slate-950"
          : "bg-white/15 text-white/85";
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cls}`}>
      {label} {value}
    </span>
  );
}

function SummaryRow({
  board,
  stats,
  nested,
}: {
  board: Board;
  stats: BoardIndicatorStats;
  nested: boolean;
}) {
  const segments = stageBarSegments(stats);
  const childCount = stats.cards;

  return (
    <Link
      href={`/board/${board.id}`}
      aria-label={`Abrir board ${board.title}`}
      className={`group grid grid-cols-1 items-center gap-2 rounded-xl border bg-black/20 px-3 py-2.5 transition hover:border-[var(--accent)]/70 hover:bg-black/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] sm:grid-cols-[minmax(0,1.35fr)_minmax(7rem,1fr)_auto_auto] ${
        nested
          ? "ml-4 border-white/8 border-l-[3px] border-l-[var(--accent)] sm:ml-6"
          : "border-white/12"
      }`}
    >
      <span className="flex min-w-0 items-center gap-2">
        <span
          className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase ${BOARD_LEVEL_STYLES[board.level]}`}
        >
          {BOARD_LEVEL_LABELS[board.level]}
        </span>
        <span className="truncate text-sm font-semibold text-white">{board.title}</span>
      </span>

      <span className="flex min-w-0 items-center gap-2">
        <span className="flex h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-black/45">
          {childCount === 0 ? (
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
        <span className="w-10 shrink-0 text-right text-xs font-semibold tabular-nums text-white/85">
          {stats.progressPct}%
        </span>
      </span>

      <span className="flex flex-wrap items-center gap-1">
        <span className="text-[11px] tabular-nums text-white/60">
          {childCount} card{childCount === 1 ? "" : "s"}
        </span>
        <StatChip label="Curso" value={stats.wip} tone="info" />
        <StatChip label="Atraso" value={stats.overdue} tone="danger" />
        <StatChip label="Bloq." value={stats.blocked} tone="danger" />
        <StatChip label="Alta" value={stats.highPriority} tone="warn" />
      </span>

      <span className="inline-flex items-center justify-end gap-1 text-[11px] font-bold uppercase tracking-wide text-[var(--accent)]">
        Abrir
        <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

export function ConsolidatedBoardCanvas({
  boardId,
}: {
  boardId: string;
  filter?: BoardCardFilter;
}) {
  const boards = useBoardStore((s) => s.boards);
  const lists = useBoardStore((s) => s.lists);
  const cards = useBoardStore((s) => s.cards);
  const requirements = useBoardStore((s) => s.requirements);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("attention");

  const tree = useMemo(() => {
    const statsOf = (board: Board) =>
      extractBoardIndicators({
        boardIds: [board.id, ...getDescendantBoardIds(board.id, boards)],
        boards,
        lists,
        cards,
        requirements,
      });

    return getChildBoards(boardId, boards).map((child) => ({
      board: child,
      stats: statsOf(child),
      children: getChildBoards(child.id, boards).map((grand) => ({
        board: grand,
        stats: statsOf(grand),
      })),
    }));
  }, [boardId, boards, lists, cards, requirements]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tree
      .map((node) => {
        const kidsSorted = [...node.children].sort((a, b) =>
          compareRows(a, b, sort),
        );
        const kidsMatched = kidsSorted.filter(
          (row) => !q || row.board.title.toLowerCase().includes(q),
        );
        const selfMatch = !q || node.board.title.toLowerCase().includes(q);
        if (!selfMatch && kidsMatched.length === 0) return null;
        return {
          ...node,
          children: selfMatch && q ? kidsSorted : kidsMatched,
        };
      })
      .filter((node): node is NonNullable<typeof node> => Boolean(node))
      .sort((a, b) => compareRows(a, b, sort));
  }, [tree, query, sort]);

  const totals = useMemo(() => {
    const rows = visible.flatMap((node) =>
      node.children.length > 0 ? node.children : [node],
    );
    return {
      count: visible.reduce((n, node) => n + 1 + node.children.length, 0),
      blocked: rows.filter((r) => r.stats.blocked > 0).length,
      overdue: rows.filter((r) => r.stats.overdue > 0).length,
    };
  }, [visible]);

  if (tree.length === 0) return null;

  return (
    <section className="mt-4 shrink-0 border-t border-[var(--accent)]/25 pt-4 pb-6">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3 px-1">
        <div>
          <div className="flex items-center gap-2">
            <FolderKanban className="h-4 w-4 text-[var(--accent)]" />
            <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">
              Boards filhos ({totals.count})
            </h2>
          </div>
          <p className="mt-0.5 text-[11px] text-white/55">
            Resumo da carteira — clique na linha para abrir
            {totals.blocked || totals.overdue
              ? ` · ${totals.blocked ? `${totals.blocked} com bloqueio` : ""}${
                  totals.blocked && totals.overdue ? " · " : ""
                }${totals.overdue ? `${totals.overdue} com atraso` : ""}`
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/40" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setQuery("");
              }}
              placeholder="Filtrar filhos…"
              className="w-44 rounded-lg border border-white/15 bg-black/25 py-1.5 pl-8 pr-2 text-xs text-white outline-none placeholder:text-white/40 focus:border-[var(--accent)]"
            />
          </label>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded-lg border border-white/15 bg-black/25 px-2 py-1.5 text-xs text-white outline-none focus:border-[var(--accent)]"
            aria-label="Ordenar filhos"
          >
            <option value="attention">Mais críticos</option>
            <option value="progress">Mais avançados</option>
            <option value="name">A–Z</option>
          </select>
        </div>
      </div>

      <div className="hidden px-3 pb-1 text-[9px] font-semibold uppercase tracking-wide text-white/40 sm:grid sm:grid-cols-[minmax(0,1.35fr)_minmax(7rem,1fr)_auto_auto] sm:gap-2">
        <span>Board</span>
        <span>Progresso</span>
        <span>Sinais</span>
        <span className="text-right">Ação</span>
      </div>

      <div className="flex flex-col gap-1.5">
        {visible.length === 0 ? (
          <p className="rounded-xl border border-white/10 bg-black/20 px-3 py-6 text-center text-sm text-white/60">
            Nenhum board filho com esse filtro.
          </p>
        ) : (
          visible.map((node) => (
            <div key={node.board.id} className="flex flex-col gap-1.5">
              <SummaryRow board={node.board} stats={node.stats} nested={false} />
              {node.children.map((row) => (
                <SummaryRow
                  key={row.board.id}
                  board={row.board}
                  stats={row.stats}
                  nested
                />
              ))}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
