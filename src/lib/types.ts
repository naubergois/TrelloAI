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
  | { type: "create_cards"; listId?: string; cards: { title: string; description?: string; priority?: Card["priority"] }[] }
  | { type: "suggest_priorities"; updates: { cardId: string; priority: NonNullable<Card["priority"]> }[] }
  | { type: "none" };
