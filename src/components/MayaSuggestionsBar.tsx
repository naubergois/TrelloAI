"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import type { BoardCardFilter } from "@/lib/board-filters";
import {
  EMPTY_BOARD_FILTER,
  isBoardFilterActive,
} from "@/lib/board-filters";
import type { MayaSuggestion, MayaSuggestionTone } from "@/lib/maya-suggestions";

const TONE_CLASS: Record<MayaSuggestionTone, string> = {
  danger: "border-rose-400/40 bg-rose-500/15 hover:bg-rose-500/25",
  warn: "border-amber-300/40 bg-amber-400/15 hover:bg-amber-400/25",
  info: "border-sky-300/40 bg-sky-400/15 hover:bg-sky-400/25",
  ok: "border-lime-300/40 bg-lime-400/15 hover:bg-lime-400/25",
};

function MayaAvatar({ size = "sm" }: { size?: "sm" | "md" }) {
  const cls = size === "md" ? "h-9 w-9 text-xs" : "h-7 w-7 text-[10px]";
  return (
    <div
      className={`maya-avatar flex shrink-0 items-center justify-center rounded-full font-semibold text-white ring-2 ring-[var(--accent)]/30 ${cls}`}
      aria-hidden
    >
      M
    </div>
  );
}

function suggestionActive(
  suggestion: MayaSuggestion,
  filter: BoardCardFilter | undefined,
) {
  if (!filter || !suggestion.filter || !isBoardFilterActive(filter)) return false;
  if (suggestion.filter.query && filter.query === suggestion.filter.query) return true;
  if (suggestion.filter.due && filter.due === suggestion.filter.due) return true;
  if (suggestion.filter.priority && filter.priority === suggestion.filter.priority) {
    return true;
  }
  return false;
}

export function MayaSuggestionsBar({
  suggestions,
  filter,
  onSelect,
  onOpenMaya,
  variant = "full",
}: {
  suggestions: MayaSuggestion[];
  filter?: BoardCardFilter;
  onSelect: (suggestion: MayaSuggestion) => void;
  onOpenMaya?: () => void;
  variant?: "full" | "compact";
}) {
  const [open, setOpen] = useState(true);
  const headline = useMemo(() => {
    if (suggestions.length === 0) return "Maya acompanha este board";
    if (suggestions[0].kind === "empty") return "Maya sugere o próximo passo";
    if (suggestions[0].kind === "next") return "Maya sugere o que seguir";
    return `Maya sugere ${suggestions.length} ${
      suggestions.length === 1 ? "atividade" : "atividades"
    }`;
  }, [suggestions]);

  if (suggestions.length === 0) return null;

  if (variant === "compact") {
    const first = suggestions[0];
    return (
      <span className="mt-2 flex items-start gap-1.5 text-[11px] leading-snug text-white/85">
        <span className="maya-avatar mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[8px] font-semibold text-white">
          M
        </span>
        <span>
          <span className="font-semibold text-[var(--accent)]">Maya · </span>
          {first.title}
        </span>
      </span>
    );
  }

  return (
    <section
      className="mb-2 shrink-0 rounded-2xl border border-[var(--accent)]/25 bg-black/25 px-3 py-2"
      aria-label="Sugestões da Maya"
    >
      <div className="flex items-center gap-2">
        <MayaAvatar />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-[var(--accent)]">
            {headline}
          </p>
          {!open ? (
            <p className="truncate text-[11px] text-white/70">{suggestions[0].title}</p>
          ) : null}
        </div>
        {onOpenMaya ? (
          <button
            type="button"
            onClick={onOpenMaya}
            aria-label="Falar com Maya"
            className="inline-flex items-center gap-1 rounded-lg p-1 text-[11px] text-white/80 transition hover:bg-white/10 hover:text-white sm:px-2 sm:py-1"
          >
            <Sparkles className="h-3 w-3" />
            <span className="hidden sm:inline">Falar com Maya</span>
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-lg p-1 text-white/70 transition hover:bg-white/10 hover:text-white"
          aria-expanded={open}
          aria-label={open ? "Recolher sugestões da Maya" : "Expandir sugestões da Maya"}
        >
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {open ? (
        <div className="board-scroll -mx-1 mt-2 flex gap-2 overflow-x-auto px-1 pb-0.5">
          {suggestions.map((suggestion) => {
            const active = suggestionActive(suggestion, filter);
            return (
              <button
                key={suggestion.id}
                type="button"
                onClick={() => onSelect(suggestion)}
                title={suggestion.detail}
                aria-label={suggestion.title}
                className={`min-w-[min(11.5rem,78vw)] max-w-[16rem] shrink-0 rounded-xl border px-2.5 py-2 text-left transition ${
                  TONE_CLASS[suggestion.tone]
                } ${active ? "ring-2 ring-white/80" : ""}`}
              >
                <span className="line-clamp-2 block text-[12px] font-semibold leading-snug text-white">
                  {suggestion.title}
                </span>
                <span className="mt-1 line-clamp-2 block text-[10px] leading-snug text-white/70">
                  {suggestion.detail}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

export function applyMayaSuggestionFilter(
  suggestion: MayaSuggestion,
): BoardCardFilter {
  return {
    ...EMPTY_BOARD_FILTER,
    ...suggestion.filter,
    query: suggestion.filter?.query ?? "",
    assigneeId: suggestion.filter?.assigneeId ?? "",
    priority: suggestion.filter?.priority ?? "",
    due: suggestion.filter?.due ?? "",
  };
}
