"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  CheckSquare,
  GripVertical,
  Palette,
  Plus,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { nanoid } from "nanoid";
import type { Card, ChecklistItem, Label, LabelColor } from "@/lib/types";
import { useBoardStore } from "@/lib/store";
import {
  LABEL_COLOR_OPTIONS,
  cardPriorityStyles,
  labelStyles,
  priorityLabel,
} from "@/lib/utils";
import {
  cardCoverStyle,
  labelColorName,
  normalizeCoverColor,
} from "@/lib/card-appearance";
import { dueUrgency } from "@/lib/board-filters";
import { useToast } from "@/components/Toast";
import { CardLabelBars } from "@/components/CardLabelBars";
import { CardCoverSwatches } from "@/components/CardCoverSwatches";

export function CardItem({
  card,
  dragging,
  overlay,
  dragHandleProps,
}: {
  card: Card;
  dragging?: boolean;
  overlay?: boolean;
  dragHandleProps?: Record<string, unknown>;
}) {
  const updateCard = useBoardStore((s) => s.updateCard);
  const deleteCard = useBoardStore((s) => s.deleteCard);
  const archiveCard = useBoardStore((s) => s.archiveCard);
  const addCardComment = useBoardStore((s) => s.addCardComment);
  const moveCard = useBoardStore((s) => s.moveCard);
  const boards = useBoardStore((s) => s.boards);
  const lists = useBoardStore((s) => s.lists);
  const members = useBoardStore((s) => s.members);
  const requirements = useBoardStore((s) => s.requirements);
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [draftTitle, setDraftTitle] = useState(card.title);
  const [draftDescription, setDraftDescription] = useState(card.description);
  const [draftPriority, setDraftPriority] = useState<Card["priority"]>(card.priority);
  const [draftAssigneeId, setDraftAssigneeId] = useState<string | null>(
    card.assigneeId ?? null,
  );
  const [draftListId, setDraftListId] = useState(card.listId);
  const [draftDueDate, setDraftDueDate] = useState(card.dueDate ?? "");
  const [draftRequirementId, setDraftRequirementId] = useState<string | null>(
    card.requirementId ?? null,
  );
  const [draftAcceptance, setDraftAcceptance] = useState(
    card.acceptanceCriteria ?? "",
  );
  const [draftLabels, setDraftLabels] = useState<Label[]>(card.labels ?? []);
  const [draftCoverColor, setDraftCoverColor] = useState<string | null>(
    card.coverColor ?? null,
  );
  const [pickingCover, setPickingCover] = useState(false);
  const [draftChecklist, setDraftChecklist] = useState<ChecklistItem[]>(
    card.checklist ?? [],
  );
  const [newCheckText, setNewCheckText] = useState("");
  const [newComment, setNewComment] = useState("");
  const titleRef = useRef<HTMLInputElement | null>(null);

  const boardId = lists[card.listId]?.boardId;
  const boardMembers = boardId
    ? (boards[boardId]?.memberIds || []).map((id) => members[id]).filter(Boolean)
    : [];
  const boardLists = boardId
    ? (boards[boardId]?.listIds || []).map((id) => lists[id]).filter(Boolean)
    : [];
  const boardReqs = boardId
    ? Object.values(requirements || {})
        .filter((r) => r.boardId === boardId)
        .sort((a, b) => a.code.localeCompare(b.code))
    : [];
  const assignee = card.assigneeId ? members[card.assigneeId] : null;
  const linkedReq = card.requirementId
    ? requirements?.[card.requirementId]
    : null;
  const checklistDone = (card.checklist || []).filter((i) => i.done).length;
  const checklistTotal = (card.checklist || []).length;
  const urgency = dueUrgency(card.dueDate);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    setDraftTitle(card.title);
    setDraftDescription(card.description);
    setDraftPriority(card.priority);
    setDraftAssigneeId(card.assigneeId ?? null);
    setDraftListId(card.listId);
    setDraftDueDate(card.dueDate ?? "");
    setDraftRequirementId(card.requirementId ?? null);
    setDraftAcceptance(card.acceptanceCriteria ?? "");
    setDraftLabels(card.labels ?? []);
    setDraftCoverColor(card.coverColor ?? null);
    setDraftChecklist(card.checklist ?? []);
    const t = window.setTimeout(() => titleRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [
    open,
    card.id,
    card.title,
    card.description,
    card.priority,
    card.assigneeId,
    card.listId,
    card.dueDate,
    card.requirementId,
    card.acceptanceCriteria,
    card.labels,
    card.coverColor,
    card.checklist,
  ]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const save = () => {
    updateCard(card.id, {
      title: draftTitle.trim() || card.title,
      description: draftDescription,
      priority: draftPriority,
      assigneeId: draftAssigneeId,
      dueDate: draftDueDate || null,
      requirementId: draftRequirementId,
      acceptanceCriteria: draftAcceptance,
      labels: draftLabels,
      coverColor: normalizeCoverColor(draftCoverColor),
      checklist: draftChecklist,
    });
    if (draftListId && draftListId !== card.listId) {
      const target = lists[draftListId];
      if (target) moveCard(card.id, draftListId, target.cardIds.length);
    }
    toast("Card salvo");
    setOpen(false);
  };

  const toggleLabelColor = (color: LabelColor) => {
    setDraftLabels((prev) => {
      if (prev.some((label) => label.color === color)) {
        return prev.filter((label) => label.color !== color);
      }
      return [
        ...prev,
        { id: nanoid(), name: labelColorName(color), color },
      ];
    });
  };

  const applyCover = (next: string | null) => {
    const color = normalizeCoverColor(next);
    setDraftCoverColor(color);
    updateCard(card.id, { coverColor: color });
  };

  const addCheckItem = () => {
    const text = newCheckText.trim();
    if (!text) return;
    setDraftChecklist((prev) => [...prev, { id: nanoid(), text, done: false }]);
    setNewCheckText("");
  };

  const editor =
    open && mounted
      ? createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Editar card"
            className="fixed inset-0 z-[200] flex h-[100dvh] w-full flex-col bg-[var(--ink-2)] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
          >
            <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--line)] bg-black/30 px-4 py-3 backdrop-blur-md sm:px-6 sm:py-4 lg:px-10">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                  Detalhes
                </p>
                <h4 className="truncate font-[family-name:var(--font-display)] text-lg text-white sm:text-2xl">
                  Editar card
                </h4>
              </div>
              <button
                type="button"
                className="shrink-0 rounded-xl border border-[var(--line)] p-2.5 text-[var(--muted)] hover:bg-white/5 hover:text-white"
                onClick={() => setOpen(false)}
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="board-scroll min-h-0 flex-1 overflow-y-auto">
              <div className="mx-auto w-full max-w-5xl px-4 py-5 sm:px-6 sm:py-8 lg:px-10">
                <div className="grid gap-4 sm:gap-5 md:grid-cols-2">
                  <div className="space-y-4 md:col-span-2">
                    <label className="block text-xs text-[var(--muted)] sm:text-sm">
                      Título
                      <input
                        ref={titleRef}
                        className="mt-1.5 w-full rounded-2xl border border-[var(--line)] bg-[var(--ink)] px-4 py-3.5 text-base text-white outline-none focus:border-[var(--accent)] sm:text-lg"
                        value={draftTitle}
                        onChange={(e) => setDraftTitle(e.target.value)}
                      />
                    </label>
                    <div>
                      <p className="text-xs text-[var(--muted)] sm:text-sm">
                        Fundo do card
                      </p>
                      <p className="mt-0.5 text-[11px] text-[var(--muted)]">
                        A cor é aplicada na hora, sem precisar salvar.
                      </p>
                      <div className="mt-1.5 rounded-2xl border border-[var(--line)] bg-white/10 p-3">
                        <CardCoverSwatches
                          value={draftCoverColor}
                          onChange={applyCover}
                        />
                      </div>
                    </div>
                    <label className="block text-xs text-[var(--muted)] sm:text-sm">
                      Descrição
                      <textarea
                        className="mt-1.5 min-h-[40vh] w-full resize-y rounded-2xl border border-[var(--line)] bg-[var(--ink)] px-4 py-3.5 text-sm leading-relaxed text-white outline-none focus:border-[var(--accent)] sm:min-h-[28vh] sm:text-base"
                        value={draftDescription}
                        onChange={(e) => setDraftDescription(e.target.value)}
                        placeholder="Contexto, links, notas da tarefa…"
                      />
                    </label>
                  </div>

                  <label className="block text-xs text-[var(--muted)] sm:text-sm">
                    Lista
                    <select
                      className="mt-1.5 w-full rounded-2xl border border-[var(--line)] bg-[var(--ink)] px-4 py-3 text-sm text-white outline-none focus:border-[var(--accent)]"
                      value={draftListId}
                      onChange={(e) => setDraftListId(e.target.value)}
                    >
                      {boardLists.map((list) => (
                        <option key={list.id} value={list.id}>
                          {list.title}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block text-xs text-[var(--muted)] sm:text-sm">
                    Prioridade
                    <select
                      className="mt-1.5 w-full rounded-2xl border border-[var(--line)] bg-[var(--ink)] px-4 py-3 text-sm text-white outline-none focus:border-[var(--accent)]"
                      value={draftPriority ?? ""}
                      onChange={(e) =>
                        setDraftPriority(
                          (e.target.value || null) as Card["priority"],
                        )
                      }
                    >
                      <option value="">Sem prioridade</option>
                      <option value="high">Alta</option>
                      <option value="medium">Média</option>
                      <option value="low">Baixa</option>
                    </select>
                  </label>

                  <label className="block text-xs text-[var(--muted)] sm:text-sm">
                    Responsável
                    <select
                      className="mt-1.5 w-full rounded-2xl border border-[var(--line)] bg-[var(--ink)] px-4 py-3 text-sm text-white outline-none focus:border-[var(--accent)]"
                      value={draftAssigneeId ?? ""}
                      onChange={(e) =>
                        setDraftAssigneeId(e.target.value || null)
                      }
                    >
                      <option value="">Sem responsável</option>
                      {boardMembers.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block text-xs text-[var(--muted)] sm:text-sm">
                    Prazo
                    <input
                      type="date"
                      className="mt-1.5 w-full rounded-2xl border border-[var(--line)] bg-[var(--ink)] px-4 py-3 text-sm text-white outline-none focus:border-[var(--accent)]"
                      value={draftDueDate}
                      onChange={(e) => setDraftDueDate(e.target.value)}
                    />
                  </label>

                  <label className="block text-xs text-[var(--muted)] sm:text-sm">
                    Requisito vinculado
                    <select
                      className="mt-1.5 w-full rounded-2xl border border-[var(--line)] bg-[var(--ink)] px-4 py-3 text-sm text-white outline-none focus:border-[var(--accent)]"
                      value={draftRequirementId ?? ""}
                      onChange={(e) =>
                        setDraftRequirementId(e.target.value || null)
                      }
                    >
                      <option value="">Nenhum</option>
                      {boardReqs.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.code} — {r.title}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="md:col-span-2">
                    <label className="block text-xs text-[var(--muted)] sm:text-sm">
                      Critérios de aceite
                      <textarea
                        className="mt-1.5 min-h-28 w-full resize-y rounded-2xl border border-[var(--line)] bg-[var(--ink)] px-4 py-3 text-sm text-white outline-none focus:border-[var(--accent)]"
                        value={draftAcceptance}
                        onChange={(e) => setDraftAcceptance(e.target.value)}
                        placeholder="O que precisa estar pronto para considerar este card concluído…"
                      />
                    </label>
                  </div>

                  <div className="rounded-2xl border border-[var(--line)] bg-black/15 p-4 md:col-span-2">
                    <p className="mb-2 text-xs font-medium text-[var(--muted)] sm:text-sm">
                      Etiquetas
                    </p>
                    <p className="mb-3 text-xs text-[var(--muted)]">
                      Só a cor aparece no card. Clique para marcar ou desmarcar.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {LABEL_COLOR_OPTIONS.map((option) => {
                        const selected = draftLabels.some(
                          (label) => label.color === option.id,
                        );
                        return (
                          <button
                            key={option.id}
                            type="button"
                            title={option.name}
                            aria-pressed={selected}
                            onClick={() => toggleLabelColor(option.id)}
                            className={`relative h-8 w-12 overflow-hidden rounded-md ${labelStyles[option.id]} ${
                              selected
                                ? "ring-2 ring-white ring-offset-2 ring-offset-[var(--ink-2)]"
                                : "opacity-80 hover:opacity-100"
                            }`}
                          >
                            {selected ? (
                              <Check className="mx-auto h-4 w-4 drop-shadow" />
                            ) : null}
                            <span className="sr-only">{option.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[var(--line)] bg-black/15 p-4 md:col-span-2">
                    <p className="mb-2 text-xs font-medium text-[var(--muted)] sm:text-sm">
                      Comentários
                    </p>
                    <ul className="mb-3 space-y-2">
                      {card.comments.map((c) => {
                        const author = c.authorId ? members[c.authorId] : null;
                        return (
                          <li
                            key={c.id}
                            className="rounded-xl border border-[var(--line)] bg-black/20 px-3 py-2"
                          >
                            <p className="text-[10px] text-[var(--muted)]">
                              {author?.name ?? "Membro"} ·{" "}
                              {new Date(c.createdAt).toLocaleString("pt-BR")}
                            </p>
                            <p className="mt-1 text-sm text-white">{c.body}</p>
                          </li>
                        );
                      })}
                      {card.comments.length === 0 ? (
                        <p className="text-xs text-[var(--muted)]">Sem comentários.</p>
                      ) : null}
                    </ul>
                    <div className="flex gap-2">
                      <input
                        className="min-w-0 flex-1 rounded-xl border border-[var(--line)] bg-[var(--ink)] px-3 py-2.5 text-sm text-white outline-none focus:border-[var(--accent)]"
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Escrever comentário…"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            const t = newComment.trim();
                            if (!t) return;
                            addCardComment(card.id, t);
                            setNewComment("");
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const t = newComment.trim();
                          if (!t) return;
                          addCardComment(card.id, t);
                          setNewComment("");
                        }}
                        className="rounded-xl border border-[var(--line)] px-3 py-2.5 text-sm text-white hover:bg-white/5"
                      >
                        Enviar
                      </button>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[var(--line)] bg-black/15 p-4 md:col-span-2">
                    <p className="mb-2 text-xs font-medium text-[var(--muted)] sm:text-sm">
                      Checklist
                    </p>
                    <ul className="mb-3 space-y-2">
                      {draftChecklist.map((item) => (
                        <li key={item.id} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={item.done}
                            onChange={() =>
                              setDraftChecklist((prev) =>
                                prev.map((i) =>
                                  i.id === item.id
                                    ? { ...i, done: !i.done }
                                    : i,
                                ),
                              )
                            }
                            className="h-4 w-4 accent-[var(--accent)]"
                          />
                          <span
                            className={`min-w-0 flex-1 text-sm ${
                              item.done
                                ? "text-[var(--muted)] line-through"
                                : "text-white"
                            }`}
                          >
                            {item.text}
                          </span>
                          <button
                            type="button"
                            className="rounded p-1 text-[var(--muted)] hover:text-rose-300"
                            onClick={() =>
                              setDraftChecklist((prev) =>
                                prev.filter((i) => i.id !== item.id),
                              )
                            }
                            aria-label="Remover item"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                    <div className="flex gap-2">
                      <input
                        className="min-w-0 flex-1 rounded-xl border border-[var(--line)] bg-[var(--ink)] px-3 py-2.5 text-sm text-white outline-none focus:border-[var(--accent)]"
                        value={newCheckText}
                        onChange={(e) => setNewCheckText(e.target.value)}
                        placeholder="Novo item…"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addCheckItem();
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={addCheckItem}
                        className="inline-flex items-center gap-1 rounded-xl border border-[var(--line)] px-3 py-2.5 text-sm text-white hover:bg-white/5"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <footer className="flex shrink-0 border-t border-[var(--line)] bg-black/25 px-3 py-3 backdrop-blur-md sm:px-6 sm:py-4 lg:px-10">
              <div className="mx-auto flex w-full max-w-5xl flex-col-reverse gap-2 sm:flex-row">
                <button
                  type="button"
                  className="rounded-xl border border-[var(--line)] px-3 py-3.5 text-sm text-[var(--muted)] hover:text-white sm:w-auto"
                  onClick={() => {
                    archiveCard(card.id);
                    setOpen(false);
                    toast("Card arquivado");
                  }}
                >
                  Arquivar
                </button>
                <div className="flex gap-2 sm:flex-1">
                  <button
                    type="button"
                    className="flex-1 rounded-xl border border-[var(--line)] px-3 py-3.5 text-sm text-[var(--muted)] hover:text-white"
                    onClick={() => setOpen(false)}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="flex-[1.4] rounded-xl bg-[var(--accent)] px-3 py-3.5 text-sm font-semibold text-[var(--accent-on)]"
                    onClick={save}
                  >
                    Salvar
                  </button>
                </div>
              </div>
            </footer>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <article
        role="button"
        tabIndex={0}
        className={`group/card board-card-surface cursor-pointer border p-3 transition ${
          urgency === "overdue"
            ? "border-rose-400/55"
            : urgency === "today" || urgency === "soon"
              ? "border-amber-400/40"
              : ""
        } ${dragging ? "opacity-40" : "opacity-100"} ${
          overlay ? "ring-2 ring-[var(--accent)]" : "hover:border-[rgba(9,30,66,0.14)]"
        }`}
        style={{
          borderRadius: "var(--board-card-radius, 0.75rem)",
          ...cardCoverStyle(card.coverColor),
        }}
        onClick={() => {
          if (!overlay) setOpen(true);
        }}
        onKeyDown={(e) => {
          if (overlay) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        <div className="mb-1 flex items-start gap-1">
          {dragHandleProps ? (
            <button
              type="button"
              className="mt-0.5 shrink-0 cursor-grab rounded p-0.5 board-card-muted hover:bg-black/5 hover:text-[var(--board-card-text)] active:cursor-grabbing"
              aria-label="Arrastar card"
              onClick={(e) => e.stopPropagation()}
              {...dragHandleProps}
            >
              <GripVertical className="h-4 w-4" />
            </button>
          ) : null}

          <div className="min-w-0 flex-1">
            <CardLabelBars labels={card.labels} />

            <h3 className="board-card-title text-sm font-medium leading-snug">
              {card.title}
            </h3>

            {card.description ? (
              <p className="board-card-muted mt-1 line-clamp-2 text-xs">
                {card.description}
              </p>
            ) : null}

            {linkedReq ? (
              <p className="mt-1.5 text-[10px] font-medium text-[var(--accent)]">
                {linkedReq.code}
              </p>
            ) : null}
          </div>

          <div className="flex shrink-0 flex-col items-end gap-1">
            {!overlay ? (
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] font-semibold uppercase tracking-wide board-card-muted hover:bg-black/5 hover:text-[var(--board-card-text)]"
                onClick={(e) => {
                  e.stopPropagation();
                  setPickingCover((open) => !open);
                }}
                aria-expanded={pickingCover}
                aria-label="Trocar fundo do card"
                title="Trocar fundo do card"
              >
                <Palette className="h-3.5 w-3.5" />
              </button>
            ) : null}
            <button
              type="button"
              className="shrink-0 rounded p-1 board-card-muted opacity-100 transition hover:bg-black/5 hover:text-[var(--accent)] sm:opacity-0 sm:group-hover/card:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(true);
              }}
              aria-label="Editar card"
              title="Editar"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {pickingCover && !overlay ? (
          <div
            className="mb-2 rounded-lg border border-black/10 bg-black/5 p-2"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide board-card-muted">
              Fundo do card
            </p>
            <CardCoverSwatches
              value={card.coverColor}
              onChange={(next) => {
                applyCover(next);
                setPickingCover(false);
              }}
            />
          </div>
        ) : null}

        <div className="mt-3 flex items-center justify-between gap-2 pl-0 sm:pl-5">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {card.priority ? (
              <span
                className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${cardPriorityStyles[card.priority]}`}
              >
                {priorityLabel[card.priority]}
              </span>
            ) : (
              <span className="board-card-muted text-[10px]">
                sem prioridade
              </span>
            )}
            {card.dueDate ? (
              <span
                className={`text-[10px] font-medium ${
                  urgency === "overdue"
                    ? "text-rose-600"
                    : urgency === "today"
                      ? "text-amber-700"
                      : urgency === "soon"
                        ? "text-amber-600"
                        : "board-card-muted"
                }`}
              >
                {urgency === "overdue" ? "Atrasado · " : ""}
                {card.dueDate.split("-").reverse().join("/")}
              </span>
            ) : null}
            {checklistTotal > 0 ? (
              <span className="board-card-muted inline-flex items-center gap-0.5 text-[10px]">
                <CheckSquare className="h-3 w-3" />
                {checklistDone}/{checklistTotal}
              </span>
            ) : null}
            {assignee ? (
              <span
                title={assignee.name}
                className={`flex h-6 max-w-[7rem] items-center gap-1 truncate rounded-full px-1.5 text-[10px] font-semibold ${labelStyles[assignee.color]}`}
              >
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-black/20 text-[9px]">
                  {assignee.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="truncate">{assignee.name.split(" ")[0]}</span>
              </span>
            ) : null}
          </div>
          <button
            type="button"
            className="board-card-muted rounded p-1 hover:bg-black/5 hover:text-rose-600"
            onClick={(e) => {
              e.stopPropagation();
              if (confirm(`Excluir o card "${card.title}"?`)) deleteCard(card.id);
            }}
            aria-label="Excluir card"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </article>

      {editor}
    </>
  );
}
