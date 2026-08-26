"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowRight, FolderKanban } from "lucide-react";
import { useBoardStore } from "@/lib/store";
import {
  BOARD_LEVEL_LABELS,
  BOARD_LEVEL_STYLES,
  getDescendantBoardIds,
  getDescendantBoards,
} from "@/lib/board-hierarchy";
import {
  cardMatchesFilter,
  type BoardCardFilter,
} from "@/lib/board-filters";
import {
  classifyListStage,
  extractBoardIndicators,
} from "@/lib/board-indicators";
import { BoardIndicators } from "@/components/BoardIndicators";
import { getBackground } from "@/lib/board-themes";
import { priorityLabel } from "@/lib/utils";
import { isMayaRisksList } from "@/lib/maya-risk-column";
import type { Board, Card, List } from "@/lib/types";

function previewCardsForBoard(
  board: Board,
  lists: Record<string, List>,
  cards: Record<string, Card>,
  filter: BoardCardFilter,
): { card: Card; listTitle: string; stage: string }[] {
  const ranked = board.listIds.flatMap((listId) => {
    const list = lists[listId];
    if (!list || isMayaRisksList(list)) return [];
    const stage = classifyListStage(list);
    return list.cardIds
      .map((id) => cards[id])
      .filter(Boolean)
      .filter((card) => !card.archived && card.origin !== "maya")
      .filter((card) => cardMatchesFilter(card, filter))
      .map((card) => ({ card, listTitle: list.title, stage }));
  });

  const stageRank: Record<string, number> = {
    doing: 0,
    review: 1,
    other: 2,
    backlog: 3,
    done: 4,
    risks: 5,
  };
  const priorityRank = { high: 0, medium: 1, low: 2 };

  return ranked
    .sort((a, b) => {
      const sa = stageRank[a.stage] ?? 3;
      const sb = stageRank[b.stage] ?? 3;
      if (sa !== sb) return sa - sb;
      const pa = a.card.priority ? priorityRank[a.card.priority] : 3;
      const pb = b.card.priority ? priorityRank[b.card.priority] : 3;
      return pa - pb;
    })
    .slice(0, 3);
}

function ChildBoardTile({
  board,
  filter,
}: {
  board: Board;
  filter: BoardCardFilter;
}) {
  const boards = useBoardStore((s) => s.boards);
  const lists = useBoardStore((s) => s.lists);
  const cards = useBoardStore((s) => s.cards);
  const requirements = useBoardStore((s) => s.requirements);
  const bg = getBackground(board.backgroundId);
  const previews = previewCardsForBoard(board, lists, cards, filter);
  const descendantIds = getDescendantBoardIds(board.id, boards);
  const stats = extractBoardIndicators({
    boardIds: [board.id, ...descendantIds],
    boards,
    lists,
    cards,
    requirements,
  });

  return (
    <Link
      href={`/board/${board.id}`}
      className="group relative flex min-h-[220px] flex-col overflow-hidden rounded-2xl border border-white/20 shadow-[0_8px_20px_rgba(9,30,66,0.28)] outline-none transition hover:-translate-y-0.5 hover:border-[var(--accent)]/70 hover:shadow-[0_14px_32px_rgba(9,30,66,0.38)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
    >
      <div
        className="relative flex flex-1 flex-col justify-between p-3.5"
        style={
          board.backgroundImageUrl
            ? {
                backgroundImage: `url("${board.backgroundImageUrl.replace(/"/g, "")}")`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : { backgroundImage: bg.preview }
        }
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/35 to-black/15" />
        <div className="relative z-[1] flex min-h-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-2">
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${BOARD_LEVEL_STYLES[board.level]}`}
            >
              {BOARD_LEVEL_LABELS[board.level]}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--accent-on)] opacity-95 transition group-hover:brightness-110">
              Abrir
              <ArrowRight className="h-3 w-3" />
            </span>
          </div>
          <h3 className="mt-2 font-[family-name:var(--font-display)] text-lg leading-snug text-white drop-shadow">
            {board.title}
          </h3>
          {board.description ? (
            <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-white/80">
              {board.description}
            </p>
          ) : null}
          <div className="mt-3">
            <BoardIndicators stats={stats} variant="compact" />
          </div>
          <ul className="mt-3 space-y-1.5">
            {previews.length === 0 ? (
              <li className="rounded-lg bg-black/35 px-2.5 py-2 text-[11px] text-white/70">
                Sem cards neste filtro — clique para abrir o board
              </li>
            ) : (
              previews.map(({ card, listTitle }) => (
                <li
                  key={card.id}
                  className="flex items-start justify-between gap-2 rounded-lg bg-black/40 px-2.5 py-1.5 text-[11px] text-white/90 ring-1 ring-white/10"
                >
                  <span className="min-w-0 flex-1 truncate">{card.title}</span>
                  <span className="shrink-0 text-[10px] uppercase tracking-wide text-white/55">
                    {listTitle}
                    {card.priority ? ` · ${priorityLabel[card.priority]}` : ""}
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </Link>
  );
}

export function ConsolidatedBoardCanvas({
  boardId,
  filter,
}: {
  boardId: string;
  filter: BoardCardFilter;
  onOpenBoard?: (childBoardId: string) => void;
}) {
  const boards = useBoardStore((s) => s.boards);

  const descendants = useMemo(
    () => getDescendantBoards(boardId, boards),
    [boardId, boards],
  );

  if (descendants.length === 0) return null;

  return (
    <div className="mt-3 flex min-h-0 flex-1 flex-col border-t border-[var(--accent)]/25 pt-3">
      <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2">
          <FolderKanban className="h-4 w-4 text-[var(--accent)]" />
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">
            Boards inferiores ({descendants.length})
          </p>
        </div>
        <p className="text-[11px] text-white/65">
          Clique no card para abrir o projeto
        </p>
      </div>

      <div className="mb-3 flex shrink-0 gap-1.5 overflow-x-auto pb-1">
        {descendants.map((child) => (
          <Link
            key={`chip-${child.id}`}
            href={`/board/${child.id}`}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/20 bg-black/25 px-2.5 py-1 text-[11px] font-medium text-white/85 transition hover:border-[var(--accent)] hover:bg-[var(--accent)] hover:text-[var(--accent-on)]"
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                child.level === "project" ? "bg-amber-300" : "bg-emerald-300"
              }`}
            />
            {child.title}
          </Link>
        ))}
      </div>

      <div className="board-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-1">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {descendants.map((childBoard) => (
            <ChildBoardTile key={childBoard.id} board={childBoard} filter={filter} />
          ))}
        </div>
      </div>
    </div>
  );
}
