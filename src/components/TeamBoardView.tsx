"use client";

import { useMemo, useState } from "react";
import { CalendarRange, Users } from "lucide-react";
import { useBoardStore } from "@/lib/store";
import { CardItem } from "@/components/CardItem";
import { MemberAvatar } from "@/components/MemberAvatar";
import type { BoardCardFilter } from "@/lib/board-filters";
import type { Card } from "@/lib/types";
import {
  TEAM_BOARD_OVERDUE,
  buildTeamBoard,
  type TeamBoardColumn,
  type TeamBoardRow,
} from "@/lib/team-board";
import {
  teamEventKindDot,
  teamEventKindLabel,
  teamEventKindStyles,
} from "@/lib/utils";

const DAY_OPTIONS = [7, 14] as const;

export function TeamBoardView({
  boardId,
  filter,
  scopeBoardIds,
}: {
  boardId: string;
  filter: BoardCardFilter;
  scopeBoardIds: string[];
}) {
  const boards = useBoardStore((s) => s.boards);
  const lists = useBoardStore((s) => s.lists);
  const cards = useBoardStore((s) => s.cards);
  const members = useBoardStore((s) => s.members);
  const teams = useBoardStore((s) => s.teams);
  const calendarEvents = useBoardStore((s) => s.calendarEvents);
  const [dayCount, setDayCount] = useState<(typeof DAY_OPTIONS)[number]>(7);

  const board = boards[boardId];
  const team = board?.teamId ? teams[board.teamId] : null;

  const events = useMemo(
    () => Object.values(calendarEvents || {}),
    [calendarEvents],
  );

  const model = useMemo(
    () =>
      buildTeamBoard({
        boardIds: scopeBoardIds,
        boards,
        lists,
        cards,
        members,
        team,
        events,
        filter,
        dayCount,
      }),
    [scopeBoardIds, boards, lists, cards, members, team, events, filter, dayCount],
  );

  if (!board) return null;

  const colCount = model.columns.length;

  return (
    <section
      className="rounded-2xl border border-white/15 bg-black/20 shadow-[0_12px_40px_rgba(9,30,66,0.18)]"
      aria-label="Tarefas da equipe nos próximos dias"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-3 py-3 sm:px-4">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="mt-0.5 hidden rounded-xl border border-white/15 bg-white/10 p-2 text-[var(--accent)] sm:inline-flex">
            <CalendarRange className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/55">
              Quadro da equipe
            </p>
            <h2 className="font-[family-name:var(--font-display)] text-lg text-white sm:text-xl">
              Quem faz o quê nos próximos {dayCount} dias
            </h2>
            <p className="mt-0.5 text-xs text-white/60">
              {model.cardCount} tarefa{model.cardCount === 1 ? "" : "s"}
              {model.eventCount > 0
                ? ` · ${model.eventCount} evento${model.eventCount === 1 ? "" : "s"}`
                : ""}
              {model.beyondWindowCount > 0
                ? ` · ${model.beyondWindowCount} com prazo depois deste período`
                : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-white/15 bg-black/20 p-0.5">
          {DAY_OPTIONS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setDayCount(n)}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                dayCount === n
                  ? "bg-white text-[#0079bf]"
                  : "text-white/70 hover:text-white"
              }`}
            >
              {n} dias
            </button>
          ))}
        </div>
      </header>

      {model.rows.length === 0 ? (
        <div className="px-4 py-12 text-center">
          <Users className="mx-auto mb-3 h-9 w-9 text-white/40" />
          <p className="text-sm font-medium text-white">Ninguém no time ainda</p>
          <p className="mt-1 text-xs text-white/55">
            Cadastre a equipe no botão Equipe para ver as tarefas por pessoa.
          </p>
        </div>
      ) : (
        <div className="board-scroll overflow-x-auto">
          <div
            className="min-w-max"
            style={{
              display: "grid",
              gridTemplateColumns: `11.5rem repeat(${colCount}, minmax(10.5rem, 1fr))`,
            }}
          >
            <div className="sticky left-0 z-20 border-b border-white/10 bg-[#0e2416] px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/50">
                Pessoa
              </p>
            </div>
            {model.columns.map((col) => (
              <ColumnHeader key={col.key} column={col} today={model.today} />
            ))}

            {model.rows.map((row) => (
              <TeamBoardRowView
                key={row.memberId ?? "unassigned"}
                row={row}
                columns={model.columns}
                today={model.today}
                cards={cards}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function ColumnHeader({
  column,
  today,
}: {
  column: TeamBoardColumn;
  today: string;
}) {
  const isToday = column.date === today;
  const overdue = column.kind === "overdue";
  return (
    <div
      className={`border-b border-l border-white/10 px-2.5 py-2.5 ${
        overdue
          ? "bg-rose-950/35"
          : isToday
            ? "bg-[var(--accent)]/12"
            : "bg-black/15"
      }`}
    >
      {column.kind === "day" ? (
        <div>
          <p
            className={`text-[10px] font-semibold uppercase tracking-wide ${
              isToday ? "text-[var(--accent)]" : "text-white/50"
            }`}
          >
            {column.weekday}
            {isToday ? " · hoje" : ""}
          </p>
          <p className="font-[family-name:var(--font-display)] text-lg leading-none text-white">
            {column.dayNumber}
          </p>
        </div>
      ) : (
        <p
          className={`pt-1 text-xs font-semibold ${
            overdue ? "text-rose-200" : "text-white/75"
          }`}
        >
          {column.label}
        </p>
      )}
    </div>
  );
}

function TeamBoardRowView({
  row,
  columns,
  today,
  cards,
}: {
  row: TeamBoardRow;
  columns: TeamBoardColumn[];
  today: string;
  cards: Record<string, Card>;
}) {
  return (
    <>
      <div className="sticky left-0 z-10 flex items-center gap-2.5 border-t border-white/8 bg-[#12301c] px-3 py-3">
        {row.member ? (
          <MemberAvatar member={row.member} size="sm" />
        ) : (
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-[10px] font-bold text-white/70">
            ?
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-white">{row.name}</p>
          <p className="truncate text-[10px] text-white/50">
            {row.assignedCount === 0
              ? "Agenda livre"
              : `${row.assignedCount} tarefa${row.assignedCount === 1 ? "" : "s"}`}
            {row.overdueCount > 0
              ? ` · ${row.overdueCount} atrasada${row.overdueCount === 1 ? "" : "s"}`
              : ""}
          </p>
        </div>
      </div>
      {columns.map((col) => {
        const cell = row.cells[col.key] || { cards: [], events: [] };
        const isToday = col.date === today;
        const empty = cell.cards.length === 0 && cell.events.length === 0;
        return (
          <div
            key={`${row.memberId ?? "none"}-${col.key}`}
            className={`min-h-[5.5rem] space-y-1.5 border-l border-t border-white/8 px-1.5 py-1.5 ${
              col.key === TEAM_BOARD_OVERDUE
                ? "bg-rose-950/20"
                : isToday
                  ? "bg-[var(--accent)]/6"
                  : "bg-black/10"
            }`}
          >
            {cell.events.map((ev) => (
              <p
                key={ev.eventId}
                className={`flex items-center gap-1.5 truncate rounded-lg px-2 py-1 text-[11px] ${teamEventKindStyles[ev.kind]}`}
                title={`${teamEventKindLabel[ev.kind]} · ${ev.title}`}
              >
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${teamEventKindDot[ev.kind]}`}
                />
                <span className="truncate">
                  {ev.time ? `${ev.time} · ` : ""}
                  {ev.title}
                </span>
              </p>
            ))}
            {cell.cards.map((item) => {
              const card = cards[item.cardId];
              if (!card) return null;
              return <CardItem key={item.cardId} card={card} variant="chip" />;
            })}
            {empty ? (
              <p className="px-1 py-3 text-center text-[10px] text-white/25">—</p>
            ) : null}
          </div>
        );
      })}
    </>
  );
}
