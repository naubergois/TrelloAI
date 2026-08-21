import { nanoid } from "nanoid";
import type {
  Board,
  Card,
  List,
  Requirement,
  Team,
  TeamCalendarEvent,
  TeamMember,
  VirtualManager,
} from "./types";
import { ASESI_BOARD_ID, ASESI_LIST_IDS, ASESI_TEAM_ID } from "./constants";
import { calendarDayKey, shiftCalendarDay } from "./calendar-report";

/** Seed do board ASESI (id estável para convites e sync). */
export function createAsesiBoardSeed(owner?: {
  id?: string;
  name: string;
  email: string;
  image?: string | null;
}) {
  const now = new Date().toISOString();
  const ownerId = owner?.id || nanoid();

  const members: Record<string, TeamMember> = {
    [ownerId]: {
      id: ownerId,
      name: owner?.name || "Coordenação ASESI",
      email: owner?.email || "asesi@cge.local",
      role: "owner",
      color: "teal",
      image: owner?.image ?? null,
      createdAt: now,
    },
  };

  const reqProcessos = nanoid();
  const reqKpis = nanoid();
  const reqPiloto = nanoid();

  const cards: Record<string, Card> = {};
  const seedCards: Omit<Card, "id" | "createdAt" | "updatedAt">[] = [
    {
      listId: ASESI_LIST_IDS.backlog,
      title: "Mapear processos críticos da ASESI",
      description: "Identificar fluxos prioritários para auditoria e controle.",
      labels: [{ id: nanoid(), name: "planejamento", color: "teal" }],
      dueDate: null,
      priority: "high",
      assigneeId: ownerId,
      requirementId: reqProcessos,
      acceptanceCriteria: "Mapa de processos priorizados e validado com a coordenação.",
      checklist: [
        { id: nanoid(), text: "Listar sistemas", done: false },
        { id: nanoid(), text: "Classificar criticidade", done: false },
      ],
    },
    {
      listId: ASESI_LIST_IDS.backlog,
      title: "Definir indicadores de acompanhamento",
      description: "KPIs mensais de entregas, riscos e pendências.",
      labels: [{ id: nanoid(), name: "gestão", color: "violet" }],
      dueDate: null,
      priority: "medium",
      assigneeId: null,
      requirementId: reqKpis,
      acceptanceCriteria: "",
      checklist: [],
    },
    {
      listId: ASESI_LIST_IDS.doing,
      title: "Validar TrelloAI com a equipe",
      description: "Convites, cadastro e uso diário do gestor virtual Maya.",
      labels: [{ id: nanoid(), name: "validação", color: "amber" }],
      dueDate: null,
      priority: "high",
      assigneeId: ownerId,
      requirementId: reqPiloto,
      acceptanceCriteria: "Equipe convidada e pelo menos uma daily concluída.",
      checklist: [],
    },
    {
      listId: ASESI_LIST_IDS.review,
      title: "Preparar migração para ambiente CGE",
      description: "Checklist de infraestrutura, auth e dados antes do go-live.",
      labels: [{ id: nanoid(), name: "infra", color: "sky" }],
      dueDate: null,
      priority: "medium",
      assigneeId: null,
      requirementId: null,
      acceptanceCriteria: "",
      checklist: [],
    },
    {
      listId: ASESI_LIST_IDS.done,
      title: "Publicar versão piloto na AWS",
      description: "App Runner com login e-mail/senha disponível para testes.",
      labels: [{ id: nanoid(), name: "entrega", color: "lime" }],
      dueDate: null,
      priority: "low",
      assigneeId: ownerId,
      requirementId: reqPiloto,
      acceptanceCriteria: "",
      checklist: [],
    },
  ];

  const cardIdsByList: Record<string, string[]> = {
    [ASESI_LIST_IDS.backlog]: [],
    [ASESI_LIST_IDS.doing]: [],
    [ASESI_LIST_IDS.review]: [],
    [ASESI_LIST_IDS.done]: [],
  };

  for (const seed of seedCards) {
    const id = nanoid();
    cards[id] = { ...seed, id, createdAt: now, updatedAt: now };
    cardIdsByList[seed.listId].push(id);
  }

  const lists: Record<string, List> = {
    [ASESI_LIST_IDS.backlog]: {
      id: ASESI_LIST_IDS.backlog,
      boardId: ASESI_BOARD_ID,
      title: "Backlog",
      cardIds: cardIdsByList[ASESI_LIST_IDS.backlog],
    },
    [ASESI_LIST_IDS.doing]: {
      id: ASESI_LIST_IDS.doing,
      boardId: ASESI_BOARD_ID,
      title: "Em andamento",
      cardIds: cardIdsByList[ASESI_LIST_IDS.doing],
    },
    [ASESI_LIST_IDS.review]: {
      id: ASESI_LIST_IDS.review,
      boardId: ASESI_BOARD_ID,
      title: "Em revisão",
      cardIds: cardIdsByList[ASESI_LIST_IDS.review],
    },
    [ASESI_LIST_IDS.done]: {
      id: ASESI_LIST_IDS.done,
      boardId: ASESI_BOARD_ID,
      title: "Concluído",
      cardIds: cardIdsByList[ASESI_LIST_IDS.done],
    },
  };

  const team: Team = {
    id: ASESI_TEAM_ID,
    name: "Equipe ASESI",
    description: "Assessoria de Sistemas e Inteligência — CGE",
    memberIds: [ownerId],
    color: "teal",
    createdAt: now,
    updatedAt: now,
  };

  const board: Board = {
    id: ASESI_BOARD_ID,
    title: "ASESI — Gestão de Projetos",
    description:
      "Kanban da ASESI com Maya (gestora virtual): dailies, prioridades, atribuições e convites da equipe.",
    listIds: [
      ASESI_LIST_IDS.backlog,
      ASESI_LIST_IDS.doing,
      ASESI_LIST_IDS.review,
      ASESI_LIST_IDS.done,
    ],
    memberIds: [ownerId],
    teamId: ASESI_TEAM_ID,
    backgroundId: "ocean",
    designId: "soft",
    createdAt: now,
    updatedAt: now,
  };

  const manager: VirtualManager = {
    boardId: ASESI_BOARD_ID,
    name: "Maya",
    persona:
      "Gestora virtual da ASESI: conduz dailies, cria e move cards, atribui responsáveis, remove bloqueios e mantém o projeto alinhado à CGE.",
    enabled: true,
    dailyTime: "09:00",
    lastStandupDate: null,
    createdAt: now,
    updatedAt: now,
  };

  const requirements: Record<string, Requirement> = {
    [reqProcessos]: {
      id: reqProcessos,
      boardId: ASESI_BOARD_ID,
      code: "ASESI-R01",
      title: "Mapeamento de processos críticos",
      description: "Inventário e priorização dos fluxos da ASESI para auditoria e controle.",
      status: "in_progress",
      priority: "high",
      ownerId,
      dueDate: shiftCalendarDay(calendarDayKey(), 21),
      createdAt: now,
      updatedAt: now,
    },
    [reqKpis]: {
      id: reqKpis,
      boardId: ASESI_BOARD_ID,
      code: "ASESI-R02",
      title: "Indicadores de acompanhamento",
      description: "KPIs mensais de entregas, riscos e pendências.",
      status: "approved",
      priority: "medium",
      ownerId,
      dueDate: shiftCalendarDay(calendarDayKey(), 30),
      createdAt: now,
      updatedAt: now,
    },
    [reqPiloto]: {
      id: reqPiloto,
      boardId: ASESI_BOARD_ID,
      code: "ASESI-R03",
      title: "Piloto TrelloAI + Maya",
      description: "Validação do kanban com convites, dailies e uso pela equipe.",
      status: "in_progress",
      priority: "high",
      ownerId,
      dueDate: shiftCalendarDay(calendarDayKey(), 10),
      createdAt: now,
      updatedAt: now,
    },
  };

  const evDaily = nanoid();
  const evReview = nanoid();
  const calendarEvents: Record<string, TeamCalendarEvent> = {
    [evDaily]: {
      id: evDaily,
      boardId: ASESI_BOARD_ID,
      teamId: ASESI_TEAM_ID,
      title: "Daily ASESI",
      description: "Standup com Maya",
      kind: "meeting",
      date: calendarDayKey(),
      time: "09:00",
      memberIds: [ownerId],
      createdAt: now,
      updatedAt: now,
    },
    [evReview]: {
      id: evReview,
      boardId: ASESI_BOARD_ID,
      teamId: ASESI_TEAM_ID,
      title: "Revisão de requisitos",
      description: "Alinhar status de ASESI-R01 a R03",
      kind: "review",
      date: shiftCalendarDay(calendarDayKey(), 3),
      time: "14:00",
      memberIds: [ownerId],
      createdAt: now,
      updatedAt: now,
    },
  };

  return {
    board,
    lists,
    cards,
    members,
    team,
    manager,
    requirements,
    calendarEvents,
    ownerId,
  };
}
