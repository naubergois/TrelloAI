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

const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

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
  const lists = useBoardStore((s) => s.lists);
  const cards = useBoardStore((s) => s.cards);
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

  const boardCardDues = useMemo(() => {
    if (!board) return [] as { id: string; title: string; date: string }[];
    return board.listIds
      .flatMap((listId) =>
        (lists[listId]?.cardIds ?? [])
          .map((id) => cards[id])
          .filter((c): c is NonNullable<typeof c> => Boolean(c?.dueDate)),
      )
      .map((c) => ({
        id: c.id,
        title: c.title,
        date: c.dueDate as string,
      }));
  }, [board, lists, cards]);

  const byDay = useMemo(() => {
    const map = new Map<
      string,
      {
        events: typeof boardEvents;
        cardDues: typeof boardCardDues;
      }
    >();
    for (const ev of boardEvents) {
      const entry = map.get(ev.date) || { events: [], cardDues: [] };
      entry.events.push(ev);
      map.set(ev.date, entry);
    }
    for (const due of boardCardDues) {
      const entry = map.get(due.date) || { events: [], cardDues: [] };
      entry.cardDues.push(due);
      map.set(due.date, entry);
    }
    return map;
  }, [boardEvents, boardCardDues]);

  const dayEntry = byDay.get(selectedDay) || { events: [], cardDues: [] };
  const dayEvents = dayEntry.events;
  const dayCardDues = dayEntry.cardDues;
  const dayItemCount = dayEvents.length + dayCardDues.length;
  const cells = useMemo(() => monthMatrix(monthAnchor), [monthAnchor]);
  const rowCount = Math.ceil(cells.length / 7);

  const boardMembers = useMemo(() => {
    if (!board) return [];
    return (board.memberIds ?? []).map((id) => members[id]).filter(Boolean);
  }, [board, members]);

  const upcoming = useMemo(() => {
    const items: {
      id: string;
      title: string;
      _day: string;
      time?: string | null;
      kind: "event" | "card";
      eventKind?: TeamEventKind;
    }[] = [];
    for (let i = 0; i < 21; i++) {
      const d = shiftCalendarDay(today, i);
      const entry = byDay.get(d);
      if (!entry) continue;
      for (const ev of entry.events) {
        items.push({
          id: `ev-${ev.id}`,
          title: ev.title,
          _day: d,
          time: ev.time,
          kind: "event",
          eventKind: ev.kind,
        });
      }
      for (const due of entry.cardDues) {
        items.push({
          id: `card-${due.id}`,
          title: due.title,
          _day: d,
          kind: "card",
        });
      }
    }
    return items.slice(0, 14);
  }, [byDay, today]);

  const monthEventCount = useMemo(() => {
    const prefix = monthAnchor.slice(0, 7);
    const events = boardEvents.filter((e) => e.date.startsWith(prefix)).length;
    const dues = boardCardDues.filter((c) => c.date.startsWith(prefix)).length;
    return events + dues;
  }, [boardEvents, boardCardDues, monthAnchor]);

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
      className="anim-overlay fixed inset-0 z-[200] flex h-dvh max-h-dvh w-screen flex-col bg-[#026aa7]"
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(1100px 520px at 88% -8%, rgba(255,255,255,0.14), transparent 55%), radial-gradient(900px 480px at 8% 0%, rgba(0,121,191,0.45), transparent 50%), linear-gradient(165deg,#026aa7 0%,#0079bf 42%,#055a8c 100%)",
        }}
      />

      <header className="relative z-10 flex shrink-0 items-center justify-between gap-3 border-b border-white/12 bg-black/15 px-4 py-3 backdrop-blur-md sm:px-6 sm:py-3.5 lg:px-8">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/65">
            {board?.title ?? "Board"}
          </p>
          <h2 className="font-[family-name:var(--font-display)] text-xl tracking-tight text-white sm:text-2xl">
            Calendário do time
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs text-white/85 sm:inline">
            {monthEventCount} neste mês
          </span>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-xl border border-white/20 bg-white/10 p-2.5 text-white/80 transition hover:bg-white/20 hover:text-white"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </header>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Calendário — ocupa a maior parte da tela */}
        <section
          className="flex min-h-0 flex-1 flex-col px-3 py-3 sm:px-5 sm:py-4 lg:min-h-0 lg:flex-[1.55] lg:px-6 lg:py-5"
        >
          <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-white/18 bg-white/95 shadow-[0_12px_40px_rgba(9,30,66,0.18)] sm:rounded-3xl">
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[#091e42]/8 px-3 py-3 sm:px-5 sm:py-4">
              <button
                type="button"
                className="rounded-xl border border-[#091e42]/10 p-2.5 text-[var(--trello-gray)] transition hover:border-[#0079bf]/30 hover:bg-[#0079bf]/5 hover:text-[#0079bf]"
                onClick={() => shiftMonth(-1)}
                aria-label="Mês anterior"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <div className="text-center">
                <p className="font-[family-name:var(--font-display)] text-lg capitalize text-[var(--trello-navy)] sm:text-2xl">
                  {monthLabel(monthAnchor)}
                </p>
                <button
                  type="button"
                  className="mt-0.5 text-xs font-medium text-[#0079bf] hover:underline"
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
                className="rounded-xl border border-[#091e42]/10 p-2.5 text-[var(--trello-gray)] transition hover:border-[#0079bf]/30 hover:bg-[#0079bf]/5 hover:text-[#0079bf]"
                onClick={() => shiftMonth(1)}
                aria-label="Próximo mês"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            <div className="grid shrink-0 grid-cols-7 gap-1 border-b border-[#091e42]/6 px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-[var(--trello-gray)] sm:gap-2 sm:px-4 sm:text-xs">
              {WEEKDAYS.map((d) => (
                <span key={d} className="py-1">{d}</span>
              ))}
            </div>

            <div
              className="grid min-h-0 flex-1 auto-rows-fr grid-cols-7 gap-1 px-2 py-2 sm:gap-2 sm:px-4 sm:py-3"
              style={{ gridTemplateRows: `repeat(${rowCount}, minmax(0, 1fr))` }}
            >
              {cells.map((day, idx) => {
                if (!day) {
                  return (
                    <span
                      key={`empty-${idx}`}
                      className="min-h-[3.25rem] rounded-xl bg-[#f4f5f7]/60 sm:min-h-0"
                    />
                  );
                }
                const entry = byDay.get(day) || { events: [], cardDues: [] };
                const dayList = entry.events;
                const dueList = entry.cardDues;
                const total = dayList.length + dueList.length;
                const isSelected = day === selectedDay;
                const isToday = day === today;
                const previewItems = [
                  ...dayList.slice(0, 2).map((ev) => ({
                    key: ev.id,
                    label: `${ev.time ? `${ev.time} ` : ""}${ev.title}`,
                    style: isSelected
                      ? "bg-[var(--trello-navy)]/12 text-[var(--trello-navy)]"
                      : teamEventKindStyles[ev.kind],
                    dot: teamEventKindDot[ev.kind],
                  })),
                  ...dueList.slice(0, Math.max(0, 2 - dayList.length)).map((due) => ({
                    key: due.id,
                    label: `Prazo · ${due.title}`,
                    style: isSelected
                      ? "bg-[var(--trello-navy)]/12 text-[var(--trello-navy)]"
                      : "bg-amber-100 text-amber-900",
                    dot: "bg-amber-400",
                  })),
                ];

                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => {
                      setSelectedDay(day);
                      setFormOpen(false);
                    }}
                    className={`flex min-h-[3.25rem] flex-col rounded-xl border p-1.5 text-left transition sm:min-h-0 sm:p-2 ${
                      isSelected
                        ? "border-[#0079bf] bg-[#0079bf] text-white shadow-[0_6px_20px_rgba(0,121,191,0.35)]"
                        : isToday
                          ? "border-[#0079bf]/45 bg-[#0079bf]/8 text-[var(--trello-navy)] ring-1 ring-[#0079bf]/25"
                          : "border-transparent bg-[#f4f5f7] text-[var(--trello-navy)] hover:border-[#091e42]/10 hover:bg-white"
                    }`}
                  >
                    <span
                      className={`text-sm font-bold sm:text-base ${
                        isSelected ? "text-white" : ""
                      }`}
                    >
                      {Number(day.slice(-2))}
                    </span>
                    {total > 0 ? (
                      <div className="mt-1 hidden min-h-0 flex-1 flex-col gap-0.5 overflow-hidden md:flex">
                        {previewItems.map((item) => (
                          <p
                            key={item.key}
                            className={`truncate rounded px-1 py-0.5 text-[10px] leading-tight sm:text-[11px] ${item.style}`}
                          >
                            {item.label}
                          </p>
                        ))}
                        {total > 2 ? (
                          <p
                            className={`text-[10px] ${
                              isSelected ? "text-white/80" : "text-[var(--trello-gray)]"
                            }`}
                          >
                            +{total - 2} mais
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                    {total > 0 ? (
                      <span className="mt-auto flex flex-wrap justify-start gap-0.5 pt-1 md:hidden">
                        {previewItems.slice(0, 3).map((item) => (
                          <span
                            key={item.key}
                            className={`h-1.5 w-1.5 rounded-full ${
                              isSelected ? "bg-white" : item.dot
                            }`}
                          />
                        ))}
                        {total > 3 ? (
                          <span
                            className={`text-[9px] leading-none ${
                              isSelected ? "text-white/80" : "text-[var(--trello-gray)]"
                            }`}
                          >
                            +
                          </span>
                        ) : null}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            <div className="flex shrink-0 flex-wrap gap-2 border-t border-[#091e42]/6 px-3 py-2.5 sm:px-5 sm:py-3">
              {KINDS.map((k) => (
                <span
                  key={k}
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] ${teamEventKindStyles[k]}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${teamEventKindDot[k]}`} />
                  {teamEventKindLabel[k]}
                </span>
              ))}
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-[10px] text-amber-900">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                Prazo de card
              </span>
            </div>
          </div>
        </section>

        {/* Detalhes do dia — sidebar fixa com scroll */}
        <aside
          className="board-scroll flex min-h-0 w-full shrink-0 flex-col border-t border-white/12 bg-[#091e42]/88 backdrop-blur-md lg:w-[min(26rem,34vw)] lg:border-l lg:border-t-0"
        >
          <div className="flex shrink-0 flex-wrap items-end justify-between gap-3 border-b border-white/10 px-4 py-4 sm:px-5">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/55">
                Dia selecionado
              </p>
              <p className="font-[family-name:var(--font-display)] text-xl capitalize text-white sm:text-2xl">
                {formatCalendarDayLabel(selectedDay)}
              </p>
              <p className="mt-0.5 text-xs text-white/60">
                {dayItemCount === 0
                  ? "Sem eventos"
                  : `${dayItemCount} item${dayItemCount === 1 ? "" : "s"}`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setFormOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-2.5 text-sm font-semibold text-[#0079bf] transition hover:bg-[#f4f5f7]"
            >
              <Plus className="h-4 w-4" />
              {formOpen ? "Fechar" : "Novo evento"}
            </button>
          </div>

          <div className="board-scroll min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5">
            {formOpen ? (
              <form
                onSubmit={onCreate}
                className="space-y-3 rounded-2xl border border-white/15 bg-white/10 p-4"
              >
                <label className="block text-xs text-white/70">
                  Título
                  <input
                    className="mt-1.5 w-full rounded-xl border border-white/15 bg-white/95 px-4 py-3 text-sm text-[var(--trello-navy)] outline-none focus:border-[#0079bf]"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ex.: Review da sprint"
                    required
                    autoFocus
                  />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-xs text-white/70">
                    Tipo
                    <select
                      className="mt-1.5 w-full rounded-xl border border-white/15 bg-white/95 px-3 py-3 text-sm text-[var(--trello-navy)] outline-none focus:border-[#0079bf]"
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
                  <label className="block text-xs text-white/70">
                    Horário
                    <input
                      type="time"
                      className="mt-1.5 w-full rounded-xl border border-white/15 bg-white/95 px-3 py-3 text-sm text-[var(--trello-navy)] outline-none focus:border-[#0079bf]"
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                    />
                  </label>
                </div>
                <label className="block text-xs text-white/70">
                  Descrição
                  <textarea
                    className="mt-1.5 min-h-20 w-full rounded-xl border border-white/15 bg-white/95 px-4 py-3 text-sm text-[var(--trello-navy)] outline-none focus:border-[#0079bf]"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Notas, sala, link…"
                  />
                </label>
                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#0079bf] px-4 py-3.5 text-sm font-semibold text-white"
                >
                  <Plus className="h-4 w-4" />
                  Adicionar em {formatCalendarDayLabel(selectedDay)}
                </button>
              </form>
            ) : null}

            <div className="space-y-2">
              {dayItemCount === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/20 bg-white/5 px-4 py-10 text-center">
                  <CalendarDays className="mx-auto mb-3 h-9 w-9 text-white/45" />
                  <p className="text-sm font-medium text-white">Nada neste dia</p>
                  <p className="mt-1 text-xs text-white/55">
                    Use &quot;Novo evento&quot; para agendar.
                  </p>
                </div>
              ) : (
                <>
                  {dayCardDues.map((due) => (
                    <article
                      key={`due-${due.id}`}
                      className="rounded-2xl border border-amber-400/35 bg-amber-500/15 p-4"
                    >
                      <span className="rounded-md bg-amber-400/25 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-100">
                        Prazo de card
                      </span>
                      <h3 className="mt-2 text-base font-medium text-white">
                        {due.title}
                      </h3>
                    </article>
                  ))}
                  {dayEvents.map((ev) => (
                    <article
                      key={ev.id}
                      className="group rounded-2xl border border-white/12 bg-white/10 p-4 transition hover:border-white/25 hover:bg-white/14"
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
                              <span className="text-xs text-white/65">{ev.time}</span>
                            ) : null}
                          </div>
                          <h3 className="text-base font-medium text-white">
                            {ev.title}
                          </h3>
                          {ev.description ? (
                            <p className="mt-1 text-sm leading-relaxed text-white/65">
                              {ev.description}
                            </p>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          className="shrink-0 rounded-lg p-1.5 text-white/50 opacity-100 transition hover:bg-white/10 hover:text-rose-300 sm:opacity-0 sm:group-hover:opacity-100"
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
                  ))}
                </>
              )}
            </div>

            {upcoming.length > 0 ? (
              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50">
                  Próximas 3 semanas
                </p>
                <div className="overflow-hidden rounded-2xl border border-white/12 bg-white/8">
                  {upcoming.map((item, i) => (
                    <button
                      key={`soon-${item.id}`}
                      type="button"
                      className={`flex w-full items-center gap-3 px-3.5 py-3 text-left transition hover:bg-white/10 ${
                        i > 0 ? "border-t border-white/10" : ""
                      }`}
                      onClick={() => {
                        setSelectedDay(item._day);
                        setMonthAnchor(item._day.slice(0, 7) + "-01");
                        setFormOpen(false);
                      }}
                    >
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${
                          item.kind === "card"
                            ? "bg-amber-400"
                            : teamEventKindDot[item.eventKind || "other"]
                        }`}
                      />
                      <span className="min-w-0 flex-1 truncate text-sm text-white">
                        {item.kind === "card" ? `Prazo · ${item.title}` : item.title}
                      </span>
                      <span className="shrink-0 text-xs text-white/55">
                        {formatCalendarDayLabel(item._day)}
                        {item.time ? ` · ${item.time}` : ""}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </aside>
      </div>
    </div>,
    document.body,
  );
}
