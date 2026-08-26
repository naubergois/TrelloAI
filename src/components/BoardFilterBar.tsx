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
    <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-2xl border px-2.5 py-1.5 board-filter-bar">
      <div className="relative min-w-[10rem] flex-1 sm:max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted)]" />
        <input
          value={filter.query}
          onChange={(e) => onChange({ ...filter, query: e.target.value })}
          placeholder="Buscar cards…"
          className="w-full rounded-xl border py-1.5 pl-8 pr-2 text-xs outline-none focus:border-[var(--accent)] sm:text-sm"
        />
      </div>

      <select
        value={filter.assigneeId}
        onChange={(e) => onChange({ ...filter, assigneeId: e.target.value })}
        className="rounded-xl border px-2 py-1.5 text-xs outline-none focus:border-[var(--accent)] sm:text-sm"
        aria-label="Filtrar por responsável"
      >
        <option value="">Responsável</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
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
        className="rounded-xl border px-2 py-1.5 text-xs outline-none focus:border-[var(--accent)] sm:text-sm"
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
        className="rounded-xl border px-2 py-1.5 text-xs outline-none focus:border-[var(--accent)] sm:text-sm"
        aria-label="Filtrar por prazo"
      >
        <option value="">Prazo</option>
        <option value="overdue">Atrasados</option>
        <option value="soon">Hoje / 3 dias</option>
        <option value="any">Com prazo</option>
      </select>

      {active ? (
        <>
          <span className="text-[11px] text-[var(--muted)]">
            {matchCount}/{totalCount}
          </span>
          <button
            type="button"
            onClick={() => onChange(EMPTY_BOARD_FILTER)}
            className="inline-flex items-center gap-1 rounded-xl border border-[var(--line)] px-2 py-1.5 text-xs text-[var(--muted)] hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
            Limpar
          </button>
        </>
      ) : null}
    </div>
  );
}
