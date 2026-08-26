"use client";

import { useEffect, useState } from "react";
import { FileText, Pencil, Sparkles, X } from "lucide-react";
import { useBoardStore } from "@/lib/store";
import {
  draftExecutiveSummary,
  EXECUTIVE_SUMMARY_MAX,
  sanitizeExecutiveSummary,
} from "@/lib/executive-summary";
import type { BoardIndicatorStats } from "@/lib/board-indicators";

export function BoardExecutiveSummary({
  boardId,
  title,
  description,
  summary,
  stats,
  descendantCount = 0,
}: {
  boardId: string;
  title: string;
  description: string;
  summary?: string | null;
  stats: BoardIndicatorStats;
  descendantCount?: number;
}) {
  const updateBoardExecutiveSummary = useBoardStore((s) => s.updateBoardExecutiveSummary);
  const stored = sanitizeExecutiveSummary(summary);
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState(stored);

  useEffect(() => {
    if (!editing) setDraft(stored);
  }, [stored, editing]);

  const save = (value: string) => {
    updateBoardExecutiveSummary(boardId, value);
    setEditing(false);
    setExpanded(Boolean(sanitizeExecutiveSummary(value)));
  };

  const fillDraft = () => {
    setDraft(
      draftExecutiveSummary({
        title,
        description,
        stats,
        descendantCount,
      }),
    );
    setEditing(true);
  };

  const long = stored.split("\n").length > 6 || stored.length > 420;
  const shown = !expanded && long ? stored.split("\n").slice(0, 5).join("\n") : stored;

  if (!stored && !editing) {
    return (
      <div className="mb-2 shrink-0 rounded-2xl border border-dashed border-white/20 bg-black/15 px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <FileText className="h-3.5 w-3.5 text-white/70" />
          <p className="text-[11px] font-semibold uppercase tracking-wide text-white/70">
            Resumo executivo
          </p>
          <div className="ml-auto flex gap-1">
            <button
              type="button"
              onClick={fillDraft}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-white/80 transition hover:bg-white/10 hover:text-white"
            >
              <Sparkles className="h-3 w-3" />
              Rascunho
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft("");
                setEditing(true);
              }}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-white/80 transition hover:bg-white/10 hover:text-white"
            >
              <Pencil className="h-3 w-3" />
              Escrever
            </button>
          </div>
        </div>
        <p className="mt-1 text-[11px] text-white/55">
          Guarde um texto para a liderança: situação, prioridades e riscos deste board.
        </p>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="mb-2 shrink-0 rounded-2xl border border-white/20 bg-black/25 px-3 py-2">
        <div className="mb-1.5 flex items-center gap-2">
          <FileText className="h-3.5 w-3.5 text-[var(--accent)]" />
          <p className="text-[11px] font-semibold uppercase tracking-wide text-white/85">
            Resumo executivo
          </p>
          <button
            type="button"
            onClick={fillDraft}
            className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-white/75 transition hover:bg-white/10 hover:text-white"
          >
            <Sparkles className="h-3 w-3" />
            Rascunho dos indicadores
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft(stored);
              setEditing(false);
            }}
            className="rounded-lg p-1 text-white/60 hover:text-white"
            aria-label="Cancelar edição"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, EXECUTIVE_SUMMARY_MAX))}
          rows={8}
          autoFocus
          placeholder="Situação atual, prioridades da semana e riscos que a liderança precisa ver."
          className="w-full resize-y rounded-xl border border-white/20 bg-black/30 px-3 py-2 text-sm leading-relaxed text-white outline-none placeholder:text-white/40 focus:border-[var(--accent)]"
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <p className="text-[10px] text-white/50">
            {draft.length}/{EXECUTIVE_SUMMARY_MAX}
          </p>
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={() => {
                setDraft(stored);
                setEditing(false);
              }}
              className="rounded-lg px-2.5 py-1.5 text-xs text-white/70 hover:text-white"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => save(draft)}
              className="rounded-lg bg-[var(--accent)] px-2.5 py-1.5 text-xs font-semibold text-[var(--accent-on)]"
            >
              Guardar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-2 shrink-0 rounded-2xl border border-white/15 bg-black/20 px-3 py-2">
      <div className="flex items-center gap-2">
        <FileText className="h-3.5 w-3.5 text-[var(--accent)]" />
        <p className="text-[11px] font-semibold uppercase tracking-wide text-white/85">
          Resumo executivo
        </p>
        <button
          type="button"
          onClick={() => {
            setDraft(stored);
            setEditing(true);
          }}
          className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-white/70 transition hover:bg-white/10 hover:text-white"
        >
          <Pencil className="h-3 w-3" />
          Editar
        </button>
      </div>
      <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-white/90">
        {shown}
        {!expanded && long ? "…" : ""}
      </p>
      {long ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-[11px] font-medium text-white/70 hover:text-white hover:underline"
        >
          {expanded ? "Mostrar menos" : "Ver resumo completo"}
        </button>
      ) : null}
    </div>
  );
}

export function ExecutiveSummaryField({
  value,
  onChange,
  placeholder = "Situação, prioridades e riscos para a liderança (opcional)",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block text-xs text-[var(--muted)]">
      Resumo executivo
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, EXECUTIVE_SUMMARY_MAX))}
        rows={4}
        placeholder={placeholder}
        className="mt-1 w-full resize-y rounded-xl border border-[var(--line)] bg-[var(--ink)] px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/35 focus:border-[var(--accent)]"
      />
      <span className="mt-1 block text-[10px] text-[var(--muted)]">
        Texto apresentado no board e na home. {value.length}/{EXECUTIVE_SUMMARY_MAX}
      </span>
    </label>
  );
}
