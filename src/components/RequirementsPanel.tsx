"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import {
  ClipboardList,
  LayoutList,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useBoardStore } from "@/lib/store";
import {
  priorityLabel,
  priorityStyles,
  requirementStatusLabel,
  requirementStatusStyles,
} from "@/lib/utils";
import type { Requirement, RequirementStatus } from "@/lib/types";
import { useToast } from "@/components/Toast";

const STATUSES: RequirementStatus[] = [
  "draft",
  "approved",
  "in_progress",
  "done",
  "rejected",
];

type StatusFilter = "all" | RequirementStatus;

export function RequirementsPanel({
  boardId,
  onClose,
}: {
  boardId: string;
  onClose: () => void;
}) {
  const board = useBoardStore((s) => s.boards[boardId]);
  const members = useBoardStore((s) => s.members);
  const requirements = useBoardStore((s) => s.requirements);
  const cards = useBoardStore((s) => s.cards);
  const createRequirement = useBoardStore((s) => s.createRequirement);
  const updateRequirement = useBoardStore((s) => s.updateRequirement);
  const deleteRequirement = useBoardStore((s) => s.deleteRequirement);
  const addCard = useBoardStore((s) => s.addCard);
  const { toast } = useToast();

  const [mounted, setMounted] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [dueDate, setDueDate] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [justCreated, setJustCreated] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (editingId) setEditingId(null);
        else onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose, editingId]);

  const boardMembers = useMemo(() => {
    if (!board) return [];
    return (board.memberIds ?? []).map((id) => members[id]).filter(Boolean);
  }, [board, members]);

  const list = useMemo(
    () =>
      Object.values(requirements || {})
        .filter((r) => r.boardId === boardId)
        .sort((a, b) => a.code.localeCompare(b.code)),
    [requirements, boardId],
  );

  const counts = useMemo(() => {
    const base: Record<StatusFilter, number> = {
      all: list.length,
      draft: 0,
      approved: 0,
      in_progress: 0,
      done: 0,
      rejected: 0,
    };
    for (const r of list) base[r.status] += 1;
    return base;
  }, [list]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!q) return true;
      return (
        r.title.toLowerCase().includes(q) ||
        r.code.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q)
      );
    });
  }, [list, statusFilter, query]);

  const linkedCount = (requirementId: string) =>
    Object.values(cards).filter((c) => c.requirementId === requirementId).length;

  const onCreate = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const id = createRequirement({
      boardId,
      title,
      description,
      priority,
      ownerId: ownerId || null,
      dueDate: dueDate || null,
    });
    setTitle("");
    setDescription("");
    setDueDate("");
    setOwnerId("");
    setPriority("medium");
    setJustCreated(id);
    toast(`Requisito cadastrado`);
    window.setTimeout(() => setJustCreated(null), 1800);
  };

  const startEdit = (req: Requirement) => {
    setEditingId(req.id);
    setEditTitle(req.title);
    setEditDescription(req.description);
  };

  const saveEdit = () => {
    if (!editingId) return;
    updateRequirement(editingId, {
      title: editTitle.trim() || "Requisito",
      description: editDescription,
    });
    setEditingId(null);
  };

  const createCardFromRequirement = (req: Requirement) => {
    const firstListId = board?.listIds?.[0];
    if (!firstListId) {
      toast("Crie uma lista no board antes de gerar o card");
      return;
    }
    addCard(firstListId, req.title, {
      description: req.description,
      priority: req.priority,
      dueDate: req.dueDate ?? null,
      assigneeId: req.ownerId ?? null,
      requirementId: req.id,
    });
    toast(`Card criado a partir de ${req.code}`);
  };

  if (!mounted) return null;

  const filters: { id: StatusFilter; label: string }[] = [
    { id: "all", label: "Todos" },
    ...STATUSES.map((s) => ({ id: s as StatusFilter, label: requirementStatusLabel[s] })),
  ];

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Cadastro de requisitos"
      className="anim-overlay fixed inset-0 z-[200] flex h-[100dvh] w-screen flex-col bg-[var(--ink)]"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-80"
        style={{
          background:
            "radial-gradient(900px 420px at 8% -5%, rgba(46,196,182,0.16), transparent 55%), radial-gradient(700px 380px at 92% 0%, rgba(255,183,3,0.1), transparent 50%)",
        }}
      />

      <header className="anim-sheet relative z-10 flex shrink-0 items-center justify-between gap-3 border-b border-[var(--line)] bg-black/25 px-4 py-3 backdrop-blur-md sm:px-6 sm:py-4 lg:px-10">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
            {board?.title ?? "Board"}
          </p>
          <h2 className="font-[family-name:var(--font-display)] text-xl tracking-tight text-white sm:text-2xl">
            Requisitos
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden rounded-full border border-[var(--line)] bg-black/20 px-3 py-1 text-xs text-[var(--muted)] sm:inline">
            {list.length} no total
          </span>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-xl border border-[var(--line)] bg-black/20 p-2.5 text-[var(--muted)] transition hover:border-white/20 hover:text-white"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </header>

      <div className="board-scroll relative z-10 min-h-0 flex-1 overflow-y-auto">
        <div className="anim-sheet mx-auto grid w-full max-w-6xl gap-5 px-4 py-5 sm:gap-6 sm:px-6 sm:py-8 lg:grid-cols-[minmax(0,21rem)_minmax(0,1fr)] lg:px-10">
          <form
            onSubmit={onCreate}
            className="h-fit space-y-3 rounded-3xl border border-[var(--line)] bg-[var(--panel-strong)] p-4 shadow-[0_20px_50px_rgba(0,0,0,0.25)] sm:p-5 lg:sticky lg:top-4"
          >
            <div>
              <p className="font-[family-name:var(--font-display)] text-lg text-white">
                Novo requisito
              </p>
              <p className="mt-0.5 text-xs text-[var(--muted)]">
                Código gerado automaticamente (REQ-01…)
              </p>
            </div>
            <label className="block text-xs text-[var(--muted)]">
              Título
              <input
                className="mt-1.5 w-full rounded-2xl border border-[var(--line)] bg-[var(--ink)] px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex.: Autenticação institucional"
                required
                autoFocus
              />
            </label>
            <label className="block text-xs text-[var(--muted)]">
              Descrição
              <textarea
                className="mt-1.5 min-h-28 w-full resize-y rounded-2xl border border-[var(--line)] bg-[var(--ink)] px-4 py-3 text-sm leading-relaxed text-white outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Escopo, regra de negócio, critério de aceite…"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs text-[var(--muted)]">
                Prioridade
                <select
                  className="mt-1.5 w-full rounded-2xl border border-[var(--line)] bg-[var(--ink)] px-3 py-3 text-sm text-white outline-none focus:border-[var(--accent)]"
                  value={priority}
                  onChange={(e) =>
                    setPriority(e.target.value as "low" | "medium" | "high")
                  }
                >
                  <option value="high">Alta</option>
                  <option value="medium">Média</option>
                  <option value="low">Baixa</option>
                </select>
              </label>
              <label className="block text-xs text-[var(--muted)]">
                Prazo
                <input
                  type="date"
                  className="mt-1.5 w-full rounded-2xl border border-[var(--line)] bg-[var(--ink)] px-3 py-3 text-sm text-white outline-none focus:border-[var(--accent)]"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </label>
            </div>
            <label className="block text-xs text-[var(--muted)]">
              Responsável
              <select
                className="mt-1.5 w-full rounded-2xl border border-[var(--line)] bg-[var(--ink)] px-3 py-3 text-sm text-white outline-none focus:border-[var(--accent)]"
                value={ownerId}
                onChange={(e) => setOwnerId(e.target.value)}
              >
                <option value="">Sem responsável</option>
                {boardMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] px-4 py-3.5 text-sm font-semibold text-teal-950 transition hover:brightness-110 active:scale-[0.99]"
            >
              <Plus className="h-4 w-4" />
              Cadastrar
            </button>
          </form>

          <div className="min-w-0 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar por código, título…"
                  className="w-full rounded-2xl border border-[var(--line)] bg-black/25 py-2.5 pl-10 pr-3 text-sm text-white outline-none focus:border-[var(--accent)]"
                />
              </div>
            </div>

            <div className="board-scroll -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
              {filters.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setStatusFilter(f.id)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs transition ${
                    statusFilter === f.id
                      ? "bg-[var(--accent)] font-semibold text-teal-950"
                      : "border border-[var(--line)] bg-black/20 text-[var(--muted)] hover:text-white"
                  }`}
                >
                  {f.label}
                  <span className="ml-1.5 opacity-70">{counts[f.id]}</span>
                </button>
              ))}
            </div>

            {filtered.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-[var(--line)] bg-black/15 px-6 py-16 text-center">
                <ClipboardList className="mx-auto mb-3 h-9 w-9 text-[var(--muted)] opacity-70" />
                <p className="text-sm text-white">
                  {list.length === 0
                    ? "Nenhum requisito ainda"
                    : "Nada encontrado neste filtro"}
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {list.length === 0
                    ? "Use o formulário ao lado para cadastrar o primeiro."
                    : "Ajuste a busca ou o status."}
                </p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {filtered.map((req, index) => {
                  const owner = req.ownerId ? members[req.ownerId] : null;
                  const isEditing = editingId === req.id;
                  return (
                    <article
                      key={req.id}
                      className={`flex flex-col rounded-3xl border bg-[var(--panel-strong)] p-4 transition ${
                        justCreated === req.id
                          ? "border-[var(--accent)] ring-2 ring-[var(--accent)]/30"
                          : "border-[var(--line)] hover:border-[var(--accent)]/35"
                      }`}
                      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
                    >
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="mb-1 flex flex-wrap items-center gap-1.5">
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--accent)]">
                              {req.code}
                            </span>
                            <span
                              className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ring-1 ${requirementStatusStyles[req.status]}`}
                            >
                              {requirementStatusLabel[req.status]}
                            </span>
                          </div>
                          {isEditing ? (
                            <input
                              className="w-full rounded-xl border border-[var(--accent)]/50 bg-[var(--ink)] px-2.5 py-1.5 text-sm text-white outline-none"
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              autoFocus
                            />
                          ) : (
                            <h3 className="text-base font-medium leading-snug text-white">
                              {req.title}
                            </h3>
                          )}
                        </div>
                        <div className="flex shrink-0 gap-0.5">
                          <button
                            type="button"
                            className="rounded-lg p-1.5 text-[var(--muted)] hover:bg-white/5 hover:text-white"
                            onClick={() =>
                              isEditing ? setEditingId(null) : startEdit(req)
                            }
                            aria-label={isEditing ? "Cancelar edição" : "Editar"}
                          >
                            {isEditing ? (
                              <X className="h-3.5 w-3.5" />
                            ) : (
                              <Pencil className="h-3.5 w-3.5" />
                            )}
                          </button>
                          <button
                            type="button"
                            className="rounded-lg p-1.5 text-[var(--muted)] hover:bg-white/5 hover:text-rose-300"
                            onClick={() => {
                              if (confirm(`Excluir ${req.code}?`)) {
                                deleteRequirement(req.id);
                              }
                            }}
                            aria-label="Excluir requisito"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {isEditing ? (
                        <textarea
                          className="mb-3 min-h-20 w-full rounded-xl border border-[var(--line)] bg-[var(--ink)] px-2.5 py-2 text-sm text-white outline-none focus:border-[var(--accent)]"
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                        />
                      ) : req.description ? (
                        <p className="mb-3 line-clamp-4 flex-1 text-sm leading-relaxed text-[var(--muted)]">
                          {req.description}
                        </p>
                      ) : (
                        <div className="mb-3 flex-1" />
                      )}

                      {isEditing ? (
                        <button
                          type="button"
                          onClick={saveEdit}
                          className="mb-3 rounded-xl bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-teal-950"
                        >
                          Salvar alterações
                        </button>
                      ) : null}

                      <div className="mb-3 flex flex-wrap gap-1.5">
                        <span
                          className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${priorityStyles[req.priority]}`}
                        >
                          {priorityLabel[req.priority]}
                        </span>
                        <span className="rounded-md bg-white/5 px-2 py-0.5 text-[10px] text-[var(--muted)] ring-1 ring-white/10">
                          {linkedCount(req.id)} card(s)
                        </span>
                        {owner ? (
                          <span className="rounded-md bg-white/5 px-2 py-0.5 text-[10px] text-white/80 ring-1 ring-white/10">
                            {owner.name.split(" ")[0]}
                          </span>
                        ) : null}
                        {req.dueDate ? (
                          <span className="rounded-md bg-white/5 px-2 py-0.5 text-[10px] text-[var(--muted)] ring-1 ring-white/10">
                            {req.dueDate.split("-").reverse().join("/")}
                          </span>
                        ) : null}
                      </div>

                      <label className="block text-[10px] font-medium uppercase tracking-wide text-[var(--muted)]">
                        Status
                        <select
                          className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-[var(--ink)] px-3 py-2.5 text-sm text-white outline-none focus:border-[var(--accent)]"
                          value={req.status}
                          onChange={(e) =>
                            updateRequirement(req.id, {
                              status: e.target.value as RequirementStatus,
                            })
                          }
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {requirementStatusLabel[s]}
                            </option>
                          ))}
                        </select>
                      </label>

                      {!isEditing ? (
                        <button
                          type="button"
                          onClick={() => createCardFromRequirement(req)}
                          className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-[var(--line)] px-3 py-2.5 text-xs font-medium text-white transition hover:border-[var(--accent)]/50 hover:bg-white/5"
                        >
                          <LayoutList className="h-3.5 w-3.5 text-[var(--accent)]" />
                          Criar card no board
                        </button>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
