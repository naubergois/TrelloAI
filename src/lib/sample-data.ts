import { nanoid } from "nanoid";
import type { Board, Card, List, Meeting, TeamMember } from "./types";

function slugify(input: string) {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "sala";
}

export function buildMeetingRoomSlug(boardTitle: string, meetingId: string) {
  return `TrelloAI-${slugify(boardTitle)}-${meetingId}`;
}

export function createSampleWorkspace() {
  const boardId = nanoid();
  const todoId = nanoid();
  const doingId = nanoid();
  const doneId = nanoid();

  const now = new Date().toISOString();
  const inOneHour = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  const youId = nanoid();
  const anaId = nanoid();
  const leoId = nanoid();

  const members: Record<string, TeamMember> = {
    [youId]: {
      id: youId,
      name: "Você",
      email: "voce@trelloai.local",
      role: "owner",
      color: "teal",
      createdAt: now,
    },
    [anaId]: {
      id: anaId,
      name: "Ana Costa",
      email: "ana@equipe.local",
      role: "member",
      color: "amber",
      createdAt: now,
    },
    [leoId]: {
      id: leoId,
      name: "Leo Martins",
      email: "leo@equipe.local",
      role: "member",
      color: "sky",
      createdAt: now,
    },
  };

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
    description: "Primeiro board com kanban, IA e reuniões virtuais da equipe.",
    listIds: [todoId, doingId, doneId],
    memberIds: [youId, anaId, leoId],
    createdAt: now,
    updatedAt: now,
  };

  const meetingId = nanoid();
  const meetings: Record<string, Meeting> = {
    [meetingId]: {
      id: meetingId,
      boardId,
      title: "Daily da equipe",
      roomSlug: buildMeetingRoomSlug(board.title, meetingId),
      status: "scheduled",
      scheduledAt: inOneHour,
      participantIds: [youId, anaId, leoId],
      createdById: youId,
      createdAt: now,
      updatedAt: now,
    },
  };

  return {
    boards: { [boardId]: board } as Record<string, Board>,
    lists,
    cards,
    members,
    meetings,
    currentUserId: youId,
    activeBoardId: boardId,
    activeMeetingId: null as string | null,
  };
}
