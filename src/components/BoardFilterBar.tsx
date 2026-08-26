"use client";

import { Search, X } from "lucide-react";
import type { TeamMember } from "@/lib/types";
import {
  EMPTY_BOARD_FILTER,
  isBoardFilterActive,
  type BoardCardFilter,
} from "@/lib/board-filters";

export function BoardFilterBar({
  filter,
  onChange,
  members,
  matchCount,
  totalCount,
}: {
  filter: BoardCardFilter;
  onChange: (next: BoardCardFilter) => void;
  members: TeamMember[];
  matchCount: number;
  totalCount: number;
}) {
  const active = isBoardFilterActive(filter);

  return (
    <div className="flex w-full min-w-0 shrink-0 flex-col gap-2 rounded-2xl border px-2.5 py-1.5 board-filter-bar sm:flex-row sm:flex-wrap sm:items-center">
      <div className="relative min-w-0 w-full flex-1 sm:max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted)]" />
        <input
          value={filter.query}
          onChange={(e) => onChange({ ...filter, query: e.target.value })}
          placeholder="Buscar cards…"
          className="w-full rounded-xl border py-2 pl-8 pr-2 text-sm outline-none focus:border-[var(--accent)]"
        />
      </div>

      <div className="board-scroll flex min-w-0 w-full gap-2 overflow-x-auto pb-0.5 sm:w-auto sm:flex-wrap sm:overflow-visible">
        <select
          value={filter.assigneeId}
          onChange={(e) => onChange({ ...filter, assigneeId: e.target.value })}
          className="shrink-0 rounded-xl border px-2 py-2 text-sm outline-none focus:border-[var(--accent)]"
          aria-label="Filtrar por responsável"
        >
          <option value="">Responsável</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.kind === "external" ? `${m.name} (externo)` : m.name}
            </option>
          ))}
        </select>

        <select
          value={filter.priority}
          onChange={(e) =>
            onChange({
              ...filter,
              priority: e.target.value as BoardCardFilter["priority"],
            })
          }
          className="shrink-0 rounded-xl border px-2 py-2 text-sm outline-none focus:border-[var(--accent)]"
          aria-label="Filtrar por prioridade"
        >
          <option value="">Prioridade</option>
          <option value="high">Alta</option>
          <option value="medium">Média</option>
          <option value="low">Baixa</option>
        </select>

        <select
          value={filter.due}
          onChange={(e) =>
            onChange({ ...filter, due: e.target.value as BoardCardFilter["due"] })
          }
          className="shrink-0 rounded-xl border px-2 py-2 text-sm outline-none focus:border-[var(--accent)]"
          aria-label="Filtrar por prazo"
        >
          <option value="">Prazo</option>
          <option value="overdue">Atrasados</option>
          <option value="soon">Hoje / 3 dias</option>
          <option value="any">Com prazo</option>
        </select>

        {active ? (
          <>
            <span className="shrink-0 self-center text-[11px] text-[var(--muted)]">
              {matchCount}/{totalCount}
            </span>
            <button
              type="button"
              onClick={() => onChange(EMPTY_BOARD_FILTER)}
              className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-[var(--line)] px-2 py-2 text-sm text-[var(--muted)] hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
              Limpar
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
