import { nanoid } from "nanoid";
import type { Board, Card, List } from "./types";

export function createSampleWorkspace() {
  const boardId = nanoid();
  const todoId = nanoid();
  const doingId = nanoid();
  const doneId = nanoid();

  const now = new Date().toISOString();

  const cards: Record<string, Card> = {};
  const seedCards: Omit<Card, "id" | "createdAt" | "updatedAt">[] = [
    {
      listId: todoId,
      title: "Definir visão do produto",
      description: "Uma frase clara sobre o que o TrelloAI resolve.",
      labels: [{ id: nanoid(), name: "produto", color: "teal" }],
      dueDate: null,
      priority: "high",
    },
    {
      listId: todoId,
      title: "Mapear fluxos do board",
      description: "Criar, mover e editar cards com drag-and-drop.",
      labels: [{ id: nanoid(), name: "ux", color: "sky" }],
      dueDate: null,
      priority: "medium",
    },
    {
      listId: doingId,
      title: "Integrar assistente de IA",
      description: "Gerar cards a partir de texto e sugerir prioridades.",
      labels: [{ id: nanoid(), name: "ia", color: "violet" }],
      dueDate: null,
      priority: "high",
    },
    {
      listId: doneId,
      title: "Scaffold Next.js",
      description: "App Router, TypeScript e Tailwind prontos.",
      labels: [{ id: nanoid(), name: "dev", color: "lime" }],
      dueDate: null,
      priority: "low",
    },
  ];

  const cardIdsByList: Record<string, string[]> = {
    [todoId]: [],
    [doingId]: [],
    [doneId]: [],
  };

  for (const seed of seedCards) {
    const id = nanoid();
    cards[id] = { ...seed, id, createdAt: now, updatedAt: now };
    cardIdsByList[seed.listId].push(id);
  }

  const lists: Record<string, List> = {
    [todoId]: {
      id: todoId,
      boardId,
      title: "A fazer",
      cardIds: cardIdsByList[todoId],
    },
    [doingId]: {
      id: doingId,
      boardId,
      title: "Em progresso",
      cardIds: cardIdsByList[doingId],
    },
    [doneId]: {
      id: doneId,
      boardId,
      title: "Concluído",
      cardIds: cardIdsByList[doneId],
    },
  };

  const board: Board = {
    id: boardId,
    title: "TrelloAI — MVP",
    description: "Primeiro board com kanban e assistente de IA.",
    listIds: [todoId, doingId, doneId],
    createdAt: now,
    updatedAt: now,
  };

  return {
    boards: { [boardId]: board } as Record<string, Board>,
    lists,
    cards,
    activeBoardId: boardId,
  };
}
