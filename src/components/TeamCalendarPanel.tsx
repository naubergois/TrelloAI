"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useBoardStore } from "@/lib/store";
import {
  teamEventKindDot,
  teamEventKindLabel,
  teamEventKindStyles,
} from "@/lib/utils";
import {
  calendarDayKey,
  formatCalendarDayLabel,
  shiftCalendarDay,
} from "@/lib/calendar-report";
import type { TeamEventKind } from "@/lib/types";

const KINDS: TeamEventKind[] = [
  "meeting",
  "deadline",
  "milestone",
  "review",
  "other",
];

function monthMatrix(anchor: string) {
  const [y, m] = anchor.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const startPad = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(y, m, 0).getDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(
      `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
    );
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function monthLabel(anchor: string) {
  const [y, m] = anchor.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(new Date(y, m - 1, 1));
}

export function TeamCalendarPanel({
  boardId,
  onClose,
}: {
  boardId: string;
  onClose: () => void;
}) {
  const board = useBoardStore((s) => s.boards[boardId]);
  const members = useBoardStore((s) => s.members);
  const calendarEvents = useBoardStore((s) => s.calendarEvents);
  const createCalendarEvent = useBoardStore((s) => s.createCalendarEvent);
  const deleteCalendarEvent = useBoardStore((s) => s.deleteCalendarEvent);

  const today = calendarDayKey();
  const [mounted, setMounted] = useState(false);
  const [monthAnchor, setMonthAnchor] = useState(() => today.slice(0, 7) + "-01");
  const [selectedDay, setSelectedDay] = useState(today);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<TeamEventKind>("meeting");
  const [time, setTime] = useState("09:00");
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const boardEvents = useMemo(
    () =>
      Object.values(calendarEvents || {})
        .filter((e) => e.boardId === boardId)
        .sort((a, b) =>
          `${a.date}${a.time || ""}`.localeCompare(`${b.date}${b.time || ""}`),
        ),
    [calendarEvents, boardId],
  );

  const byDay = useMemo(() => {
    const map = new Map<string, typeof boardEvents>();
    for (const ev of boardEvents) {
      const list = map.get(ev.date) || [];
      list.push(ev);
      map.set(ev.date, list);
    }
    return map;
  }, [boardEvents]);

  const dayEvents = byDay.get(selectedDay) || [];
  const cells = useMemo(() => monthMatrix(monthAnchor), [monthAnchor]);

  const boardMembers = useMemo(() => {
    if (!board) return [];
    return (board.memberIds ?? []).map((id) => members[id]).filter(Boolean);
  }, [board, members]);

  const upcoming = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => shiftCalendarDay(today, i))
        .flatMap((d) => (byDay.get(d) || []).map((ev) => ({ ...ev, _day: d })))
        .slice(0, 8),
    [byDay, today],
  );

  const monthEventCount = useMemo(() => {
    const prefix = monthAnchor.slice(0, 7);
    return boardEvents.filter((e) => e.date.startsWith(prefix)).length;
  }, [boardEvents, monthAnchor]);

  const shiftMonth = (delta: number) => {
    const [y, m] = monthAnchor.split("-").map(Number);
    const dt = new Date(y, m - 1 + delta, 1);
    setMonthAnchor(calendarDayKey(dt));
  };

  const onCreate = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    createCalendarEvent({
      boardId,
      title,
      description,
      kind,
      date: selectedDay,
      time: time || null,
      teamId: board?.teamId ?? null,
      memberIds: boardMembers.map((m) => m.id),
    });
    setTitle("");
    setDescription("");
    setKind("meeting");
    setFormOpen(false);
  };

  if (!mounted) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Calendário do time"
      className="anim-overlay fixed inset-0 z-[200] flex h-[100dvh] w-screen flex-col bg-[var(--ink)]"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-80"
        style={{
          background:
            "radial-gradient(900px 420px at 90% -5%, rgba(46,196,182,0.14), transparent 55%), radial-gradient(700px 380px at 10% 0%, rgba(56,132,255,0.12), transparent 50%)",
        }}
      />

      <header className="anim-sheet relative z-10 flex shrink-0 items-center justify-between gap-3 border-b border-[var(--line)] bg-black/25 px-4 py-3 backdrop-blur-md sm:px-6 sm:py-4 lg:px-10">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
            {board?.title ?? "Board"}
          </p>
          <h2 className="font-[family-name:var(--font-display)] text-xl tracking-tight text-white sm:text-2xl">
            Calendário do time
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden rounded-full border border-[var(--line)] bg-black/20 px-3 py-1 text-xs text-[var(--muted)] sm:inline">
            {monthEventCount} neste mês
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
        <div className="anim-sheet mx-auto grid w-full max-w-6xl gap-5 px-4 py-5 sm:gap-6 sm:px-6 sm:py-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:px-10">
          <section className="rounded-3xl border border-[var(--line)] bg-[var(--panel-strong)] p-4 shadow-[0_20px_50px_rgba(0,0,0,0.25)] sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-2">
              <button
                type="button"
                className="rounded-xl border border-[var(--line)] p-2.5 text-[var(--muted)] transition hover:border-white/20 hover:text-white"
                onClick={() => shiftMonth(-1)}
                aria-label="Mês anterior"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <div className="text-center">
                <p className="font-[family-name:var(--font-display)] text-lg capitalize text-white sm:text-xl">
                  {monthLabel(monthAnchor)}
                </p>
                <button
                  type="button"
                  className="mt-0.5 text-xs text-[var(--accent)] hover:underline"
                  onClick={() => {
                    setSelectedDay(today);
                    setMonthAnchor(today.slice(0, 7) + "-01");
                  }}
                >
                  Voltar para hoje
                </button>
              </div>
              <button
                type="button"
                className="rounded-xl border border-[var(--line)] p-2.5 text-[var(--muted)] transition hover:border-white/20 hover:text-white"
                onClick={() => shiftMonth(1)}
                aria-label="Próximo mês"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[11px] font-medium uppercase tracking-wide text-[var(--muted)] sm:text-xs">
              {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((d) => (
                <span key={d} className="py-1">
                  {d}
                </span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
              {cells.map((day, idx) => {
                if (!day) {
                  return (
                    <span
                      key={`empty-${idx}`}
                      className="min-h-11 sm:min-h-[4.5rem]"
                    />
                  );
                }
                const dayList = byDay.get(day) || [];
                const isSelected = day === selectedDay;
                const isToday = day === today;
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => {
                      setSelectedDay(day);
                      setFormOpen(false);
                    }}
                    className={`flex min-h-11 flex-col items-stretch rounded-2xl p-1 text-left transition sm:min-h-[4.5rem] sm:p-1.5 ${
                      isSelected
                        ? "bg-[var(--accent)] text-teal-950 shadow-[0_8px_24px_rgba(46,196,182,0.25)]"
                        : isToday
                          ? "bg-white/10 text-white ring-1 ring-[var(--accent)]/40"
                          : "bg-black/15 text-[var(--muted)] hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <span
                      className={`text-sm font-semibold sm:text-base ${
                        isSelected ? "text-teal-950" : ""
                      }`}
                    >
                      {Number(day.slice(-2))}
                    </span>
                    {dayList.length > 0 ? (
                      <div className="mt-auto hidden space-y-0.5 sm:block">
                        {dayList.slice(0, 2).map((ev) => (
                          <p
                            key={ev.id}
                            className={`truncate rounded px-1 text-[9px] leading-4 ${
                              isSelected
                                ? "bg-teal-950/15 text-teal-950"
                                : teamEventKindStyles[ev.kind]
                            }`}
                          >
                            {ev.time ? `${ev.time} ` : ""}
                            {ev.title}
                          </p>
                        ))}
                        {dayList.length > 2 ? (
                          <p
                            className={`text-[9px] ${
                              isSelected ? "text-teal-900/80" : "text-[var(--muted)]"
                            }`}
                          >
                            +{dayList.length - 2}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                    {dayList.length > 0 ? (
                      <span className="mt-auto flex justify-center gap-0.5 pb-0.5 sm:hidden">
                        {dayList.slice(0, 3).map((ev) => (
                          <span
                            key={ev.id}
                            className={`h-1.5 w-1.5 rounded-full ${
                              isSelected
                                ? "bg-teal-950"
                                : teamEventKindDot[ev.kind]
                            }`}
                          />
                        ))}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {KINDS.map((k) => (
                <span
                  key={k}
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] ${teamEventKindStyles[k]}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${teamEventKindDot[k]}`} />
                  {teamEventKindLabel[k]}
                </span>
              ))}
            </div>
          </section>

          <section className="flex min-h-0 flex-col gap-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                  Dia selecionado
                </p>
                <p className="font-[family-name:var(--font-display)] text-xl capitalize text-white">
                  {formatCalendarDayLabel(selectedDay)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFormOpen((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-2xl bg-[var(--accent)] px-3.5 py-2.5 text-sm font-semibold text-teal-950 transition hover:brightness-110"
              >
                <Plus className="h-4 w-4" />
                {formOpen ? "Fechar formulário" : "Novo evento"}
              </button>
            </div>

            {formOpen ? (
              <form
                onSubmit={onCreate}
                className="space-y-3 rounded-3xl border border-[var(--accent)]/35 bg-[var(--accent)]/5 p-4 sm:p-5"
              >
                <label className="block text-xs text-[var(--muted)]">
                  Título
                  <input
                    className="mt-1.5 w-full rounded-2xl border border-[var(--line)] bg-[var(--ink)] px-4 py-3 text-sm text-white outline-none focus:border-[var(--accent)]"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ex.: Review da sprint"
                    required
                    autoFocus
                  />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-xs text-[var(--muted)]">
                    Tipo
                    <select
                      className="mt-1.5 w-full rounded-2xl border border-[var(--line)] bg-[var(--ink)] px-3 py-3 text-sm text-white outline-none focus:border-[var(--accent)]"
                      value={kind}
                      onChange={(e) => setKind(e.target.value as TeamEventKind)}
                    >
                      {KINDS.map((k) => (
                        <option key={k} value={k}>
                          {teamEventKindLabel[k]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-xs text-[var(--muted)]">
                    Horário
                    <input
                      type="time"
                      className="mt-1.5 w-full rounded-2xl border border-[var(--line)] bg-[var(--ink)] px-3 py-3 text-sm text-white outline-none focus:border-[var(--accent)]"
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                    />
                  </label>
                </div>
                <label className="block text-xs text-[var(--muted)]">
                  Descrição
                  <textarea
                    className="mt-1.5 min-h-20 w-full rounded-2xl border border-[var(--line)] bg-[var(--ink)] px-4 py-3 text-sm text-white outline-none focus:border-[var(--accent)]"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Notas, sala, link…"
                  />
                </label>
                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-2xl bg-[var(--accent)] px-4 py-3.5 text-sm font-semibold text-teal-950"
                >
                  <Plus className="h-4 w-4" />
                  Adicionar em {formatCalendarDayLabel(selectedDay)}
                </button>
              </form>
            ) : null}

            <div className="space-y-2">
              {dayEvents.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-[var(--line)] bg-black/15 px-4 py-12 text-center">
                  <CalendarDays className="mx-auto mb-3 h-8 w-8 text-[var(--muted)] opacity-70" />
                  <p className="text-sm text-white">Nada neste dia</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    Clique em &quot;Novo evento&quot; para agendar.
                  </p>
                </div>
              ) : (
                dayEvents.map((ev) => (
                  <article
                    key={ev.id}
                    className="group rounded-3xl border border-[var(--line)] bg-[var(--panel-strong)] p-4 transition hover:border-[var(--accent)]/35"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${teamEventKindStyles[ev.kind]}`}
                          >
                            {teamEventKindLabel[ev.kind]}
                          </span>
                          {ev.time ? (
                            <span className="text-xs text-[var(--muted)]">
                              {ev.time}
                            </span>
                          ) : null}
                        </div>
                        <h3 className="text-base font-medium text-white">
                          {ev.title}
                        </h3>
                        {ev.description ? (
                          <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">
                            {ev.description}
                          </p>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        className="shrink-0 rounded-lg p-1.5 text-[var(--muted)] opacity-100 transition hover:bg-white/5 hover:text-rose-300 sm:opacity-0 sm:group-hover:opacity-100"
                        onClick={() => {
                          if (confirm(`Excluir "${ev.title}"?`)) {
                            deleteCalendarEvent(ev.id);
                          }
                        }}
                        aria-label="Excluir evento"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>

            {upcoming.length > 0 ? (
              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                  Agenda próxima
                </p>
                <div className="overflow-hidden rounded-3xl border border-[var(--line)] bg-black/20">
                  {upcoming.map((ev, i) => (
                    <button
                      key={`soon-${ev.id}`}
                      type="button"
                      className={`flex w-full items-center gap-3 px-3.5 py-3 text-left transition hover:bg-white/5 ${
                        i > 0 ? "border-t border-[var(--line)]" : ""
                      }`}
                      onClick={() => {
                        setSelectedDay(ev._day);
                        setMonthAnchor(ev._day.slice(0, 7) + "-01");
                        setFormOpen(false);
                      }}
                    >
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${teamEventKindDot[ev.kind]}`}
                      />
                      <span className="min-w-0 flex-1 truncate text-sm text-white">
                        {ev.title}
                      </span>
                      <span className="shrink-0 text-xs text-[var(--muted)]">
                        {formatCalendarDayLabel(ev._day)}
                        {ev.time ? ` · ${ev.time}` : ""}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </div>,
    document.body,
  );
}
