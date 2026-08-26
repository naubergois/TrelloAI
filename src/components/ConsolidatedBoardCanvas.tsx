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
import type { BoardCardFilter } from "@/lib/board-filters";
import { extractBoardIndicators } from "@/lib/board-indicators";
import { BoardIndicators } from "@/components/BoardIndicators";
import { getBackground } from "@/lib/board-themes";
import type { Board } from "@/lib/types";

function ChildBoardTile({ board }: { board: Board }) {
  const boards = useBoardStore((s) => s.boards);
  const lists = useBoardStore((s) => s.lists);
  const cards = useBoardStore((s) => s.cards);
  const requirements = useBoardStore((s) => s.requirements);
  const bg = getBackground(board.backgroundId);
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
      className="group relative flex min-h-[7.5rem] flex-col overflow-hidden rounded-xl border border-white/20 outline-none transition hover:-translate-y-0.5 hover:border-[var(--accent)]/70 focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
    >
      <div
        className="relative flex flex-1 flex-col justify-between p-3"
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
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20" />
        <div className="relative z-[1] flex min-h-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-2">
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${BOARD_LEVEL_STYLES[board.level]}`}
            >
              {BOARD_LEVEL_LABELS[board.level]}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--accent-on)]">
              Abrir
              <ArrowRight className="h-3 w-3" />
            </span>
          </div>
          <h3 className="mt-1.5 truncate font-[family-name:var(--font-display)] text-base leading-snug text-white">
            {board.title}
          </h3>
          <div className="mt-auto pt-2">
            <BoardIndicators stats={stats} variant="compact" />
          </div>
        </div>
      </div>
    </Link>
  );
}

export function ConsolidatedBoardCanvas({
  boardId,
}: {
  boardId: string;
  filter?: BoardCardFilter;
  onOpenBoard?: (childBoardId: string) => void;
}) {
  const boards = useBoardStore((s) => s.boards);

  const descendants = useMemo(
    () => getDescendantBoards(boardId, boards),
    [boardId, boards],
  );

  if (descendants.length === 0) return null;

  return (
    <div className="mt-4 shrink-0 border-t border-[var(--accent)]/25 pt-4">
      <div className="mb-3 flex items-center gap-2 px-1">
        <FolderKanban className="h-4 w-4 text-[var(--accent)]" />
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">
          Boards inferiores ({descendants.length})
        </p>
        <p className="text-[11px] text-white/55">Clique para abrir · role a página para ver todos</p>
      </div>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 pb-2">
        {descendants.map((childBoard) => (
          <ChildBoardTile key={childBoard.id} board={childBoard} />
        ))}
      </div>
    </div>
  );
}
