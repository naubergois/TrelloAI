"use client";

import { useMemo, useState } from "react";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { Plus } from "lucide-react";
import { useBoardStore } from "@/lib/store";
import { SortableCard } from "@/components/SortableCard";

export function ListColumn({ listId }: { listId: string }) {
  const list = useBoardStore((s) => s.lists[listId]);
  const cards = useBoardStore((s) => s.cards);
  const addCard = useBoardStore((s) => s.addCard);
  const renameList = useBoardStore((s) => s.renameList);
  const [title, setTitle] = useState("");

  const { setNodeRef, isOver } = useDroppable({ id: listId });

  const cardItems = useMemo(
    () => (list ? list.cardIds.map((id) => cards[id]).filter(Boolean) : []),
    [list, cards],
  );

  if (!list) return null;

  return (
    <section
      ref={setNodeRef}
      className={`flex w-72 shrink-0 flex-col rounded-2xl border bg-[var(--panel)] ${
        isOver ? "border-[var(--accent)]/60" : "border-[var(--line)]"
      }`}
    >
      <header className="flex items-center justify-between gap-2 border-b border-[var(--line)] px-3 py-3">
        <input
          value={list.title}
          onChange={(e) => renameList(listId, e.target.value)}
          className="w-full bg-transparent text-sm font-semibold tracking-wide text-white outline-none"
        />
        <span className="rounded-md bg-white/5 px-2 py-0.5 text-xs text-[var(--muted)]">
          {cardItems.length}
        </span>
      </header>

      <div className="board-scroll flex max-h-[calc(100vh-260px)] flex-col gap-2 overflow-y-auto p-3">
        <SortableContext items={list.cardIds} strategy={verticalListSortingStrategy}>
          {cardItems.map((card) => (
            <SortableCard key={card.id} card={card} />
          ))}
        </SortableContext>
      </div>

      <form
        className="border-t border-[var(--line)] p-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
          addCard(listId, title.trim());
          setTitle("");
        }}
      >
        <div className="flex gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Adicionar card"
            className="w-full rounded-lg border border-[var(--line)] bg-[var(--ink-2)] px-3 py-2 text-sm outline-none placeholder:text-[var(--muted)] focus:border-[var(--accent)]"
          />
          <button
            type="submit"
            className="rounded-lg bg-white/10 p-2 text-white transition hover:bg-[var(--accent)] hover:text-teal-950"
            aria-label="Adicionar card"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </form>
    </section>
  );
}
