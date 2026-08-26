"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { NotebookPen, Trash2 } from "lucide-react";
import { calendarDayKey, formatCalendarDayLabel } from "@/lib/calendar-report";
import {
  daysInCardRange,
  notesForDay,
  resolveCardDates,
  sanitizeCalendarDay,
  sanitizeDailyNoteBody,
} from "@/lib/card-schedule";
import { useBoardStore } from "@/lib/store";
import type { Card, TeamMember } from "@/lib/types";

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

export function CardDailyNotes({
  card,
  members,
  startDate,
  dueDate,
}: {
  card: Card;
  members: Record<string, TeamMember>;
  startDate?: string | null;
  dueDate?: string | null;
}) {
  const addCardDailyNote = useBoardStore((s) => s.addCardDailyNote);
  const updateCardDailyNote = useBoardStore((s) => s.updateCardDailyNote);
  const removeCardDailyNote = useBoardStore((s) => s.removeCardDailyNote);
  const notes = card.dailyNotes || [];
  const rangeDays = daysInCardRange(startDate, dueDate);
  const [date, setDate] = useState(() => defaultObservationDay(startDate, dueDate));
  const [body, setBody] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");

  useEffect(() => {
    setDate(defaultObservationDay(startDate, dueDate));
  }, [startDate, dueDate, card.id]);

  const selectedDay = sanitizeCalendarDay(date) || calendarDayKey();
  const selectedNotes = useMemo(
    () => notesForDay(notes, selectedDay),
    [notes, selectedDay],
  );
  const otherNotes = useMemo(
    () => notes.filter((note) => note.date !== selectedDay),
    [notes, selectedDay],
  );

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const text = sanitizeDailyNoteBody(body);
    if (!text) return;
    addCardDailyNote(card.id, selectedDay, text);
    setBody("");
  };

  return (
    <div className="rounded-2xl border border-[var(--line)] bg-black/15 p-4 md:col-span-2">
      <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-[var(--muted)] sm:text-sm">
        <NotebookPen className="h-3.5 w-3.5" />
        Observações diárias
      </p>
      <p className="mb-3 text-[11px] text-[var(--muted)]">
        Um registro por dia da execução — o que avançou, o que travou.
      </p>

      {rangeDays.length > 1 ? (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {rangeDays.map((day) => {
            const count = notesForDay(notes, day).length;
            const active = day === selectedDay;
            return (
              <button
                key={day}
                type="button"
                onClick={() => setDate(day)}
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

      <form onSubmit={submit} className="space-y-2">
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
        <button
          type="submit"
          disabled={!sanitizeDailyNoteBody(body)}
          className="rounded-xl bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-[var(--accent-on)] disabled:opacity-40"
        >
          Registrar observação
        </button>
      </form>

      <ul className="mt-4 space-y-2">
        {selectedNotes.map((note) => (
          <DailyNoteItem
            key={note.id}
            cardId={card.id}
            note={note}
            members={members}
            editing={editingId === note.id}
            editBody={editBody}
            onEditBody={setEditBody}
            onToggleEdit={() => {
              if (editingId === note.id) {
                setEditingId(null);
                setEditBody("");
                return;
              }
              setEditingId(note.id);
              setEditBody(note.body);
            }}
            onSave={() => {
              if (!updateCardDailyNote(card.id, note.id, editBody)) return;
              setEditingId(null);
              setEditBody("");
            }}
            onRemove={() => removeCardDailyNote(card.id, note.id)}
          />
        ))}
        {selectedNotes.length === 0 ? (
          <p className="text-xs text-[var(--muted)]">
            Nenhuma observação neste dia.
          </p>
        ) : null}
        {otherNotes.length > 0 ? (
          <>
            <p className="pt-2 text-[10px] font-semibold uppercase tracking-wide text-white/45">
              Outros dias
            </p>
            {otherNotes.map((note) => (
              <DailyNoteItem
                key={note.id}
                cardId={card.id}
                note={note}
                members={members}
                editing={editingId === note.id}
                editBody={editBody}
                onEditBody={setEditBody}
                onToggleEdit={() => {
                  if (editingId === note.id) {
                    setEditingId(null);
                    setEditBody("");
                    return;
                  }
                  setEditingId(note.id);
                  setEditBody(note.body);
                }}
                onSave={() => {
                  if (!updateCardDailyNote(card.id, note.id, editBody)) return;
                  setEditingId(null);
                  setEditBody("");
                }}
                onRemove={() => removeCardDailyNote(card.id, note.id)}
              />
            ))}
          </>
        ) : null}
      </ul>
    </div>
  );
}

function DailyNoteItem({
  note,
  members,
  editing,
  editBody,
  onEditBody,
  onToggleEdit,
  onSave,
  onRemove,
}: {
  cardId: string;
  note: { id: string; date: string; body: string; authorId: string | null };
  members: Record<string, TeamMember>;
  editing: boolean;
  editBody: string;
  onEditBody: (value: string) => void;
  onToggleEdit: () => void;
  onSave: () => void;
  onRemove: () => void;
}) {
  const author = note.authorId ? members[note.authorId] : null;
  return (
    <li className="rounded-xl border border-[var(--line)] bg-black/20 px-3 py-2">
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
          <button
            type="button"
            disabled={!sanitizeDailyNoteBody(editBody)}
            onClick={onSave}
            className="rounded-lg bg-[var(--accent)] px-2.5 py-1.5 text-xs font-semibold text-[var(--accent-on)] disabled:opacity-40"
          >
            Salvar
          </button>
        </div>
      ) : (
        <p className="mt-1 whitespace-pre-wrap text-sm text-white">{note.body}</p>
      )}
    </li>
  );
}
