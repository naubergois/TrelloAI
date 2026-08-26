import { cardAssigneeIds } from "./members";

export type BoardCardFilter = {
  query: string;
  assigneeId: string;
  priority: "" | "high" | "medium" | "low";
  due: "" | "overdue" | "soon" | "any";
};

export const EMPTY_BOARD_FILTER: BoardCardFilter = {
  query: "",
  assigneeId: "",
  priority: "",
  due: "",
};

export function isBoardFilterActive(filter: BoardCardFilter) {
  return Boolean(
    filter.query.trim() || filter.assigneeId || filter.priority || filter.due,
  );
}

export function calendarDayFromDate(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function dueUrgency(dueDate: string | null | undefined): "overdue" | "today" | "soon" | null {
  if (!dueDate) return null;
  const today = calendarDayFromDate();
  if (dueDate < today) return "overdue";
  if (dueDate === today) return "today";
  const soon = new Date();
  soon.setDate(soon.getDate() + 3);
  if (dueDate <= calendarDayFromDate(soon)) return "soon";
  return null;
}

export function cardMatchesFilter(
  card: {
    title: string;
    description?: string;
    assigneeId?: string | null;
    assigneeIds?: string[] | null;
    priority?: string | null;
    dueDate?: string | null;
    archived?: boolean;
  },
  filter: BoardCardFilter,
) {
  if (card.archived) return false;
  if (!isBoardFilterActive(filter)) return true;

  const q = filter.query.trim().toLowerCase();
  if (q) {
    const hay = `${card.title} ${card.description || ""}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }

  if (filter.assigneeId && !cardAssigneeIds(card).includes(filter.assigneeId)) return false;
  if (filter.priority && card.priority !== filter.priority) return false;

  if (filter.due === "any" && !card.dueDate) return false;
  if (filter.due === "overdue") {
    const u = dueUrgency(card.dueDate);
    if (u !== "overdue") return false;
  }
  if (filter.due === "soon") {
    const u = dueUrgency(card.dueDate);
    if (u !== "today" && u !== "soon") return false;
  }

  return true;
}
