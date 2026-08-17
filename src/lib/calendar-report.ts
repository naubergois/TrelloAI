import type { DayUpdateReport, KanbanActivity } from "./types";

/** Data local YYYY-MM-DD */
export function calendarDayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function shiftCalendarDay(dateKey: string, deltaDays: number) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + deltaDays);
  return calendarDayKey(dt);
}

export function formatCalendarDayLabel(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  }).format(dt);
}

export function buildDayUpdateReport(
  boardId: string,
  date: string,
  memberIds: string[],
  activities: KanbanActivity[],
): DayUpdateReport {
  const dayActs = activities.filter((a) => a.boardId === boardId && a.date === date);
  const updated = new Set(dayActs.map((a) => a.memberId));
  const updatedMemberIds = memberIds.filter((id) => updated.has(id));
  const missingMemberIds = memberIds.filter((id) => !updated.has(id));
  return {
    date,
    boardId,
    updatedMemberIds,
    missingMemberIds,
    activityCount: dayActs.length,
  };
}

export function dayReportMessage(
  managerName: string,
  dateLabel: string,
  updatedNames: string[],
  missingNames: string[],
) {
  const ok =
    updatedNames.length > 0
      ? `Atualizaram o kanban: ${updatedNames.join(", ")}.`
      : "Ninguém atualizou o kanban neste dia.";
  const missing =
    missingNames.length > 0
      ? `Não atualizaram: ${missingNames.join(", ")}.`
      : "Todo o time registrou atividade no board.";
  return `${managerName} — aviso do calendário (${dateLabel}):\n• ${ok}\n• ${missing}`;
}
