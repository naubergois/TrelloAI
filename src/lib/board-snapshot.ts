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
  /** Legado no JSONB do board. O chat da Maya por usuário vive em trelloai.maya_chats. */
  mayaLogs?: Record<string, MayaDayLog>;
  activities: Record<string, KanbanActivity>;
  requirements: Record<string, Requirement>;
  calendarEvents: Record<string, TeamCalendarEvent>;
  updatedAt: string;
};

/** O chat pessoal da Maya não viaja no snapshot compartilhado. */
export function withoutSharedMayaLogs(snapshot: BoardSnapshot): BoardSnapshot {
  return { ...snapshot, mayaLogs: {} };
}

export function withPreservedMayaLogs(
  incoming: BoardSnapshot,
  existing: BoardSnapshot | null | undefined,
): BoardSnapshot {
  return { ...incoming, mayaLogs: existing?.mayaLogs };
}

