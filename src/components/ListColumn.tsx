"use client";

import { useMemo, useState } from "react";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { Plus, ShieldAlert, Trash2 } from "lucide-react";
import { useBoardStore } from "@/lib/store";
import { SortableCard } from "@/components/SortableCard";
import {
  cardMatchesFilter,
  type BoardCardFilter,
} from "@/lib/board-filters";
import { isMayaRisksList } from "@/lib/maya-risk-column";

export function ListColumn({
  listId,
  filter,
}: {
  listId: string;
  filter: BoardCardFilter;
}) {
  const list = useBoardStore((s) => s.lists[listId]);
  const cards = useBoardStore((s) => s.cards);
  const addCard = useBoardStore((s) => s.addCard);
  const renameList = useBoardStore((s) => s.renameList);
  const deleteList = useBoardStore((s) => s.deleteList);
  const [title, setTitle] = useState("");

  const { setNodeRef, isOver } = useDroppable({ id: listId });

  const cardItems = useMemo(() => {
    if (!list) return [];
    return list.cardIds
      .map((id) => cards[id])
      .filter(Boolean)
      .filter((card) => cardMatchesFilter(card, filter));
  }, [list, cards, filter]);

  const visibleIds = useMemo(() => cardItems.map((c) => c.id), [cardItems]);

  if (!list) return null;
  const systemList = isMayaRisksList(list);

  return (
    <section
      ref={setNodeRef}
      className={`board-list-column flex h-auto min-h-[12rem] shrink-0 flex-col overflow-visible border ${
        isOver ? "border-[var(--accent)]/60" : ""
      } ${systemList ? "border-[var(--accent)]/35" : ""}`}
      style={{
        borderRadius: "var(--board-list-radius, 1rem)",
        width: "min(var(--board-list-width, 18rem), 86vw)",
      }}
    >
      <header className="flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2.5">
        <input
          value={list.title}
          onChange={(e) => renameList(listId, e.target.value)}
          className="w-full bg-transparent text-sm font-semibold tracking-wide text-white outline-none placeholder:text-white/60"
        />
        {systemList ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-[var(--accent)]/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--accent)]">
            <ShieldAlert className="h-3 w-3" />
            Maya
          </span>
        ) : null}
        <span className="rounded-md bg-white/15 px-2 py-0.5 text-xs text-white/80">
          {cardItems.length}
          {cardItems.length !== list.cardIds.length
            ? `/${list.cardIds.length}`
            : ""}
        </span>
        {systemList ? null : (
        <button
          type="button"
          title="Excluir lista"
          className="rounded-md p-1 text-white/60 hover:bg-white/15 hover:text-white"
          onClick={() => {
            if (
              confirm(
                `Excluir a lista "${list.title}" e todos os cards? Esta ação não pode ser desfeita.`,
              )
            ) {
              deleteList(listId);
            }
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
        )}
      </header>

      <div
        className="board-list-cards flex flex-col overflow-visible p-2.5 sm:p-3"
        style={{ gap: "var(--board-gap, 0.75rem)" }}
      >
        <SortableContext items={visibleIds} strategy={verticalListSortingStrategy}>
          {cardItems.map((card) => (
            <SortableCard key={card.id} card={card} />
          ))}
        </SortableContext>
        {cardItems.length === 0 ? (
          <p className="px-1 py-4 text-center text-xs text-white/65">
            {systemList
              ? "A Maya preenche esta coluna com riscos do board e do código."
              : "Nenhum card neste filtro"}
          </p>
        ) : null}
      </div>

      <form
        className="shrink-0 border-t border-white/12 p-2.5 sm:p-3"
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
            className="list-add-input w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
          />
          <button
            type="submit"
            className="rounded-lg bg-white/20 p-2 text-white transition hover:bg-[var(--accent)] hover:text-[var(--accent-on)]"
            aria-label="Adicionar card"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </form>
    </section>
  );
}
