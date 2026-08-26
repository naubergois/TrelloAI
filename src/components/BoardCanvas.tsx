"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Plus } from "lucide-react";
import { useBoardStore } from "@/lib/store";
import { ListColumn } from "@/components/ListColumn";
import { CardItem } from "@/components/CardItem";
import { BoardHScroll } from "@/components/BoardHScroll";
import type { BoardCardFilter } from "@/lib/board-filters";

export function BoardCanvas({
  boardId,
  filter,
}: {
  boardId: string;
  filter: BoardCardFilter;
}) {
  const board = useBoardStore((s) => s.boards[boardId]);
  const lists = useBoardStore((s) => s.lists);
  const cards = useBoardStore((s) => s.cards);
  const addList = useBoardStore((s) => s.addList);
  const moveCard = useBoardStore((s) => s.moveCard);

  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [listTitle, setListTitle] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 6 },
    }),
  );

  const orderedLists = useMemo(
    () => (board ? board.listIds.map((id) => lists[id]).filter(Boolean) : []),
    [board, lists],
  );

  const activeCard = activeCardId ? cards[activeCardId] : null;

  const findListIdByCard = (cardId: string) => cards[cardId]?.listId;

  const onDragStart = (event: DragStartEvent) => {
    setActiveCardId(String(event.active.id));
  };

  const onDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    const activeListId = findListIdByCard(activeId);
    if (!activeListId) return;

    let overListId = findListIdByCard(overId);
    if (!overListId && lists[overId]) overListId = overId;
    if (!overListId || activeListId === overListId) return;

    const overList = lists[overListId];
    const overIndex = overList.cardIds.indexOf(overId);
    const insertAt = overIndex >= 0 ? overIndex : overList.cardIds.length;
    moveCard(activeId, overListId, insertAt);
  };

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCardId(null);
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    const activeListId = findListIdByCard(activeId);
    if (!activeListId) return;

    let overListId = findListIdByCard(overId);
    if (!overListId && lists[overId]) overListId = overId;
    if (!overListId) return;

    const overList = lists[overListId];
    const overIndex = overList.cardIds.indexOf(overId);
    const insertAt = overIndex >= 0 ? overIndex : overList.cardIds.length;
    moveCard(activeId, overListId, insertAt);
  };

  if (!board) return null;

  return (
    <div className="h-auto min-h-[12rem]">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
      >
        <BoardHScroll
          className="board-canvas-scroll items-start"
          style={{ gap: "var(--board-gap, 0.75rem)" }}
          onWheel={(event) => {
            if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
            window.scrollBy(0, event.deltaY);
          }}
        >
          {orderedLists.map((list, index) => (
            <div
              key={list.id}
              className="anim-rise flex shrink-0 self-start"
              style={{ animationDelay: `${index * 60}ms` }}
            >
              <ListColumn listId={list.id} filter={filter} />
            </div>
          ))}

          <form
            className="h-fit shrink-0 border border-dashed border-[var(--line)] bg-[var(--panel)] p-3"
            style={{
              borderRadius: "var(--board-list-radius, 1rem)",
              width: "min(var(--board-list-width, 18rem), 86vw)",
            }}
            onSubmit={(e) => {
              e.preventDefault();
              if (!listTitle.trim()) return;
              addList(boardId, listTitle.trim());
              setListTitle("");
            }}
          >
            <input
              value={listTitle}
              onChange={(e) => setListTitle(e.target.value)}
              placeholder="Nova lista"
              className="mb-2 w-full rounded-lg border border-[var(--line)] bg-[var(--ink-2)] px-3 py-2 text-sm outline-none placeholder:text-[var(--muted)] focus:border-[var(--accent)]"
            />
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--line)] px-3 py-2 text-sm text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-white"
            >
              <Plus className="h-4 w-4" />
              Adicionar lista
            </button>
          </form>
          <div className="board-h-scroll-end" aria-hidden="true" />
        </BoardHScroll>

        <DragOverlay>
          {activeCard ? (
            <div className="w-64 max-w-[86vw] rotate-2 opacity-95">
              <CardItem card={activeCard} overlay />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
