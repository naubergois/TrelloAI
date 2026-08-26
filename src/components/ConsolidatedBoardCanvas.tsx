"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { useBoardStore } from "@/lib/store";
import {
  BOARD_LEVEL_LABELS,
  BOARD_LEVEL_STYLES,
  getDescendantBoards,
} from "@/lib/board-hierarchy";
import {
  cardMatchesFilter,
  type BoardCardFilter,
} from "@/lib/board-filters";
import { cardPriorityStyles, priorityLabel } from "@/lib/utils";
import { dueUrgency } from "@/lib/board-filters";
import { cardCoverStyle } from "@/lib/card-appearance";
import { CardLabelBars } from "@/components/CardLabelBars";
import type { Card } from "@/lib/types";

function MirroredCard({
  card,
  listTitle,
  onOpen,
}: {
  card: Card;
  listTitle: string;
  onOpen: () => void;
}) {
  const members = useBoardStore((s) => s.members);
  const assignee = card.assigneeId ? members[card.assigneeId] : null;
  const urgency = dueUrgency(card.dueDate);

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className="board-card-surface cursor-pointer border p-3 transition hover:shadow-md"
      style={{
        borderRadius: "var(--board-card-radius, 0.75rem)",
        ...cardCoverStyle(card.coverColor),
      }}
    >
      <p className="mb-1 text-[10px] font-medium board-card-muted">
        {listTitle}
      </p>
      <CardLabelBars labels={card.labels} />
      <h3 className="board-card-title text-sm font-medium leading-snug">
        {card.title}
      </h3>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {card.priority ? (
          <span
            className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase ring-1 ${cardPriorityStyles[card.priority]}`}
          >
            {priorityLabel[card.priority]}
          </span>
        ) : null}
        {card.dueDate ? (
          <span
            className={`text-[10px] font-medium ${
              urgency === "overdue"
                ? "text-rose-600"
                : urgency === "today" || urgency === "soon"
                  ? "text-amber-700"
                  : "board-card-muted"
            }`}
          >
            {card.dueDate.split("-").reverse().join("/")}
          </span>
        ) : null}
        {assignee ? (
          <span className="board-card-muted text-[10px]">{assignee.name}</span>
        ) : null}
      </div>
    </article>
  );
}

export function ConsolidatedBoardCanvas({
  boardId,
  filter,
  onOpenBoard,
}: {
  boardId: string;
  filter: BoardCardFilter;
  onOpenBoard: (childBoardId: string) => void;
}) {
  const boards = useBoardStore((s) => s.boards);
  const lists = useBoardStore((s) => s.lists);
  const cards = useBoardStore((s) => s.cards);

  const descendants = useMemo(
    () => getDescendantBoards(boardId, boards),
    [boardId, boards],
  );

  if (descendants.length === 0) return null;

  return (
    <div className="mt-3 flex min-h-0 shrink-0 flex-col border-t border-white/15 pt-3">
      <div className="mb-2 flex shrink-0 items-center justify-between gap-2 px-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-white/75">
          Boards inferiores ({descendants.length})
        </p>
        <p className="text-[11px] text-white/55">Cards espelhados — clique para abrir</p>
      </div>
      <div
        className="board-scroll flex min-h-[12rem] flex-1 overflow-x-auto overflow-y-hidden pb-1 pr-1"
        style={{ gap: "var(--board-gap, 0.75rem)" }}
      >
        {descendants.map((childBoard) => {
          const childCards = childBoard.listIds.flatMap((listId) => {
            const list = lists[listId];
            if (!list) return [];
            return list.cardIds
              .map((id) => cards[id])
              .filter(Boolean)
              .filter((c) => !c.archived && cardMatchesFilter(c, filter))
              .map((c) => ({ card: c, listTitle: list.title }));
          });

          return (
            <section
              key={childBoard.id}
              className="board-list-column flex h-full max-h-full shrink-0 flex-col border"
              style={{
                borderRadius: "var(--board-list-radius, 1rem)",
                width: "min(var(--board-list-width, 18rem), 78vw)",
              }}
            >
              <header className="flex shrink-0 items-start justify-between gap-2 border-b px-3 py-2.5">
                <div className="min-w-0">
                  <span
                    className={`mb-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${BOARD_LEVEL_STYLES[childBoard.level]}`}
                  >
                    {BOARD_LEVEL_LABELS[childBoard.level]}
                  </span>
                  <h3 className="truncate text-sm font-semibold text-white">
                    {childBoard.title}
                  </h3>
                </div>
                <Link
                  href={`/board/${childBoard.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    onOpenBoard(childBoard.id);
                  }}
                  className="shrink-0 rounded-lg bg-white/15 p-1.5 text-white/80 hover:bg-white/25"
                  title="Abrir board"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </header>
              <div
                className="board-scroll flex min-h-0 flex-1 flex-col overflow-y-auto p-2.5"
                style={{ gap: "var(--board-gap, 0.75rem)" }}
              >
                {childCards.length === 0 ? (
                  <p className="px-1 py-4 text-center text-xs text-white/60">
                    Sem cards neste filtro
                  </p>
                ) : (
                  childCards.map(({ card, listTitle }) => (
                    <MirroredCard
                      key={card.id}
                      card={card}
                      listTitle={listTitle}
                      onOpen={() => onOpenBoard(childBoard.id)}
                    />
                  ))
                )}
              </div>
              <footer className="shrink-0 border-t border-white/12 px-3 py-2 text-[10px] text-white/60">
                {childCards.length} card(s)
              </footer>
            </section>
          );
        })}
      </div>
    </div>
  );
}
