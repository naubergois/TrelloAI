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
