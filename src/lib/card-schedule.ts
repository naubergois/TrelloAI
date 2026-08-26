import { calendarDayKey, shiftCalendarDay } from "./calendar-report";
import type { CardDailyNote } from "./types";

export const CARD_DAILY_NOTE_MAX = 4000;
export const CARD_SCHEDULE_STRIP_MAX = 21;

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function sanitizeCalendarDay(raw: string | null | undefined): string | null {
  const value = (raw || "").trim();
  if (!DAY.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) {
    return null;
  }
  return value;
}

export function resolveCardDates(
  startDate: string | null | undefined,
  dueDate: string | null | undefined,
): { startDate: string | null; dueDate: string | null } {
  let start = sanitizeCalendarDay(startDate);
  let end = sanitizeCalendarDay(dueDate);
  if (start && end && start > end) {
    const swap = start;
    start = end;
    end = swap;
  }
  return { startDate: start, dueDate: end };
}

export function formatDayShort(date: string | null | undefined, today = calendarDayKey()): string {
  const day = sanitizeCalendarDay(date);
  if (!day) return "";
  const [y, m, d] = day.split("-");
  if (y === today.slice(0, 4)) return `${d}/${m}`;
  return `${d}/${m}/${y}`;
}

export function formatCardScheduleLabel(
  startDate: string | null | undefined,
  dueDate: string | null | undefined,
  today = calendarDayKey(),
): string {
  const range = resolveCardDates(startDate, dueDate);
  if (range.startDate && range.dueDate) {
    if (range.startDate === range.dueDate) return formatDayShort(range.dueDate, today);
    return `${formatDayShort(range.startDate, today)} → ${formatDayShort(range.dueDate, today)}`;
  }
  if (range.dueDate) return formatDayShort(range.dueDate, today);
  if (range.startDate) return `Início ${formatDayShort(range.startDate, today)}`;
  return "";
}

export function daysInCardRange(
  startDate: string | null | undefined,
  dueDate: string | null | undefined,
  max = CARD_SCHEDULE_STRIP_MAX,
): string[] {
  const range = resolveCardDates(startDate, dueDate);
  if (!range.startDate || !range.dueDate) return [];
  const days: string[] = [];
  let cursor = range.startDate;
  while (cursor <= range.dueDate && days.length < max) {
    days.push(cursor);
    cursor = shiftCalendarDay(cursor, 1);
  }
  return days;
}

export function sanitizeDailyNoteBody(raw: string | null | undefined): string {
  return String(raw || "")
    .replace(/\r\n/g, "\n")
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, CARD_DAILY_NOTE_MAX);
}

export function normalizeDailyNotes(notes: CardDailyNote[] | null | undefined): CardDailyNote[] {
  if (!Array.isArray(notes)) return [];
  return notes
    .map((note) => {
      const date = sanitizeCalendarDay(note?.date);
      const body = sanitizeDailyNoteBody(note?.body);
      if (!date || !body || !note?.id) return null;
      return {
        id: String(note.id),
        date,
        body,
        authorId: note.authorId ?? null,
        createdAt: note.createdAt || new Date().toISOString(),
        updatedAt: note.updatedAt || note.createdAt || new Date().toISOString(),
      } satisfies CardDailyNote;
    })
    .filter((note): note is CardDailyNote => Boolean(note))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

export function notesForDay(notes: CardDailyNote[] | null | undefined, date: string): CardDailyNote[] {
  const day = sanitizeCalendarDay(date);
  if (!day) return [];
  return normalizeDailyNotes(notes).filter((note) => note.date === day);
}
