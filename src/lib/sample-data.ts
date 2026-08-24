import { nanoid } from "nanoid";
import type {
  Board,
  Card,
  List,
  Meeting,
  Requirement,
  StandupSession,
  Team,
  TeamCalendarEvent,
  TeamMember,
  VirtualManager,
} from "./types";
import { defaultManagerQuestions } from "./manager";
import { calendarDayKey, shiftCalendarDay } from "./calendar-report";
import { withRequirementPrompts } from "./requirement-prompts";

function slugify(input: string) {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "sala";
}

export function buildMeetingRoomSlug(boardTitle: string, meetingId: string) {
  return `Jangada-${slugify(boardTitle)}-${meetingId}`;
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
      email: "voce@jangada.local",
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
  const seedCards: Omit<Card, "id" | "createdAt" | "updatedAt" | "comments" | "archived">[] = [
    {
      listId: todoId,
      title: "Definir visão do produto",
      description: "Uma frase clara sobre o que o Jangada resolve.",
      labels: [{ id: nanoid(), name: "produto", color: "teal" }],
      dueDate: null,
      priority: "high",
      assigneeId: null,
      requirementId: null,
      acceptanceCriteria: "Visão alinhada com stakeholders e registrada no board.",
      checklist: [],
    },
    {
      listId: todoId,
      title: "Mapear fluxos do board",
      description: "Criar, mover e editar cards com drag-and-drop.",
      labels: [{ id: nanoid(), name: "ux", color: "sky" }],
      dueDate: null,
      priority: "medium",
      assigneeId: null,
      requirementId: null,
      acceptanceCriteria: "",
      checklist: [],
    },
    {
      listId: doingId,
      title: "Integrar assistente de IA",
      description: "Gerar cards a partir de texto e sugerir prioridades.",
      labels: [{ id: nanoid(), name: "ia", color: "violet" }],
      dueDate: null,
      priority: "high",
      assigneeId: null,
      requirementId: null,
      acceptanceCriteria: "Assistente cria cards e sugere prioridades no board demo.",
      checklist: [
        { id: nanoid(), text: "Prompt de criação", done: true },
        { id: nanoid(), text: "Aplicar ações no store", done: false },
      ],
    },
    {
      listId: doneId,
      title: "Scaffold Next.js",
      description: "App Router, TypeScript e Tailwind prontos.",
      labels: [{ id: nanoid(), name: "dev", color: "lime" }],
      dueDate: null,
      priority: "low",
      assigneeId: null,
      requirementId: null,
      acceptanceCriteria: "",
      checklist: [],
    },
  ];

  const cardIdsByList: Record<string, string[]> = {
    [todoId]: [],
    [doingId]: [],
    [doneId]: [],
  };

  for (const seed of seedCards) {
    const id = nanoid();
    cards[id] = {
      ...seed,
      comments: [],
      archived: false,
      id,
      createdAt: now,
      updatedAt: now,
    };
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

  const teamId = nanoid();
  const team: Team = {
    id: teamId,
    name: "Equipe produto",
    description: "Time demo do Jangada",
    memberIds: [youId, anaId, leoId],
    color: "teal",
    createdAt: now,
    updatedAt: now,
  };

  const board: Board = {
    id: boardId,
    title: "Jangada — ASESI",
    description: "Kanban com gestor virtual diário, IA e reuniões da equipe.",
    listIds: [todoId, doingId, doneId],
    memberIds: [youId, anaId, leoId],
    teamId,
    level: "project",
    parentBoardId: null,
    backgroundId: "ceara",
    designId: "classic",
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

  const managers: Record<string, VirtualManager> = {
    [boardId]: {
      boardId,
      name: "Maya",
      persona:
        "Gestor(a) virtual pragmático(a): pergunta o status de cada projeto, remove bloqueios e mantém o board atualizado.",
      enabled: true,
      autoStartDaily: false,
      dailyTime: "09:30",
      lastStandupDate: null,
      createdAt: now,
      updatedAt: now,
    },
  };

  const standups: Record<string, StandupSession> = {};

  const reqId1 = nanoid();
  const reqId2 = nanoid();
  const requirements: Record<string, Requirement> = {
    [reqId1]: {
      id: reqId1,
      boardId,
      code: "REQ-01",
      title: "Kanban colaborativo com IA",
      description: "Board com listas, cards, drag-and-drop e assistente para gerar tarefas.",
      status: "in_progress",
      priority: "high",
      ownerId: youId,
      dueDate: shiftCalendarDay(calendarDayKey(), 14),
      createdAt: now,
      updatedAt: now,
    },
    [reqId2]: {
      id: reqId2,
      boardId,
      code: "REQ-02",
      title: "Daily com gestor virtual",
      description: "Maya conduz standup e atualiza o kanban com base nas respostas.",
      status: "approved",
      priority: "medium",
      ownerId: anaId,
      dueDate: shiftCalendarDay(calendarDayKey(), 7),
      createdAt: now,
      updatedAt: now,
    },
  };

  for (const [id, req] of Object.entries(requirements)) {
    requirements[id] = withRequirementPrompts(req, "Jangada — ASESI");
  }

  // link first card to REQ-01 after creation loop — patch below
  for (const [id, card] of Object.entries(cards)) {
    if (card.title.includes("visão")) {
      cards[id] = { ...card, requirementId: reqId1 };
      break;
    }
  }

  const ev1 = nanoid();
  const ev2 = nanoid();
  const calendarEvents: Record<string, TeamCalendarEvent> = {
    [ev1]: {
      id: ev1,
      boardId,
      teamId,
      title: "Daily da equipe",
      description: "Standup com Maya",
      kind: "meeting",
      date: calendarDayKey(),
      time: "09:30",
      memberIds: [youId, anaId, leoId],
      createdAt: now,
      updatedAt: now,
    },
    [ev2]: {
      id: ev2,
      boardId,
      teamId,
      title: "Demo MVP",
      description: "Apresentação do piloto",
      kind: "milestone",
      date: shiftCalendarDay(calendarDayKey(), 5),
      time: "15:00",
      memberIds: [youId, anaId],
      createdAt: now,
      updatedAt: now,
    },
  };

  return {
    boards: { [boardId]: board } as Record<string, Board>,
    lists,
    cards,
    members,
    teams: { [teamId]: team } as Record<string, Team>,
    meetings,
    managers,
    standups,
    requirements,
    calendarEvents,
    activities: {},
    currentUserId: youId,
    activeBoardId: boardId,
    activeMeetingId: null as string | null,
    activeStandupId: null as string | null,
  };
}

export { defaultManagerQuestions };
