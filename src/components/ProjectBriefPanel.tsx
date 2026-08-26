"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ClipboardList,
  Flag,
  LayoutList,
  Plus,
  Target,
  X,
} from "lucide-react";
import { useBoardStore } from "@/lib/store";
import { sanitizeExecutiveSummary } from "@/lib/executive-summary";
import {
  priorityLabel,
  requirementStatusLabel,
  requirementStatusStyles,
} from "@/lib/utils";
import type { RequirementStatus } from "@/lib/types";

const STATUSES: RequirementStatus[] = [
  "draft",
  "approved",
  "in_progress",
  "done",
  "rejected",
];

export function ProjectBriefPanel({
  boardId,
  onClose,
  onOpenFullRequirements,
}: {
  boardId: string;
  onClose: () => void;
  onOpenFullRequirements: () => void;
}) {
  const board = useBoardStore((s) => s.boards[boardId]);
  const requirements = useBoardStore((s) => s.requirements);
  const updateBoardObjectives = useBoardStore((s) => s.updateBoardObjectives);
  const createRequirement = useBoardStore((s) => s.createRequirement);
  const updateRequirement = useBoardStore((s) => s.updateRequirement);

  const stored = sanitizeExecutiveSummary(board?.objectives);
  const [draft, setDraft] = useState(stored);
  const [editingObjectives, setEditingObjectives] = useState(!stored);
  const [newTitle, setNewTitle] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!editingObjectives) setDraft(stored);
  }, [stored, editingObjectives]);

  const list = useMemo(
    () =>
      Object.values(requirements || {})
        .filter((r) => r.boardId === boardId)
        .sort((a, b) => a.code.localeCompare(b.code)),
    [requirements, boardId],
  );

  const saveObjectives = () => {
    updateBoardObjectives(boardId, draft);
    setEditingObjectives(false);
  };

  const addRequirement = (e: FormEvent) => {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    const id = createRequirement({ boardId, title });
    setNewTitle("");
    setExpandedId(id);
  };

  if (!board) return null;

  return (
    <aside
      className="anim-rise panel-glass flex h-full min-h-0 w-full flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl"
      aria-label="Objetivos e requisitos do projeto"
    >
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--line)] px-4 py-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50">
            Projeto
          </p>
          <h2 className="truncate font-[family-name:var(--font-display)] text-lg text-white">
            Objetivos e requisitos
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-[var(--line)] p-2 text-[var(--muted)] hover:text-white"
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="board-scroll min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        <section>
          <div className="mb-2 flex items-center gap-2">
            <Target className="h-4 w-4 text-[var(--accent)]" />
            <h3 className="text-xs font-semibold uppercase tracking-wide text-white/70">
              Objetivos
            </h3>
            {!editingObjectives ? (
              <button
                type="button"
                className="ml-auto text-[11px] text-[var(--accent)] hover:underline"
                onClick={() => {
                  setDraft(stored);
                  setEditingObjectives(true);
                }}
              >
                Editar
              </button>
            ) : null}
          </div>
          {editingObjectives ? (
            <div className="space-y-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={6}
                placeholder="O que este projeto precisa entregar, para quem e com qual resultado esperado…"
                className="w-full resize-y rounded-xl border border-[var(--line)] bg-black/25 px-3 py-2.5 text-sm leading-relaxed text-white outline-none placeholder:text-white/35 focus:border-[var(--accent)]"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={saveObjectives}
                  className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-[var(--accent-on)]"
                >
                  Salvar
                </button>
                {stored ? (
                  <button
                    type="button"
                    onClick={() => {
                      setDraft(stored);
                      setEditingObjectives(false);
                    }}
                    className="rounded-lg px-3 py-1.5 text-xs text-white/70 hover:text-white"
                  >
                    Cancelar
                  </button>
                ) : null}
              </div>
            </div>
          ) : stored ? (
            <p className="whitespace-pre-wrap rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm leading-relaxed text-white/90">
              {stored}
            </p>
          ) : (
            <p className="rounded-xl border border-dashed border-white/15 px-3 py-4 text-xs text-white/50">
              Ainda não há objetivos neste projeto.
            </p>
          )}
        </section>

        <section>
          <div className="mb-2 flex items-center gap-2">
            <Flag className="h-4 w-4 text-[var(--accent)]" />
            <h3 className="text-xs font-semibold uppercase tracking-wide text-white/70">
              Requisitos
            </h3>
            <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-white/70">
              {list.length}
            </span>
            <button
              type="button"
              onClick={onOpenFullRequirements}
              className="ml-auto inline-flex items-center gap-1 text-[11px] text-[var(--accent)] hover:underline"
            >
              <LayoutList className="h-3 w-3" />
              Cadastro completo
            </button>
          </div>

          <form onSubmit={addRequirement} className="mb-3 flex gap-2">
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Novo requisito…"
              className="min-w-0 flex-1 rounded-xl border border-[var(--line)] bg-black/25 px-3 py-2 text-sm text-white outline-none placeholder:text-white/35 focus:border-[var(--accent)]"
            />
            <button
              type="submit"
              disabled={!newTitle.trim()}
              className="inline-flex items-center gap-1 rounded-xl bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-[var(--accent-on)] disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" />
              Incluir
            </button>
          </form>

          {list.length === 0 ? (
            <p className="rounded-xl border border-dashed border-white/15 px-3 py-6 text-center text-xs text-white/50">
              Nenhum requisito ainda. Inclua o primeiro acima.
            </p>
          ) : (
            <ul className="space-y-2">
              {list.map((req) => {
                const open = expandedId === req.id;
                return (
                  <li
                    key={req.id}
                    className="rounded-xl border border-white/10 bg-black/20"
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedId(open ? null : req.id)}
                      className="flex w-full items-start gap-2 px-3 py-2.5 text-left"
                    >
                      <ClipboardList className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/45" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[10px] font-semibold uppercase tracking-wide text-[var(--accent)]">
                          {req.code}
                        </span>
                        <span className="block text-sm text-white">{req.title}</span>
                      </span>
                      <span
                        className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1 ${requirementStatusStyles[req.status]}`}
                      >
                        {requirementStatusLabel[req.status]}
                      </span>
                    </button>
                    {open ? (
                      <div className="space-y-2 border-t border-white/10 px-3 py-2.5">
                        {req.description ? (
                          <p className="text-xs leading-relaxed text-white/70">
                            {req.description}
                          </p>
                        ) : (
                          <p className="text-xs text-white/40">Sem descrição.</p>
                        )}
                        <p className="text-[10px] text-white/45">
                          Prioridade {priorityLabel[req.priority]}
                          {req.dueDate ? ` · prazo ${req.dueDate.split("-").reverse().join("/")}` : ""}
                        </p>
                        <label className="block text-[10px] text-white/50">
                          Status
                          <select
                            className="mt-1 w-full rounded-lg border border-[var(--line)] bg-black/30 px-2 py-1.5 text-xs text-white outline-none focus:border-[var(--accent)]"
                            value={req.status}
                            onChange={(e) =>
                              updateRequirement(req.id, {
                                status: e.target.value as RequirementStatus,
                              })
                            }
                          >
                            {STATUSES.map((status) => (
                              <option key={status} value={status}>
                                {requirementStatusLabel[status]}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </aside>
  );
}
