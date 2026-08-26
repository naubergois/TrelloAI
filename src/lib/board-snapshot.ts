import type {
  Board,
  Card,
  List,
  Meeting,
  Requirement,
  Team,
  TeamCalendarEvent,
  TeamMember,
  VirtualManager,
  StandupSession,
  KanbanActivity,
  MayaDayLog,
} from "./types";

export type BoardSnapshot = {
  board: Board;
  lists: Record<string, List>;
  cards: Record<string, Card>;
  members: Record<string, TeamMember>;
  teams: Record<string, Team>;
  meetings: Record<string, Meeting>;
  managers: Record<string, VirtualManager>;
  standups: Record<string, StandupSession>;
  /** Histórico diário do chat da Maya (dias anteriores viram arquivo). */
  mayaLogs?: Record<string, MayaDayLog>;
  activities: Record<string, KanbanActivity>;
  requirements: Record<string, Requirement>;
  calendarEvents: Record<string, TeamCalendarEvent>;
  updatedAt: string;
};
