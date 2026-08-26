/**
 * Tools MCP do Jangada — mutações puras no snapshot + persistência PG/arquivo.
 * Usado pelo stdio (Cursor e Kiro) para alimentar o mesmo kanban.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import pg from "pg";

export const ASESI_BOARD_ID = "asesi";

function nowIso() {
  return new Date().toISOString();
}

function nid() {
  return crypto.randomBytes(8).toString("hex");
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizePriority(value) {
  if (value === "low" || value === "medium" || value === "high") return value;
  return "medium";
}

export function compactBoard(snapshot) {
  const lists = (snapshot.board?.listIds || [])
    .map((id) => snapshot.lists?.[id])
    .filter(Boolean)
    .map((list) => ({
      id: list.id,
      title: list.title,
      cards: (list.cardIds || [])
        .map((cid) => snapshot.cards?.[cid])
        .filter(Boolean)
        .map((card) => ({
          id: card.id,
          title: card.title,
          priority: card.priority,
          dueDate: card.dueDate,
          assigneeId: card.assigneeId,
        })),
    }));
  const requirements = Object.values(snapshot.requirements || {}).map((req) => ({
    id: req.id,
    code: req.code,
    title: req.title,
    status: req.status,
    priority: req.priority,
  }));
  return {
    board: {
      id: snapshot.board?.id,
      title: snapshot.board?.title,
      description: snapshot.board?.description,
      updatedAt: snapshot.updatedAt,
      gitRepos: (snapshot.board?.gitRepos || []).map((repo) => ({
        id: repo.id,
        url: repo.url,
      })),
    },
    lists,
    requirements,
  };
}

export function findList(snapshot, listId, listTitle) {
  if (listId && snapshot.lists?.[listId]) return snapshot.lists[listId];
  if (listTitle) {
    const wanted = String(listTitle).trim().toLowerCase();
    return Object.values(snapshot.lists || {}).find(
      (list) => list.boardId === snapshot.board.id && String(list.title).toLowerCase() === wanted,
    );
  }
  const firstId = snapshot.board?.listIds?.[0];
  return firstId ? snapshot.lists?.[firstId] : null;
}

export function applyCriarLista(snapshot, { title }) {
  const name = String(title || "").trim();
  if (name.length < 2) throw new Error("Informe um título de lista com pelo menos 2 caracteres.");
  const next = clone(snapshot);
  const id = nid();
  next.lists = next.lists || {};
  next.lists[id] = { id, boardId: next.board.id, title: name, cardIds: [] };
  next.board.listIds = [...(next.board.listIds || []), id];
  next.board.updatedAt = nowIso();
  next.updatedAt = nowIso();
  return { snapshot: next, listId: id };
}

export function applyCriarCard(snapshot, args) {
  const title = String(args.title || "").trim();
  if (title.length < 2) throw new Error("Informe um título de card com pelo menos 2 caracteres.");
  const next = clone(snapshot);
  const list = findList(next, args.list_id || args.listId, args.list_title || args.listTitle);
  if (!list) throw new Error("Lista não encontrada. Use list_id ou list_title.");
  const id = nid();
  const ts = nowIso();
  next.cards = next.cards || {};
  next.cards[id] = {
    id,
    listId: list.id,
    title,
    description: String(args.description || ""),
    labels: Array.isArray(args.labels) ? args.labels : [],
    coverColor: args.cover_color || args.coverColor || null,
    dueDate: args.due_date || args.dueDate || null,
    priority: args.priority ? normalizePriority(args.priority) : "medium",
    assigneeId: args.assignee_id || args.assigneeId || null,
    requirementId: args.requirement_id || args.requirementId || null,
    acceptanceCriteria: String(args.acceptance_criteria || args.acceptanceCriteria || ""),
    checklist: Array.isArray(args.checklist) ? args.checklist : [],
    comments: [],
    archived: false,
    createdAt: ts,
    updatedAt: ts,
  };
  list.cardIds = [...(list.cardIds || []), id];
  next.lists[list.id] = list;
  next.board.updatedAt = ts;
  next.updatedAt = ts;
  return { snapshot: next, cardId: id, listId: list.id };
}

export function applyCriarCards(snapshot, cards) {
  let next = snapshot;
  const created = [];
  for (const card of cards || []) {
    const result = applyCriarCard(next, card);
    next = result.snapshot;
    created.push({ cardId: result.cardId, listId: result.listId, title: card.title });
  }
  return { snapshot: next, created };
}

export function applyAtualizarCard(snapshot, args) {
  const cardId = args.card_id || args.cardId;
  const next = clone(snapshot);
  const card = next.cards?.[cardId];
  if (!card) throw new Error("Card não encontrado.");
  if (args.title != null) card.title = String(args.title);
  if (args.description != null) card.description = String(args.description);
  if (args.priority != null) card.priority = normalizePriority(args.priority);
  if (args.due_date !== undefined || args.dueDate !== undefined) {
    card.dueDate = args.due_date ?? args.dueDate ?? null;
  }
  if (args.assignee_id !== undefined || args.assigneeId !== undefined) {
    card.assigneeId = args.assignee_id ?? args.assigneeId ?? null;
  }
  if (args.acceptance_criteria != null || args.acceptanceCriteria != null) {
    card.acceptanceCriteria = String(args.acceptance_criteria ?? args.acceptanceCriteria ?? "");
  }
  if (args.cover_color !== undefined || args.coverColor !== undefined) {
    card.coverColor = args.cover_color ?? args.coverColor ?? null;
  }
  if (args.labels != null) card.labels = Array.isArray(args.labels) ? args.labels : [];
  card.updatedAt = nowIso();
  next.board.updatedAt = card.updatedAt;
  next.updatedAt = card.updatedAt;
  return { snapshot: next, card };
}

export function applyMoverCard(snapshot, args) {
  const cardId = args.card_id || args.cardId;
  const next = clone(snapshot);
  const card = next.cards?.[cardId];
  if (!card) throw new Error("Card não encontrado.");
  const target = findList(next, args.list_id || args.listId, args.list_title || args.listTitle);
  if (!target) throw new Error("Lista de destino não encontrada.");
  const from = next.lists[card.listId];
  if (from) from.cardIds = (from.cardIds || []).filter((id) => id !== cardId);
  if (!target.cardIds.includes(cardId)) target.cardIds = [...(target.cardIds || []), cardId];
  card.listId = target.id;
  card.updatedAt = nowIso();
  next.board.updatedAt = card.updatedAt;
  next.updatedAt = card.updatedAt;
  return { snapshot: next, cardId, listId: target.id };
}

export function applyCriarRequisito(snapshot, args) {
  const title = String(args.title || "").trim();
  const code = String(args.code || "").trim();
  if (title.length < 2) throw new Error("Informe um título de requisito.");
  if (!code) throw new Error("Informe o código do requisito (ex.: ASESI-R10).");
  const next = clone(snapshot);
  next.requirements = next.requirements || {};
  const id = nid();
  const ts = nowIso();
  const req = {
    id,
    boardId: next.board.id,
    code,
    title,
    description: String(args.description || ""),
    status: args.status || "draft",
    priority: normalizePriority(args.priority),
    ownerId: args.owner_id || args.ownerId || null,
    dueDate: args.due_date || args.dueDate || null,
    mcpPayload: JSON.stringify(
      {
        requirement: { code, title, description: args.description || "", source: "mcp" },
        mcp_tools: [{ tool: "jangada_criar_card", arguments: { board_id: next.board.id, title } }],
      },
      null,
      2,
    ),
    createdAt: ts,
    updatedAt: ts,
  };
  next.requirements[id] = req;
  next.board.updatedAt = ts;
  next.updatedAt = ts;
  return { snapshot: next, requirementId: id, requirement: req };
}

export function applyAdicionarGit(snapshot, args) {
  const url = String(args.url || "").trim();
  if (!url) throw new Error("Informe a URL do Git.");
  const next = clone(snapshot);
  next.board.gitRepos = Array.isArray(next.board.gitRepos) ? next.board.gitRepos : [];
  if (next.board.gitRepos.some((r) => r.url === url)) {
    return { snapshot: next, repoId: next.board.gitRepos.find((r) => r.url === url).id };
  }
  const id = nid();
  next.board.gitRepos.push({ id, url, addedAt: nowIso() });
  next.board.updatedAt = nowIso();
  next.updatedAt = nowIso();
  return { snapshot: next, repoId: id };
}

export function listTools() {
  const boardId = { type: "string", description: "Id do board (default: asesi)" };
  const listId = { type: "string", description: "Id da lista" };
  const listTitle = { type: "string", description: "Título da lista (alternativa a list_id)" };
  return [
    {
      name: "jangada_ping",
      description: "Testa persistência do Jangada (Postgres ASESI ou arquivo local).",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
    {
      name: "jangada_listar_boards",
      description: "Lista boards do Jangada (id, título, atualização).",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
    {
      name: "jangada_ver_board",
      description: "Lê um board. Por padrão devolve visão compacta (listas e cards).",
      inputSchema: {
        type: "object",
        properties: {
          board_id: boardId,
          completo: { type: "boolean", description: "Se true, devolve o snapshot inteiro" },
        },
      },
    },
    {
      name: "jangada_criar_lista",
      description: "Cria uma lista no board para Cursor ou Kiro alimentarem o kanban.",
      inputSchema: {
        type: "object",
        properties: { board_id: boardId, title: { type: "string" } },
        required: ["title"],
      },
    },
    {
      name: "jangada_criar_card",
      description: "Cria um card no board (backlog por padrão). Use para alimentar o Jangada a partir do Cursor ou do Kiro.",
      inputSchema: {
        type: "object",
        properties: {
          board_id: boardId,
          list_id: listId,
          list_title: listTitle,
          title: { type: "string" },
          description: { type: "string" },
          priority: { type: "string", enum: ["low", "medium", "high"] },
          due_date: { type: "string", description: "YYYY-MM-DD" },
          assignee_id: { type: "string" },
          requirement_id: { type: "string" },
          cover_color: {
            type: "string",
            description: "Cor do card (green, yellow, blue, #hex…)",
          },
        },
        required: ["title"],
      },
    },
    {
      name: "jangada_criar_cards",
      description: "Cria vários cards de uma vez no mesmo board.",
      inputSchema: {
        type: "object",
        properties: {
          board_id: boardId,
          cards: {
            type: "array",
            items: {
              type: "object",
              properties: {
                list_id: listId,
                list_title: listTitle,
                title: { type: "string" },
                description: { type: "string" },
                priority: { type: "string" },
                due_date: { type: "string" },
              },
              required: ["title"],
            },
          },
        },
        required: ["cards"],
      },
    },
    {
      name: "jangada_atualizar_card",
      description: "Atualiza título, descrição, prioridade, prazo ou responsável de um card.",
      inputSchema: {
        type: "object",
        properties: {
          board_id: boardId,
          card_id: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
          priority: { type: "string", enum: ["low", "medium", "high"] },
          due_date: { type: "string" },
          assignee_id: { type: "string" },
          cover_color: { type: "string" },
        },
        required: ["card_id"],
      },
    },
    {
      name: "jangada_mover_card",
      description: "Move um card para outra lista (por id ou título).",
      inputSchema: {
        type: "object",
        properties: {
          board_id: boardId,
          card_id: { type: "string" },
          list_id: listId,
          list_title: listTitle,
        },
        required: ["card_id"],
      },
    },
    {
      name: "jangada_criar_requisito",
      description: "Cria um requisito no board, com payload MCP para handoff Cursor/Kiro.",
      inputSchema: {
        type: "object",
        properties: {
          board_id: boardId,
          code: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
          priority: { type: "string", enum: ["low", "medium", "high"] },
          status: { type: "string" },
        },
        required: ["code", "title"],
      },
    },
    {
      name: "jangada_adicionar_git",
      description: "Liga um repositório Git ao board para a Maya analisar o que já está implementado.",
      inputSchema: {
        type: "object",
        properties: {
          board_id: boardId,
          url: { type: "string", description: "URL HTTPS do Git ou caminho local" },
        },
        required: ["url"],
      },
    },
  ];
}

export function boardIdOf(args) {
  return String(args?.board_id || args?.boardId || ASESI_BOARD_ID).trim() || ASESI_BOARD_ID;
}

export async function callTool(name, args, store) {
  try {
    if (name === "jangada_ping") return store.ping();
    if (name === "jangada_listar_boards") return { boards: await store.listBoards() };

    const boardId = boardIdOf(args || {});
    if (name === "jangada_ver_board") {
      const snapshot = await store.getBoard(boardId);
      if (!snapshot) return { status: "erro", erro: `Board ${boardId} não encontrado` };
      return args?.completo ? { snapshot } : compactBoard(snapshot);
    }

    const snapshot = await store.getBoard(boardId);
    if (!snapshot) return { status: "erro", erro: `Board ${boardId} não encontrado` };

    let result;
    if (name === "jangada_criar_lista") result = applyCriarLista(snapshot, args);
    else if (name === "jangada_criar_card") result = applyCriarCard(snapshot, args);
    else if (name === "jangada_criar_cards") result = applyCriarCards(snapshot, args.cards);
    else if (name === "jangada_atualizar_card") result = applyAtualizarCard(snapshot, args);
    else if (name === "jangada_mover_card") result = applyMoverCard(snapshot, args);
    else if (name === "jangada_criar_requisito") result = applyCriarRequisito(snapshot, args);
    else if (name === "jangada_adicionar_git") result = applyAdicionarGit(snapshot, args);
    else return { status: "erro", erro: `Tool desconhecida: ${name}` };

    await store.saveBoard(result.snapshot);
    await store.touchActor(boardId);
    const { snapshot: _ignored, ...rest } = result;
    return { status: "ok", board_id: boardId, ...rest, board: compactBoard(result.snapshot) };
  } catch (err) {
    return { status: "erro", erro: err instanceof Error ? err.message : String(err) };
  }
}

export function loadEnvFile(root, file) {
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

export function pgConfigured() {
  if (process.env.DATABASE_URL?.trim()) return true;
  return Boolean(
    process.env.PG_HOST?.trim() &&
      process.env.PG_DATABASE?.trim() &&
      process.env.PG_USER?.trim() &&
      process.env.PG_PASSWORD,
  );
}

export function createPgStore(root) {
  const schema = (process.env.PG_SCHEMA || "trelloai").toLowerCase();
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(schema)) {
    throw new Error(`PG_SCHEMA inválido: ${schema}`);
  }
  const sslRaw = (process.env.PG_SSL || process.env.PGSSLMODE || "").toLowerCase();
  const ssl = ["1", "true", "require", "on"].includes(sslRaw)
    ? { rejectUnauthorized: false }
    : false;
  const config = process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL, ssl, connectionTimeoutMillis: 8000 }
    : {
        host: process.env.PG_HOST,
        port: Number(process.env.PG_PORT || 5432),
        database: process.env.PG_DATABASE,
        user: process.env.PG_USER,
        password: process.env.PG_PASSWORD,
        ssl,
        connectionTimeoutMillis: 8000,
      };
  const pool = new pg.Pool(config);
  const actor = (
    process.env.MCP_ACTOR_EMAIL ||
    process.env.ADMIN_EMAIL ||
    "admin@cge.ce.gov.br"
  )
    .trim()
    .toLowerCase();

  async function withSchema(fn) {
    const client = await pool.connect();
    try {
      await client.query(`SET search_path TO ${schema}, public`);
      return await fn(client);
    } finally {
      client.release();
    }
  }

  return {
    kind: "postgres",
    actor,
    async ping() {
      return withSchema(async (client) => {
        const row = await client.query("SELECT current_database() AS db, current_schema() AS schema");
        return {
          ok: true,
          store: "postgres",
          database: row.rows[0]?.db,
          schema: row.rows[0]?.schema,
          actor,
          root,
        };
      });
    },
    async listBoards() {
      return withSchema(async (client) => {
        const res = await client.query(
          `SELECT board_id, snapshot->'board'->>'title' AS title, updated_at
           FROM board_snapshots ORDER BY updated_at DESC`,
        );
        return res.rows.map((row) => ({
          id: row.board_id,
          title: row.title,
          updatedAt: row.updated_at,
        }));
      });
    },
    async getBoard(boardId) {
      return withSchema(async (client) => {
        const res = await client.query("SELECT snapshot FROM board_snapshots WHERE board_id = $1", [
          boardId,
        ]);
        return res.rows[0]?.snapshot ?? null;
      });
    },
    async saveBoard(snapshot) {
      return withSchema(async (client) => {
        await client.query(
          `INSERT INTO board_snapshots (board_id, snapshot, updated_at)
           VALUES ($1, $2::jsonb, NOW())
           ON CONFLICT (board_id) DO UPDATE SET snapshot = $2::jsonb, updated_at = NOW()`,
          [snapshot.board.id, JSON.stringify(snapshot)],
        );
      });
    },
    async touchActor(boardId) {
      return withSchema(async (client) => {
        await client.query(
          `INSERT INTO board_memberships (email, board_id) VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [actor, boardId],
        );
      });
    },
    async close() {
      await pool.end();
    },
  };
}

export function createFileStore(root) {
  const file = path.join(root, "data", "shared-boards.json");
  const actor = (
    process.env.MCP_ACTOR_EMAIL ||
    process.env.ADMIN_EMAIL ||
    "admin@cge.ce.gov.br"
  )
    .trim()
    .toLowerCase();

  function read() {
    if (!fs.existsSync(file)) return { boards: {}, memberships: {} };
    try {
      return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
      return { boards: {}, memberships: {} };
    }
  }

  function write(store) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(store, null, 2), "utf8");
  }

  return {
    kind: "file",
    actor,
    async ping() {
      return { ok: true, store: "file", file, actor, root };
    },
    async listBoards() {
      const store = read();
      return Object.values(store.boards || {}).map((snap) => ({
        id: snap.board?.id,
        title: snap.board?.title,
        updatedAt: snap.updatedAt,
      }));
    },
    async getBoard(boardId) {
      return read().boards?.[boardId] ?? null;
    },
    async saveBoard(snapshot) {
      const store = read();
      store.boards = store.boards || {};
      store.boards[snapshot.board.id] = snapshot;
      write(store);
    },
    async touchActor(boardId) {
      const store = read();
      store.memberships = store.memberships || {};
      const current = new Set(store.memberships[actor] || []);
      current.add(boardId);
      store.memberships[actor] = [...current];
      write(store);
    },
    async close() {},
  };
}
