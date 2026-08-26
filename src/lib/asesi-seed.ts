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
import type { BoardSnapshot } from "./board-snapshot";
import { ASESI_BOARD_ID, ASESI_LIST_IDS, ASESI_TEAM_ID, CGE_BOARD_ID, CGE_LIST_IDS, MAYA_RISKS_LIST_KEY, MAYA_RISKS_LIST_TITLE } from "./constants";
import { calendarDayKey, shiftCalendarDay } from "./calendar-report";
import { withRequirementPrompts } from "./requirement-prompts";

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

  const today = calendarDayKey();
  const reqProcessos = nanoid();
  const reqKpis = nanoid();
  const reqPiloto = nanoid();

  const cards: Record<string, Card> = {};
  const seedCards: Omit<Card, "id" | "createdAt" | "updatedAt" | "comments" | "archived">[] = [
    {
      listId: ASESI_LIST_IDS.backlog,
      title: "Mapear processos críticos da ASESI",
      description: "Identificar fluxos prioritários para auditoria e controle.",
      labels: [{ id: nanoid(), name: "planejamento", color: "teal" }],
      dueDate: shiftCalendarDay(today, 2),
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
      title: "Validar o Jangada com a equipe",
      description: "Convites, cadastro e uso diário do gestor virtual Maya.",
      labels: [{ id: nanoid(), name: "validação", color: "amber" }],
      dueDate: today,
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
      dueDate: shiftCalendarDay(today, 4),
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
    [ASESI_LIST_IDS.risks]: [],
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
    [ASESI_LIST_IDS.risks]: {
      id: ASESI_LIST_IDS.risks,
      boardId: ASESI_BOARD_ID,
      title: MAYA_RISKS_LIST_TITLE,
          cardIds: cardIdsByList[ASESI_LIST_IDS.risks],
      systemKey: MAYA_RISKS_LIST_KEY,
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
    title: "ASESI",
    description:
      "Kanban do time ASESI (Assessoria de Sistemas e Inteligência), ligado à organização CGE. Projetos da carteira ficam em boards filhos.",
    executiveSummary:
      "ASESI — resumo executivo\n\nCarteira do time de sistemas e inteligência da CGE. Prioridade: mapear processos críticos, fechar o piloto do Jangada com a equipe e deixar indicadores de acompanhamento mensuráveis.\n\nAtenção da liderança: validação do kanban (convites e daily Maya) e preparação da migração para o ambiente CGE.",
    listIds: [
      ASESI_LIST_IDS.backlog,
      ASESI_LIST_IDS.doing,
      ASESI_LIST_IDS.review,
      ASESI_LIST_IDS.done,
      ASESI_LIST_IDS.risks,
    ],
    memberIds: [ownerId],
    teamId: ASESI_TEAM_ID,
    level: "team",
    parentBoardId: CGE_BOARD_ID,
    backgroundId: "trello",
    designId: "soft",
    gitRepos: [],
    whatsappGroups: [
      {
        id: "wa-asesi",
        name: "Grupo WhatsApp ASESI",
        inviteUrl: null,
        jid: "120363430202949653@g.us",
        notes: "Fonte principal da carteira ASESI.",
        addedAt: now,
        updatedAt: now,
      },
    ],
    riskReport: null,
    createdAt: now,
    updatedAt: now,
  };

  const manager: VirtualManager = {
    boardId: ASESI_BOARD_ID,
    name: "Maya",
    persona:
      "Gestora virtual da ASESI: analisa riscos, compara o Git com o que está no kanban, conduz dailies e atualiza cards.",
    enabled: true,
    autoStartDaily: false,
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
      title: "Piloto Jangada + Maya",
      description: "Validação do kanban com convites, dailies e uso pela equipe.",
      status: "in_progress",
      priority: "high",
      ownerId,
      dueDate: shiftCalendarDay(calendarDayKey(), 10),
      createdAt: now,
      updatedAt: now,
    },
  };

  for (const [id, req] of Object.entries(requirements)) {
    requirements[id] = withRequirementPrompts(req, "ASESI — Gestão de Projetos");
  }

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

export function createAsesiBoardSnapshot(
  owner?: Parameters<typeof createAsesiBoardSeed>[0],
): BoardSnapshot {
  const seed = createAsesiBoardSeed(owner);
  return {
    board: seed.board,
    lists: seed.lists,
    cards: seed.cards,
    members: seed.members,
    teams: { [seed.team.id]: seed.team },
    meetings: {},
    managers: { [seed.board.id]: seed.manager },
    standups: {},
    mayaLogs: {},
    activities: {},
    requirements: seed.requirements,
    calendarEvents: seed.calendarEvents,
    updatedAt: new Date().toISOString(),
  };
}

export function createCgeBoardSeed(owner?: {
  id?: string;
  name: string;
  email: string;
  image?: string | null;
}) {
  const asesi = createAsesiBoardSeed(owner);
  const now = new Date().toISOString();
  const ownerId = asesi.ownerId;

  const lists: Record<string, List> = {
    [CGE_LIST_IDS.backlog]: {
      id: CGE_LIST_IDS.backlog,
      boardId: CGE_BOARD_ID,
      title: "A fazer",
      cardIds: [],
    },
    [CGE_LIST_IDS.doing]: {
      id: CGE_LIST_IDS.doing,
      boardId: CGE_BOARD_ID,
      title: "Em progresso",
      cardIds: [],
    },
    [CGE_LIST_IDS.done]: {
      id: CGE_LIST_IDS.done,
      boardId: CGE_BOARD_ID,
      title: "Concluído",
      cardIds: [],
    },
    [CGE_LIST_IDS.risks]: {
      id: CGE_LIST_IDS.risks,
      boardId: CGE_BOARD_ID,
      title: MAYA_RISKS_LIST_TITLE,
      cardIds: [],
      systemKey: MAYA_RISKS_LIST_KEY,
    },
  };

  const board: Board = {
    id: CGE_BOARD_ID,
    title: "CGE",
    description:
      "Organização Controladoria e Ouvidoria Geral do Estado do Ceará. O time ASESI e os projetos ficam em boards abaixo deste.",
    executiveSummary:
      "CGE — resumo executivo\n\nVisão da organização: Controladoria e Ouvidoria Geral do Estado do Ceará. Os times e projetos (a partir da ASESI) ficam em boards abaixo desta carteira.\n\nUso: acompanhar andamento consolidado, riscos e pendências sem entrar em cada kanban operacional.",
    listIds: [
      CGE_LIST_IDS.backlog,
      CGE_LIST_IDS.doing,
      CGE_LIST_IDS.done,
      CGE_LIST_IDS.risks,
    ],
    memberIds: [ownerId],
    teamId: ASESI_TEAM_ID,
    level: "organization",
    parentBoardId: null,
    backgroundId: "ocean",
    designId: "soft",
    gitRepos: [],
    whatsappGroups: [],
    riskReport: null,
    createdAt: now,
    updatedAt: now,
  };

  const manager: VirtualManager = {
    boardId: CGE_BOARD_ID,
    name: "Maya",
    persona:
      "Gestora virtual da CGE: visão da organização, riscos e acompanhamento dos times.",
    enabled: true,
    autoStartDaily: false,
    dailyTime: "09:00",
    lastStandupDate: null,
    createdAt: now,
    updatedAt: now,
  };

  return { board, lists, members: asesi.members, team: asesi.team, manager, ownerId };
}

export function createCgeBoardSnapshot(
  owner?: Parameters<typeof createCgeBoardSeed>[0],
): BoardSnapshot {
  const seed = createCgeBoardSeed(owner);
  return {
    board: seed.board,
    lists: seed.lists,
    cards: {},
    members: seed.members,
    teams: { [seed.team.id]: seed.team },
    meetings: {},
    managers: { [seed.board.id]: seed.manager },
    standups: {},
    mayaLogs: {},
    activities: {},
    requirements: {},
    calendarEvents: {},
    updatedAt: new Date().toISOString(),
  };
}

export function createOfficialHierarchySnapshots(
  owner?: Parameters<typeof createAsesiBoardSeed>[0],
): BoardSnapshot[] {
  return [createCgeBoardSnapshot(owner), createAsesiBoardSnapshot(owner)];
}
