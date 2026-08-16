"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import type { Card } from "@/lib/types";
import { useBoardStore } from "@/lib/store";
import { labelStyles, priorityLabel, priorityStyles } from "@/lib/utils";

export function CardItem({
  card,
  dragging,
  overlay,
}: {
  card: Card;
  dragging?: boolean;
  overlay?: boolean;
}) {
  const updateCard = useBoardStore((s) => s.updateCard);
  const deleteCard = useBoardStore((s) => s.deleteCard);
  const [open, setOpen] = useState(false);

  return (
    <article
      className={`rounded-xl border border-[var(--line)] bg-[var(--panel-strong)] p-3 shadow-[0_8px_24px_rgba(0,0,0,0.18)] transition ${
        dragging ? "opacity-40" : "opacity-100"
      } ${overlay ? "ring-2 ring-[var(--accent)]" : "hover:border-[var(--accent)]/40"}`}
      onDoubleClick={() => setOpen(true)}
    >
      {card.labels.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-1">
          {card.labels.map((label) => (
            <span
              key={label.id}
              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${labelStyles[label.color]}`}
            >
              {label.name}
            </span>
          ))}
        </div>
      ) : null}

      <h3 className="text-sm font-medium leading-snug text-white">{card.title}</h3>

      {card.description ? (
        <p className="mt-1 line-clamp-2 text-xs text-[var(--muted)]">{card.description}</p>
      ) : null}

      <div className="mt-3 flex items-center justify-between gap-2">
        {card.priority ? (
          <span
            className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${priorityStyles[card.priority]}`}
          >
            {priorityLabel[card.priority]}
          </span>
        ) : (
          <span className="text-[10px] text-[var(--muted)]">sem prioridade</span>
        )}
        <button
          type="button"
          className="rounded p-1 text-[var(--muted)] hover:bg-white/5 hover:text-rose-300"
          onClick={(e) => {
            e.stopPropagation();
            deleteCard(card.id);
          }}
          aria-label="Excluir card"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-[var(--line)] bg-[var(--ink-2)] p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="mb-3 font-[family-name:var(--font-display)] text-lg text-white">
              Editar card
            </h4>
            <label className="mb-3 block text-xs text-[var(--muted)]">
              Título
              <input
                className="mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--ink)] px-3 py-2 text-sm text-white outline-none focus:border-[var(--accent)]"
                value={card.title}
                onChange={(e) => updateCard(card.id, { title: e.target.value })}
              />
            </label>
            <label className="mb-3 block text-xs text-[var(--muted)]">
              Descrição
              <textarea
                className="mt-1 min-h-24 w-full rounded-lg border border-[var(--line)] bg-[var(--ink)] px-3 py-2 text-sm text-white outline-none focus:border-[var(--accent)]"
                value={card.description}
                onChange={(e) => updateCard(card.id, { description: e.target.value })}
              />
            </label>
            <label className="mb-4 block text-xs text-[var(--muted)]">
              Prioridade
              <select
                className="mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--ink)] px-3 py-2 text-sm text-white outline-none focus:border-[var(--accent)]"
                value={card.priority ?? ""}
                onChange={(e) =>
                  updateCard(card.id, {
                    priority: (e.target.value || null) as Card["priority"],
                  })
                }
              >
                <option value="">Sem prioridade</option>
                <option value="high">Alta</option>
                <option value="medium">Média</option>
                <option value="low">Baixa</option>
              </select>
            </label>
            <button
              type="button"
              className="w-full rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-medium text-teal-950"
              onClick={() => setOpen(false)}
            >
              Fechar
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}
