#!/usr/bin/env node
/**
 * Apaga os boards atuais e recria:
 *   CGE (organização) → ASESI (time) → um board de projeto por item
 *   da carteira (grupo WhatsApp ASESI + quadro Trello ASESI).
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv(file) {
  const envPath = path.join(root, file);
  if (!fs.existsSync(envPath)) return;
  for (const raw of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const eq = line.indexOf("=");
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

loadEnv(".env.local");
loadEnv(".env");

const CGE_ID = "cge";
const ASESI_ID = "asesi";
const TEAM_ID = "asesi-team";
const MAYA_KEY = "maya-risks";
const MAYA_TITLE = "Riscos Maya";
const TRELLO_URL = "https://trello.com/b/Rl7Cb3rj/asesi";
const WA_ASESI = "Grupo WhatsApp ASESI (120363430202949653@g.us)";
const WA_ASESI_JID = "120363430202949653@g.us";

function waGroup({ name, jid, notes }) {
  const ts = nowIso();
  return {
    id: nid("wa-"),
    name,
    inviteUrl: null,
    jid: jid || null,
    notes: notes || undefined,
    addedAt: ts,
    updatedAt: ts,
  };
}

function nowIso() {
  return new Date().toISOString();
}

function nid(prefix = "") {
  return `${prefix}${crypto.randomBytes(6).toString("hex")}`;
}

function label(name, color) {
  return { id: nid("lbl-"), name, color };
}

function card({ listId, title, description = "", priority = "medium", dueDate = null, labels = [], origin = "whatsapp+trello" }) {
  const ts = nowIso();
  return {
    id: nid("crd-"),
    listId,
    title,
    description,
    labels,
    coverColor: null,
    origin: null,
    originKey: null,
    dueDate,
    priority,
    assigneeId: null,
    requirementId: null,
    acceptanceCriteria: "",
    checklist: [],
    comments: [
      {
        id: nid("cmt-"),
        authorId: null,
        body: `Fonte: ${origin}. Trello: ${TRELLO_URL}. ${WA_ASESI}.`,
        createdAt: ts,
      },
    ],
    archived: false,
    createdAt: ts,
    updatedAt: ts,
  };
}

function emptySnapshot({
  id,
  title,
  description,
  level,
  parentBoardId,
  backgroundId,
  owner,
  team,
  gitRepos = [],
  whatsappGroups = [],
  listTitles,
  seedCards = {},
}) {
  const ts = nowIso();
  const lists = {};
  const cards = {};
  const listIds = [];

  for (const spec of listTitles) {
    const listId = `${id}-list-${spec.key}`;
    const seeded = (seedCards[spec.key] || []).map((c) =>
      card({ ...c, listId, origin: c.origin || `${title}` }),
    );
    for (const c of seeded) cards[c.id] = c;
    lists[listId] = {
      id: listId,
      boardId: id,
      title: spec.title,
      cardIds: seeded.map((c) => c.id),
      ...(spec.systemKey ? { systemKey: spec.systemKey } : {}),
    };
    listIds.push(listId);
  }

  const board = {
    id,
    title,
    description,
    listIds,
    memberIds: [owner.id],
    teamId: team.id,
    level,
    parentBoardId,
    backgroundId,
    designId: "soft",
    cardThemeId: "white",
    backgroundImageUrl: null,
    backgroundTint: 28,
    gitRepos,
    whatsappGroups,
    riskReport: null,
    createdAt: ts,
    updatedAt: ts,
  };

  return {
    board,
    lists,
    cards,
    members: { [owner.id]: owner },
    teams: { [team.id]: team },
    meetings: {},
    managers: {
      [id]: {
        boardId: id,
        name: "Maya",
        persona:
          "Gestora virtual: analisa riscos, compara o Git com o kanban e atualiza cards.",
        enabled: true,
        autoStartDaily: false,
        dailyTime: "09:00",
        lastStandupDate: null,
        createdAt: ts,
        updatedAt: ts,
      },
    },
    standups: {},
    activities: {},
    requirements: {},
    calendarEvents: {},
    updatedAt: ts,
  };
}

const KANBAN = [
  { key: "todo", title: "A fazer" },
  { key: "doing", title: "Em progresso" },
  { key: "blocked", title: "Bloqueado" },
  { key: "done", title: "Concluído" },
  { key: "risks", title: MAYA_TITLE, systemKey: MAYA_KEY },
];

const PROJECTS = [
  {
    id: "proj-mandacaru",
    title: "Mandacaru",
    backgroundId: "trello-gold",
    description:
      "Produto Mandacaru (acórdãos / irregularidades). Demandas da Ana e do Berg no grupo ASESI e no Trello (25/08).",
    cards: {
      todo: [
        {
          title: 'Vincular coluna "tipo" ao número do acórdão',
          description: "Cada item da coluna tipo deve indicar o nº do acórdão. Card Trello: https://trello.com/c/mlzN8Iig",
          priority: "high",
          labels: [label("mandacaru", "amber")],
        },
        {
          title: "Visão consolidada: temas com mais irregularidade",
          description: "Ler nas determinações. Card Trello: https://trello.com/c/sVmKJ2ZO",
          priority: "high",
          labels: [label("mandacaru", "amber")],
        },
        {
          title: "Temas que mais geraram multas aos gestores",
          description: "Ler nas determinações. Card Trello: https://trello.com/c/WiF57CkF",
          priority: "high",
          labels: [label("mandacaru", "amber")],
        },
        {
          title: "Integrar aba de estudo na aba de acórdãos",
          description: "Estudos a partir do resultado da aba de acórdãos. Card Trello: https://trello.com/c/eBCTdYI0",
          priority: "medium",
          labels: [label("mandacaru", "amber")],
        },
        {
          title: 'Mover "+categoria raiz" para ao lado de "Importar de outro estudo"',
          description: "Ajuste de UX pedido após reunião. Card Trello: https://trello.com/c/WZzZCwam",
          priority: "medium",
          labels: [label("mandacaru", "amber")],
        },
        {
          title: "Alinhar internamente com o Berg antes de mostrar à área-fim",
          description: "Passar o produto mais fechado. Pedido da Ana no grupo ASESI em 25/08.",
          priority: "high",
          labels: [label("alinhamento", "violet")],
        },
      ],
    },
  },
  {
    id: "proj-similaridade",
    title: "Similaridade",
    backgroundId: "lagoon",
    description:
      "Agrupamento de denúncias (chamado 203528). TF-IDF vs sentence-transformers. Grupo ASESI + Trello.",
    gitRepos: [
      {
        id: nid("git-"),
        url: "https://git.cge.ce.gov.br/lucas.pimentel/analise_similaridade_dev",
        label: "analise_similaridade_dev",
        addedAt: nowIso(),
      },
    ],
    cards: {
      doing: [
        {
          title: "Testar sentence-transformers + HDBSCAN (outliers 37,6% → 17,6%)",
          description:
            "Berg: só denúncias (não o corpus inteiro). TF-IDF gera colunas zeradas e falsos similares. Reunião com a COUVI.",
          priority: "high",
          labels: [label("ml", "teal")],
        },
      ],
      todo: [
        {
          title: "Botão de avaliação do cluster na aplicação da COUVI",
          description:
            "Avaliar se o grupo atende a expectativa. Outliers 4–6 denúncias precisam reentrar no reprocessamento.",
          priority: "medium",
          labels: [label("produto", "sky")],
        },
      ],
    },
  },
  {
    id: "proj-avia",
    title: "AVIA Chatbot",
    backgroundId: "aurora",
    description: "Chatbot AVIA. Validado no Trello ASESI (25/08). Escopo, anonimização e consultas dinâmicas.",
    cards: {
      done: [
        {
          title: "Chatbot AVIA validado",
          description: "Registrado no Trello ASESI em 25/08.",
          priority: "low",
          labels: [label("entrega", "lime")],
        },
      ],
      todo: [
        {
          title: "Backlog ML / consultas dinâmicas / anonimização",
          description: "Itens da lista SKILLS/REQUISITOS do Trello ASESI (21/08).",
          priority: "medium",
          labels: [label("avia", "violet")],
        },
      ],
    },
  },
  {
    id: "proj-cacimba",
    title: "Cacimba",
    backgroundId: "forest",
    description: "Cacimba — chamado 203421 (Leonardo). Em andamento no Trello e no grupo ASESI.",
    cards: {
      doing: [
        {
          title: "Cacimba chamado 203421 (Leonardo)",
          description: "Em andamento no Trello ASESI (25/08). Infra/homolog com o Leo.",
          priority: "high",
          labels: [label("homolog", "sky")],
        },
      ],
    },
  },
  {
    id: "proj-jangada",
    title: "Jangada",
    backgroundId: "ocean",
    description:
      "Kanban interno da ASESI (chamado 203499). Substitui o Trello no dia a dia. Grupo ASESI + Trello.",
    gitRepos: [
      {
        id: nid("git-"),
        url: "http://git.cge.local/g_asesi/jangada.git",
        label: "jangada",
        addedAt: nowIso(),
      },
    ],
    cards: {
      doing: [
        {
          title: "Jangada chamado 203499 (Leonardo) — homolog",
          description:
            "Stack homolog-jangada. Nauber: “hoje nosso novo Trello deve estar no ar”.",
          priority: "high",
          labels: [label("homolog", "sky")],
        },
      ],
      todo: [
        {
          title: "Gestor de projeto virtual (Maya) no ambiente CGE",
          description: "Pedido no Trello (21/08): Leo/ambiente CGE. UECE no radar.",
          priority: "medium",
          labels: [label("maya", "violet")],
        },
      ],
    },
  },
  {
    id: "proj-farol",
    title: "Farol",
    backgroundId: "sunset",
    description:
      "Farol — validação COAUD. Chamado 203454 bloqueado (usuário de banco / URL). Ana agenda com o Carlos; Charles com o Leonardo.",
    cards: {
      doing: [
        {
          title: "Validação COAUD em homolog + melhorias da Ana",
          description: "Ana agenda reunião com o Carlos. Charles alinha com o Leonardo.",
          priority: "high",
          labels: [label("coaud", "amber")],
        },
      ],
      blocked: [
        {
          title: "Farol chamado 203454 — usuário de banco / URL de produção",
          description:
            "Script de produção parado. Usuários de leitura das bases (COTIC/MH) no Trello de 21/08.",
          priority: "high",
          labels: [label("bloqueio", "rose")],
        },
      ],
    },
  },
  {
    id: "proj-portal-asesi",
    title: "Portal ASESI",
    backgroundId: "ceara",
    description: "Portal ASESI em homolog. Citado no Trello (21/08) e no grupo.",
    cards: {
      doing: [
        {
          title: "Portal ASESI em homolog",
          description: "https://homolog-portal-asesi.cge.local/ — lista TEST do Trello em 21/08.",
          priority: "medium",
          labels: [label("homolog", "sky")],
        },
      ],
    },
  },
  {
    id: "proj-sige",
    title: "SIGE Metas",
    backgroundId: "trello-sage",
    description: "Metas 2026 no SIGE. Trello 21/08: aguardando Thiago.",
    cards: {
      doing: [
        {
          title: "Metas 2026 no SIGE — aguardando Thiago",
          description: "Acompanhamento no Trello ASESI e no grupo.",
          priority: "medium",
          labels: [label("sige", "lime")],
        },
      ],
    },
  },
  {
    id: "proj-cge-atende",
    title: "CGE Atende",
    backgroundId: "trello-lilac",
    description: "MCP + API do CGE Atende para abrir chamado via chat (Charles). Trello 21/08.",
    cards: {
      todo: [
        {
          title: "MCP + API do CGE Atende para abrir chamado via chat",
          description: "Responsável no Trello: Charles. Integração com o agente.",
          priority: "medium",
          labels: [label("mcp", "violet")],
        },
      ],
    },
  },
  {
    id: "proj-siafi",
    title: "SIAFI",
    backgroundId: "graphite",
    description: "Acesso aos bancos / SIAFI recusando senha cgedes. Trello 20/08.",
    cards: {
      todo: [
        {
          title: "Confirmar chaves dos bancos com Berg e Leonardo",
          description: "SIAFI recusando senha cgedes — prazo 22/08 no Trello de 20/08.",
          priority: "high",
          labels: [label("infra", "rose")],
        },
      ],
    },
  },
  {
    id: "proj-cotra",
    title: "ASESI COTRA",
    backgroundId: "ember",
    description: "Projeto/área COTRA — grupo WhatsApp ASESI COTRA.",
    waJid: "120363426236844760@g.us",
    cards: {
      todo: [
        {
          title: "Mapear entregas e pendências com a COTRA",
          description: "Board aberto a partir do grupo WhatsApp ASESI COTRA.",
          origin: "WhatsApp ASESI COTRA",
          priority: "medium",
          labels: [label("cotra", "teal")],
        },
      ],
    },
  },
  {
    id: "proj-uece",
    title: "ASESI UECE",
    backgroundId: "grape",
    description:
      "Parceria UECE / gestor virtual. Grupo WhatsApp ASESI UECE. Acordos FUNECE/UECE no Trello (20/08).",
    waJid: "120363427081886840@g.us",
    cards: {
      todo: [
        {
          title: "Confirmar envio ao Marcelo e assinatura — acordos FUNECE/UECE",
          description: "Item do Trello ASESI (20/08).",
          origin: "Trello + WhatsApp ASESI UECE",
          priority: "medium",
          labels: [label("uece", "sky")],
        },
        {
          title: "Gestor de projeto virtual com a UECE",
          description: "Ambiente CGE / Leo. Grupo ASESI UECE.",
          origin: "WhatsApp ASESI UECE",
          priority: "medium",
          labels: [label("uece", "sky")],
        },
      ],
    },
  },
  {
    id: "proj-coaud",
    title: "ASESI COAUD",
    backgroundId: "coral",
    description: "Demandas COAUD (Farol e outras). Grupo WhatsApp ASESI - COAUD.",
    waJid: "120363429129471142@g.us",
    cards: {
      doing: [
        {
          title: "Acompanhar validação do Farol com a COAUD",
          description: "Charles perguntou no grupo ASESI sobre reunião com a área de negócio.",
          origin: "WhatsApp ASESI + ASESI COAUD",
          priority: "high",
          labels: [label("coaud", "amber")],
        },
      ],
    },
  },
  {
    id: "proj-asesi-ti",
    title: "ASESI TI",
    backgroundId: "slate",
    description: "Grupo WhatsApp ASESI TI — demandas de infraestrutura e sistemas.",
    waJid: "120363426923982527@g.us",
    cards: {
      doing: [
        {
          title: "Sala 3 — previsão sexta (Tiago/COAFI)",
          description: "Nauber: deve ficar pronto na sexta. Infra para a ASESI usar o espaço.",
          origin: "WhatsApp ASESI",
          priority: "medium",
          labels: [label("infra", "sky")],
        },
      ],
    },
  },
  {
    id: "proj-usj",
    title: "Colaboração ASESI USJ",
    backgroundId: "sand",
    description: "Grupo WhatsApp Colaboracao ASESI Usj. Acordos USJ/Macau no Trello (20/08).",
    waJid: "120363427770799390@g.us",
    cards: {
      todo: [
        {
          title: "Confirmar envio e assinatura — acordo USJ/Macau",
          description: "Item do Trello ASESI (20/08).",
          origin: "Trello + WhatsApp Colaboracao ASESI Usj",
          priority: "medium",
          labels: [label("usj", "lime")],
        },
      ],
    },
  },
  {
    id: "proj-demandas",
    title: "Gestão de demandas",
    backgroundId: "trello-berry",
    description:
      "Escopo / expectativa de novas demandas. Ana e Charles no grupo ASESI (25/08): carteira de metas primeiro.",
    cards: {
      todo: [
        {
          title: "Alinhar escopo e expectativa antes de aceitar demanda nova",
          description:
            "Ana: termo de compromisso (o que entra / o que não entra). Charles: restrição tripla Escopo-Tempo-Custo.",
          origin: "WhatsApp ASESI",
          priority: "high",
          labels: [label("governança", "violet")],
        },
      ],
    },
  },
];

function buildOwnerAndTeam() {
  const ts = nowIso();
  const owner = {
    id: "asesi-coord",
    name: "Coordenação ASESI",
    email: (process.env.ADMIN_EMAIL || "admin@cge.ce.gov.br").trim().toLowerCase(),
    role: "owner",
    color: "teal",
    image: null,
    createdAt: ts,
  };
  const team = {
    id: TEAM_ID,
    name: "Equipe ASESI",
    description: "Assessoria de Sistemas e Inteligência — CGE",
    memberIds: [owner.id],
    color: "teal",
    createdAt: ts,
    updatedAt: ts,
  };
  return { owner, team };
}

function buildAllSnapshots() {
  const { owner, team } = buildOwnerAndTeam();
  const cge = emptySnapshot({
    id: CGE_ID,
    title: "CGE",
    description:
      "Controladoria e Ouvidoria Geral do Estado do Ceará. Organização. Time ASESI e projetos ficam abaixo.",
    level: "organization",
    parentBoardId: null,
    backgroundId: "ceara",
    owner,
    team,
    listTitles: KANBAN,
    seedCards: {
      doing: [
        {
          title: "Carteira ASESI no Jangada",
          description:
            `Hierarquia CGE → ASESI → projetos, montada a partir do ${WA_ASESI} e do quadro ${TRELLO_URL}.`,
          origin: "Jangada",
          priority: "high",
          labels: [label("organização", "teal")],
        },
      ],
    },
  });

  const asesiCards = {
    doing: PROJECTS.map((p) => ({
      title: p.title,
      description: `Board de projeto: /board/${p.id}\n${p.description}`,
      origin: "Carteira ASESI",
      priority: "medium",
      labels: [label("projeto", "amber")],
    })),
  };

  const asesi = emptySnapshot({
    id: ASESI_ID,
    title: "ASESI",
    description:
      "Time ASESI (Assessoria de Sistemas e Inteligência). Projetos da carteira são boards filhos. Fontes: grupo WhatsApp ASESI e Trello https://trello.com/b/Rl7Cb3rj/asesi",
    level: "team",
    parentBoardId: CGE_ID,
    backgroundId: "trello",
    owner,
    team,
    whatsappGroups: [
      waGroup({
        name: "Grupo WhatsApp ASESI",
        jid: WA_ASESI_JID,
        notes: "Fonte principal da carteira ASESI.",
      }),
    ],
    listTitles: KANBAN,
    seedCards: asesiCards,
  });

  const projects = PROJECTS.map((p) =>
    emptySnapshot({
      id: p.id,
      title: p.title,
      description: p.description,
      level: "project",
      parentBoardId: ASESI_ID,
      backgroundId: p.backgroundId,
      owner,
      team,
      gitRepos: p.gitRepos || [],
      whatsappGroups: p.waJid
        ? [waGroup({ name: `Grupo WhatsApp ${p.title}`, jid: p.waJid })]
        : [],
      listTitles: KANBAN,
      seedCards: p.cards || {},
    }),
  );

  return [cge, asesi, ...projects];
}

const schema = (process.env.PG_SCHEMA || "trelloai").toLowerCase();
if (!/^[a-z][a-z0-9_]{0,62}$/.test(schema)) {
  throw new Error(`PG_SCHEMA inválido: ${schema}`);
}

const sslRaw = (process.env.PG_SSL || process.env.PGSSLMODE || "").toLowerCase();
const ssl = ["1", "true", "require", "on"].includes(sslRaw)
  ? { rejectUnauthorized: false }
  : false;

const config = process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL, ssl, connectionTimeoutMillis: 12000 }
  : {
      host: process.env.PG_HOST,
      port: Number(process.env.PG_PORT || 5432),
      database: process.env.PG_DATABASE,
      user: process.env.PG_USER,
      password: process.env.PG_PASSWORD,
      ssl,
      connectionTimeoutMillis: 12000,
    };

if (!config.connectionString && !(config.host && config.database && config.user && config.password)) {
  console.error("Configure PG_* ou DATABASE_URL em .env.local.");
  process.exit(1);
}

const client = new pg.Client(config);

try {
  await client.connect();
  await client.query(`SET search_path TO ${schema}, public`);

  const previous = await client.query(
    `SELECT board_id, snapshot->'board'->>'title' AS title FROM board_snapshots ORDER BY board_id`,
  );
  const users = await client.query(`SELECT lower(email) AS email FROM users`);
  const priorMembers = await client.query(`SELECT DISTINCT lower(email) AS email FROM board_memberships`);
  const emails = [
    ...new Set(
      [...users.rows, ...priorMembers.rows]
        .map((r) => r.email)
        .concat([(process.env.ADMIN_EMAIL || "admin@cge.ce.gov.br").trim().toLowerCase()])
        .filter(Boolean),
    ),
  ];

  await client.query("BEGIN");
  await client.query("DELETE FROM invites");
  await client.query("DELETE FROM board_memberships");
  await client.query("DELETE FROM board_snapshots");

  const snapshots = buildAllSnapshots();
  for (const snapshot of snapshots) {
    await client.query(
      `INSERT INTO board_snapshots (board_id, snapshot, updated_at)
       VALUES ($1, $2::jsonb, NOW())`,
      [snapshot.board.id, JSON.stringify(snapshot)],
    );
    for (const email of emails) {
      await client.query(
        `INSERT INTO board_memberships (email, board_id) VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [email, snapshot.board.id],
      );
    }
  }
  await client.query("COMMIT");

  const fileStore = {
    boards: Object.fromEntries(snapshots.map((s) => [s.board.id, s])),
    memberships: Object.fromEntries(emails.map((email) => [email, snapshots.map((s) => s.board.id)])),
  };
  const dataDir = path.join(root, "data");
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, "shared-boards.json"), JSON.stringify(fileStore, null, 2), "utf8");

  console.log(
    JSON.stringify(
      {
        ok: true,
        deleted: previous.rows,
        created: snapshots.map((s) => ({
          id: s.board.id,
          title: s.board.title,
          level: s.board.level,
          parent: s.board.parentBoardId,
          cards: Object.keys(s.cards).length,
        })),
        members: emails.length,
      },
      null,
      2,
    ),
  );
} catch (err) {
  try {
    await client.query("ROLLBACK");
  } catch {
    /* ignore */
  }
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
} finally {
  await client.end().catch(() => null);
}
