export type LabelColor =
  | "teal"
  | "amber"
  | "rose"
  | "sky"
  | "lime"
  | "violet";

export interface Label {
  id: string;
  name: string;
  color: LabelColor;
}

export interface Card {
  id: string;
  listId: string;
  title: string;
  description: string;
  labels: Label[];
  dueDate: string | null;
  priority: "low" | "medium" | "high" | null;
  /** Membro responsável (TeamMember.id) */
  assigneeId: string | null;
  /** Requisito vinculado (opcional) */
  requirementId: string | null;
  /** Critérios de aceite / notas de validação */
  acceptanceCriteria: string;
  /** Checklist simples */
  checklist: ChecklistItem[];
  createdAt: string;
  updatedAt: string;
}

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export type RequirementStatus = "draft" | "approved" | "in_progress" | "done" | "rejected";

export interface Requirement {
  id: string;
  boardId: string;
  code: string;
  title: string;
  description: string;
  status: RequirementStatus;
  priority: "low" | "medium" | "high";
  ownerId: string | null;
  dueDate: string | null;
  /** Prompt para implementação spec-based / SDD */
  specPrompt?: string;
  /** Prompt para plano de testes (Gherkin + automação) */
  testPrompt?: string;
  /** Payload JSON para ferramentas MCP (software_planning, handoff, etc.) */
  mcpPayload?: string;
  /** Objetivo compacto para colaboração A2A */
  a2aObjective?: string;
  promptsGeneratedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type TeamEventKind = "meeting" | "deadline" | "milestone" | "review" | "other";

export interface TeamCalendarEvent {
  id: string;
  boardId: string;
  teamId: string | null;
  title: string;
  description: string;
  kind: TeamEventKind;
  /** Dia YYYY-MM-DD */
  date: string;
  /** HH:mm opcional */
  time: string | null;
  memberIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface List {
  id: string;
  boardId: string;
  title: string;
  cardIds: string[];
}

export interface Board {
  id: string;
  title: string;
  description: string;
  listIds: string[];
  memberIds: string[];
  /** Equipe atribuída a este kanban (opcional) */
  teamId: string | null;
  /** Fundo visual do board */
  backgroundId: string;
  /** Estilo de listas/cards */
  designId: string;
  createdAt: string;
  updatedAt: string;
}

export type TeamRole = "owner" | "member";

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: TeamRole;
  color: LabelColor;
  image?: string | null;
  googleId?: string | null;
  createdAt: string;
}

export interface Team {
  id: string;
  name: string;
  description: string;
  memberIds: string[];
  color: LabelColor;
  createdAt: string;
  updatedAt: string;
}

export type MeetingStatus = "scheduled" | "live" | "ended";

export interface Meeting {
  id: string;
  boardId: string;
  title: string;
  roomSlug: string;
  status: MeetingStatus;
  scheduledAt: string | null;
  participantIds: string[];
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface AiMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export type AiAction =
  | {
      type: "create_cards";
      listId?: string;
      cards: {
        title: string;
        description?: string;
        priority?: Card["priority"];
        assigneeId?: string | null;
        dueDate?: string | null;
      }[];
    }
  | { type: "suggest_priorities"; updates: { cardId: string; priority: NonNullable<Card["priority"]> }[] }
  | {
      type: "update_cards";
      updates: {
        cardId: string;
        title?: string;
        description?: string;
        priority?: Card["priority"];
        moveToListId?: string;
        assigneeId?: string | null;
        dueDate?: string | null;
      }[];
    }
  | { type: "create_lists"; titles: string[] }
  | {
      type: "assign_cards";
      assignments: { cardId: string; assigneeId: string | null }[];
    }
  | { type: "none" };

export interface KanbanActivity {
  id: string;
  boardId: string;
  memberId: string;
  /** Dia do calendário YYYY-MM-DD (local) */
  date: string;
  kind: "card_create" | "card_update" | "card_move" | "card_delete" | "standup_reply";
  cardId?: string;
  note?: string;
  createdAt: string;
}

export interface DayUpdateReport {
  date: string;
  boardId: string;
  updatedMemberIds: string[];
  missingMemberIds: string[];
  activityCount: number;
}

export interface VirtualManager {
  boardId: string;
  name: string;
  persona: string;
  enabled: boolean;
  /** Horário local HH:mm para a daily automática */
  dailyTime: string;
  lastStandupDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export type StandupStatus = "open" | "processing" | "closed";

export interface StandupCheckIn {
  memberId: string;
  yesterday: string;
  today: string;
  blockers: string;
  submittedAt: string | null;
}

export interface StandupChatMessage {
  id: string;
  role: "manager" | "member";
  memberId: string | null;
  content: string;
  createdAt: string;
}

export interface StandupSession {
  id: string;
  boardId: string;
  date: string;
  status: StandupStatus;
  questions: string[];
  checkIns: StandupCheckIn[];
  chat: StandupChatMessage[];
  /** Índice do membro sendo entrevistado */
  currentMemberIndex: number;
  /** Índice da pergunta atual (0 = ontem, 1 = hoje, 2 = bloqueios) */
  currentQuestionIndex: number;
  awaitingReplyFrom: string | null;
  managerSummary: string;
  meetingId: string | null;
  createdAt: string;
  updatedAt: string;
}
