"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ImagePlus, Loader2, NotebookPen, Paperclip, Trash2, X } from "lucide-react";
import { calendarDayKey, formatCalendarDayLabel } from "@/lib/calendar-report";
import {
  daysInCardRange,
  notesForDay,
  resolveCardDates,
  sanitizeCalendarDay,
  sanitizeDailyNoteBody,
} from "@/lib/card-schedule";
import {
  formatFileSize,
  isImageAttachment,
  MAX_ATTACHMENT_BYTES,
  postCardAttachmentFiles,
} from "@/lib/card-attachments";
import { useBoardStore } from "@/lib/store";
import { useToast } from "@/components/Toast";
import {
  attachmentsByIds,
  CardAttachmentMedia,
} from "@/components/CardAttachmentMedia";
import type { Card, CardAttachment, TeamMember } from "@/lib/types";

type PendingFile = { id: string; file: File; url: string };

function defaultObservationDay(
  startDate?: string | null,
  dueDate?: string | null,
) {
  const today = calendarDayKey();
  const range = resolveCardDates(startDate, dueDate);
  if (range.startDate && today < range.startDate) return range.startDate;
  if (range.dueDate && today > range.dueDate) return range.dueDate;
  return today;
}

function revokePending(files: PendingFile[]) {
  for (const item of files) URL.revokeObjectURL(item.url);
}

export function CardDailyNotes({
  card,
  members,
  boardId,
  startDate,
  dueDate,
}: {
  card: Card;
  members: Record<string, TeamMember>;
  boardId?: string;
  startDate?: string | null;
  dueDate?: string | null;
}) {
  const addCardDailyNote = useBoardStore((s) => s.addCardDailyNote);
  const updateCardDailyNote = useBoardStore((s) => s.updateCardDailyNote);
  const removeCardDailyNote = useBoardStore((s) => s.removeCardDailyNote);
  const addCardAttachment = useBoardStore((s) => s.addCardAttachment);
  const { toast } = useToast();
  const notes = card.dailyNotes || [];
  const rangeDays = daysInCardRange(startDate, dueDate);
  const [date, setDate] = useState(() => defaultObservationDay(startDate, dueDate));
  const [filterDay, setFilterDay] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [editPending, setEditPending] = useState<PendingFile[]>([]);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const editFileRef = useRef<HTMLInputElement | null>(null);
  const pendingRef = useRef(pending);
  const editPendingRef = useRef(editPending);
  pendingRef.current = pending;
  editPendingRef.current = editPending;

  useEffect(() => {
    setDate(defaultObservationDay(startDate, dueDate));
    setFilterDay(null);
  }, [startDate, dueDate, card.id]);

  useEffect(
    () => () => {
      revokePending(pendingRef.current);
      revokePending(editPendingRef.current);
    },
    [],
  );

  const selectedDay = sanitizeCalendarDay(date) || calendarDayKey();
  const timelineNotes = useMemo(() => {
    const visible = filterDay ? notesForDay(notes, filterDay) : notes;
    return [...visible].sort(
      (a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt),
    );
  }, [notes, filterDay]);

  const queueFiles = (files: FileList | File[], ontoEdit: boolean) => {
    const next = Array.from(files)
      .filter((file) => file.size > 0)
      .map((file) => ({
        id: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`,
        file,
        url: URL.createObjectURL(file),
      }));
    if (!next.length) return;
    if (ontoEdit) setEditPending((prev) => [...prev, ...next]);
    else setPending((prev) => [...prev, ...next]);
  };

  const uploadPending = async (files: PendingFile[]) => {
    if (!files.length) return [] as CardAttachment[];
    if (!boardId) {
      toast("Este card ainda não está em um board salvo.");
      return [];
    }
    const result = await postCardAttachmentFiles(
      boardId,
      card.id,
      files.map((item) => item.file),
    );
    if (result.error) {
      toast(result.error);
      return [];
    }
    for (const attachment of result.attachments) addCardAttachment(card.id, attachment);
    return result.attachments;
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const text = sanitizeDailyNoteBody(body);
    if (!text && pending.length === 0) return;
    setBusy(true);
    try {
      const uploaded = await uploadPending(pending);
      if (pending.length && uploaded.length === 0) return;
      if (!addCardDailyNote(card.id, selectedDay, text, uploaded.map((item) => item.id))) return;
      setBody("");
      revokePending(pending);
      setPending([]);
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async (noteId: string, currentIds: string[]) => {
    setBusy(true);
    try {
      const uploaded = await uploadPending(editPending);
      if (editPending.length && uploaded.length === 0) return;
      const ids = [...currentIds, ...uploaded.map((item) => item.id)];
      if (!updateCardDailyNote(card.id, noteId, editBody, ids)) return;
      setEditingId(null);
      setEditBody("");
      revokePending(editPending);
      setEditPending([]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-[var(--line)] bg-black/15 p-4 md:col-span-2">
      <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-[var(--muted)] sm:text-sm">
        <NotebookPen className="h-3.5 w-3.5" />
        Observações diárias
      </p>
      <p className="mb-3 text-[11px] text-[var(--muted)]">
        Texto, figuras e documentos no dia da execução — a linha do tempo abaixo guarda o histórico.
      </p>

      {rangeDays.length > 1 ? (
        <div className="mb-3 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setFilterDay(null)}
            className={`rounded-lg px-2 py-1 text-[10px] font-semibold ring-1 ${
              !filterDay
                ? "bg-[var(--accent)] text-[var(--accent-on)] ring-[var(--accent)]"
                : "bg-black/20 text-white/70 ring-white/10 hover:text-white"
            }`}
          >
            Linha do tempo
          </button>
          {rangeDays.map((day) => {
            const count = notesForDay(notes, day).length;
            const active = day === filterDay;
            return (
              <button
                key={day}
                type="button"
                onClick={() => setFilterDay(day)}
                className={`rounded-lg px-2 py-1 text-[10px] font-semibold ring-1 ${
                  active
                    ? "bg-[var(--accent)] text-[var(--accent-on)] ring-[var(--accent)]"
                    : count > 0
                      ? "bg-white/10 text-white ring-white/20"
                      : "bg-black/20 text-white/70 ring-white/10 hover:text-white"
                }`}
              >
                {formatCalendarDayLabel(day).replace(".", "")}
                {count > 0 ? ` · ${count}` : ""}
              </button>
            );
          })}
        </div>
      ) : null}

      <form onSubmit={(e) => void submit(e)} className="space-y-2">
        <label className="block text-[11px] text-[var(--muted)]">
          Dia
          <input
            type="date"
            value={selectedDay}
            min={startDate || undefined}
            max={dueDate || undefined}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 w-full rounded-xl border border-[var(--line)] bg-[var(--ink)] px-3 py-2 text-sm text-white outline-none focus:border-[var(--accent)]"
          />
        </label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          placeholder="O que aconteceu neste dia neste card…"
          className="w-full resize-y rounded-xl border border-[var(--line)] bg-[var(--ink)] px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/35 focus:border-[var(--accent)]"
        />
        <PendingPreviews
          files={pending}
          onRemove={(id) =>
            setPending((prev) => {
              const next = prev.filter((item) => item.id !== id);
              const removed = prev.find((item) => item.id === id);
              if (removed) URL.revokeObjectURL(removed.url);
              return next;
            })
          }
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--line)] px-3 py-2 text-xs text-white hover:bg-white/5 disabled:opacity-60"
          >
            <ImagePlus className="h-3.5 w-3.5" />
            Figuras e documentos
          </button>
          <button
            type="submit"
            disabled={busy || (!sanitizeDailyNoteBody(body) && pending.length === 0)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-[var(--accent-on)] disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}
            Registrar observação
          </button>
          <p className="text-[11px] text-[var(--muted)]">
            Até {formatFileSize(MAX_ATTACHMENT_BYTES)} por arquivo.
          </p>
        </div>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.txt,.md,.csv,.zip"
          className="hidden"
          onChange={(e) => {
            const files = e.target.files;
            e.target.value = "";
            if (files) queueFiles(files, false);
          }}
        />
      </form>

      <div className="relative mt-5">
        {timelineNotes.length > 0 ? (
          <div className="absolute bottom-2 left-[7px] top-2 w-px bg-[var(--line)]" />
        ) : null}
        <ul className="space-y-3">
          {timelineNotes.map((note) => (
            <DailyNoteItem
              key={note.id}
              note={note}
              attachments={attachmentsByIds(card.attachments, note.attachmentIds)}
              members={members}
              editing={editingId === note.id}
              editBody={editBody}
              editPending={editPending}
              busy={busy}
              onEditBody={setEditBody}
              onPickFiles={() => editFileRef.current?.click()}
              onToggleEdit={() => {
                if (editingId === note.id) {
                  setEditingId(null);
                  setEditBody("");
                  revokePending(editPending);
                  setEditPending([]);
                  return;
                }
                setEditingId(note.id);
                setEditBody(note.body);
                revokePending(editPending);
                setEditPending([]);
              }}
              onSave={() => void saveEdit(note.id, note.attachmentIds || [])}
              onRemovePending={(id) => {
                setEditPending((prev) => {
                  const removed = prev.find((item) => item.id === id);
                  if (removed) URL.revokeObjectURL(removed.url);
                  return prev.filter((item) => item.id !== id);
                });
              }}
              onRemoveAttachment={(attachmentId) => {
                updateCardDailyNote(
                  card.id,
                  note.id,
                  note.body,
                  (note.attachmentIds || []).filter((id) => id !== attachmentId),
                );
              }}
              onRemove={() => removeCardDailyNote(card.id, note.id)}
            />
          ))}
          {timelineNotes.length === 0 ? (
            <p className="text-xs text-[var(--muted)]">
              Nenhuma observação neste recorte.
            </p>
          ) : null}
        </ul>
        <input
          ref={editFileRef}
          type="file"
          multiple
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.txt,.md,.csv,.zip"
          className="hidden"
          onChange={(e) => {
            const files = e.target.files;
            e.target.value = "";
            if (files) queueFiles(files, true);
          }}
        />
      </div>
    </div>
  );
}

function PendingPreviews({
  files,
  onRemove,
}: {
  files: PendingFile[];
  onRemove: (id: string) => void;
}) {
  if (!files.length) return null;
  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {files.map((item) => {
        const image = isImageAttachment({
          mimeType: item.file.type,
          name: item.file.name,
        });
        return (
          <li
            key={item.id}
            className="relative overflow-hidden rounded-xl border border-[var(--line)] bg-black/30"
          >
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.url} alt="" className="h-24 w-full object-cover" />
            ) : (
              <div className="flex h-24 items-center gap-2 px-3 text-xs text-white">
                <Paperclip className="h-4 w-4 shrink-0 text-[var(--muted)]" />
                <span className="line-clamp-3">{item.file.name}</span>
              </div>
            )}
            <button
              type="button"
              className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white hover:bg-black"
              aria-label={`Remover ${item.file.name}`}
              onClick={() => onRemove(item.id)}
            >
              <X className="h-3 w-3" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function DailyNoteItem({
  note,
  attachments,
  members,
  editing,
  editBody,
  editPending,
  busy,
  onEditBody,
  onPickFiles,
  onToggleEdit,
  onSave,
  onRemovePending,
  onRemoveAttachment,
  onRemove,
}: {
  note: { id: string; date: string; body: string; authorId: string | null };
  attachments: CardAttachment[];
  members: Record<string, TeamMember>;
  editing: boolean;
  editBody: string;
  editPending: PendingFile[];
  busy: boolean;
  onEditBody: (value: string) => void;
  onPickFiles: () => void;
  onToggleEdit: () => void;
  onSave: () => void;
  onRemovePending: (id: string) => void;
  onRemoveAttachment: (attachmentId: string) => void;
  onRemove: () => void;
}) {
  const author = note.authorId ? members[note.authorId] : null;
  return (
    <li className="relative pl-7">
      <span className="absolute left-0 top-2 h-3.5 w-3.5 rounded-full border-2 border-[var(--accent)] bg-[var(--ink-2)]" />
      <div className="rounded-xl border border-[var(--line)] bg-black/20 px-3 py-2">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[10px] text-[var(--muted)]">
            {note.date.split("-").reverse().join("/")}
            {author?.name ? ` · ${author.name}` : ""}
          </p>
          <div className="flex gap-1">
            <button
              type="button"
              className="text-[10px] text-[var(--accent)] hover:underline"
              onClick={onToggleEdit}
            >
              {editing ? "Cancelar" : "Editar"}
            </button>
            <button
              type="button"
              className="rounded p-0.5 text-[var(--muted)] hover:text-rose-300"
              aria-label="Excluir observação"
              onClick={onRemove}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        {editing ? (
          <div className="mt-2 space-y-2">
            <textarea
              value={editBody}
              onChange={(e) => onEditBody(e.target.value)}
              rows={3}
              className="w-full resize-y rounded-lg border border-[var(--line)] bg-[var(--ink)] px-2.5 py-2 text-sm text-white outline-none focus:border-[var(--accent)]"
            />
            <CardAttachmentMedia attachments={attachments} compact />
            {attachments.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {attachments.map((attachment) => (
                  <button
                    key={attachment.id}
                    type="button"
                    className="rounded-lg border border-[var(--line)] px-2 py-1 text-[10px] text-[var(--muted)] hover:text-rose-300"
                    onClick={() => onRemoveAttachment(attachment.id)}
                  >
                    Remover {attachment.name}
                  </button>
                ))}
              </div>
            ) : null}
            <PendingPreviews files={editPending} onRemove={onRemovePending} />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={onPickFiles}
                className="rounded-lg border border-[var(--line)] px-2.5 py-1.5 text-xs text-white hover:bg-white/5"
              >
                Anexar
              </button>
              <button
                type="button"
                disabled={busy || (!sanitizeDailyNoteBody(editBody) && attachments.length === 0 && editPending.length === 0)}
                onClick={onSave}
                className="rounded-lg bg-[var(--accent)] px-2.5 py-1.5 text-xs font-semibold text-[var(--accent-on)] disabled:opacity-40"
              >
                Salvar
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-1 space-y-2">
            {note.body ? (
              <p className="whitespace-pre-wrap text-sm text-white">{note.body}</p>
            ) : null}
            <CardAttachmentMedia attachments={attachments} />
          </div>
        )}
      </div>
    </li>
  );
}
