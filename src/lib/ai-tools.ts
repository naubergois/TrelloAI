import { nanoid } from "nanoid";
import { shiftCalendarDay } from "@/lib/calendar-report";
import { extractMeetingUrlFromText, sanitizeMeetingUrl } from "@/lib/meeting-links";
import { isMayaRisksList } from "@/lib/maya-risk-column";
import { extractJsonText } from "@/lib/deepseek";
import type { AiAction, Card, ChecklistItem, Label, LabelColor, TeamEventKind } from "@/lib/types";

export type AiToolName =
  | "create_card"
  | "create_cards"
  | "create_list"
  | "create_calendar_event"
  | "create_calendar_events"
  | "update_calendar_event";

export type AiToolCall = {
  name: AiToolName | string;
  arguments: Record<string, unknown>;
};

export type AiToolChatResponse = {
  message: string;
  toolCalls: AiToolCall[];
  provider: "openai" | "deepseek" | "local";
};

export type AiToolContext = {
  boardId: string;
  boardTitle: string;
  today: string;
  lists: {
    id: string;
    title: string;
    systemKey?: string | null;
    cards: {
      id: string;
      title: string;
      priority: Card["priority"];
      assigneeId?: string | null;
      dueDate?: string | null;
    }[];
  }[];
  members: { id: string; name: string }[];
  events: {
    id: string;
    title: string;
    date: string;
    time: string | null;
    kind: string;
    meetingUrl?: string | null;
  }[];
};

export type BoardToolOps = {
  addList: (boardId: string, title: string) => string;
  addCard: (
    listId: string,
    title: string,
    extras?: Partial<
      Pick<Card, "description" | "priority" | "dueDate" | "assigneeId" | "labels" | "checklist" | "acceptanceCriteria">
    >,
  ) => string;
  createCalendarEvent: (input: {
    boardId: string;
    title: string;
    description?: string;
    kind?: TeamEventKind;
    date: string;
    time?: string | null;
    meetingUrl?: string | null;
    memberIds?: string[];
  }) => string;
  updateCalendarEvent: (
    eventId: string,
    patch: {
      title?: string;
      description?: string;
      kind?: TeamEventKind;
      date?: string;
      time?: string | null;
      meetingUrl?: string | null;
    },
  ) => void;
};

export type ToolExecResult = {
  name: string;
  ok: boolean;
  summary: string;
};

const LABEL_COLORS: LabelColor[] = ["teal", "amber", "sky", "violet", "lime", "rose"];

const TOOL_CATALOG = [
  {
    name: "create_card",
    description:
      "Cria um card no kanban. Use listTitle (ex.: Backlog, Em andamento) se não souber o id.",
    args: "title, description?, listId?, listTitle?, priority?, dueDate?, assigneeId?, assigneeName?, labels?: string[], checklist?: string[], acceptanceCriteria?",
  },
  {
    name: "create_cards",
    description: "Cria vários cards de uma vez na mesma lista (máx. 8).",
    args: "listId?, listTitle?, cards: [{ title, description?, priority?, dueDate?, assigneeName? }]",
  },
  {
    name: "create_list",
    description: "Cria uma lista (coluna) no board.",
    args: "title",
  },
  {
    name: "create_calendar_event",
    description:
      "Agenda um evento no calendário do time. date = YYYY-MM-DD. Pode incluir meetingUrl do Google Meet ou Microsoft Teams.",
    args: "title, date, time?, kind? (meeting|deadline|milestone|review|other), description?, meetingUrl?, memberNames?: string[]",
  },
  {
    name: "create_calendar_events",
    description: "Agenda vários eventos (máx. 5).",
    args: "events: [{ title, date, time?, kind?, description?, meetingUrl? }]",
  },
  {
    name: "update_calendar_event",
    description: "Atualiza um evento existente (ex.: colar link do Meet/Teams).",
    args: "eventId ou title, meetingUrl?, date?, time?, description?, title?",
  },
] as const;

export function aiToolSystemPrompt(ctx: AiToolContext) {
  return `Você é o assistente do kanban "${ctx.boardTitle}" (Jangada).
Responda em português do Brasil, de forma curta.
Hoje é ${ctx.today}.
Use as tools para CRIAR cards, listas e eventos de calendário. Não finja que criou — chame a tool.

Retorne SOMENTE JSON válido:
{
  "message": "o que você fez, em 1-3 frases",
  "tool_calls": [ { "name": "create_card", "arguments": { } } ]
}

Se não precisar alterar o board, use "tool_calls": [].

Tools:
${TOOL_CATALOG.map((t) => `- ${t.name}: ${t.description} Args: ${t.args}`).join("\n")}

Regras:
- Máximo 8 cards e 5 eventos por turno.
- dueDate e date no formato YYYY-MM-DD.
- kind de evento: meeting, deadline, milestone, review ou other.
- Para daily/reunião use kind=meeting. Se o usuário colar link do Meet ou Teams, preencha meetingUrl.
- Prefira listTitle existente. Não use a lista "Riscos Maya" salvo pedido explícito.
- assigneeName deve bater com um membro do contexto.

Contexto do board:
${JSON.stringify(
    {
      lists: ctx.lists.map((l) => ({
        id: l.id,
        title: l.title,
        cards: l.cards.slice(0, 12).map((c) => ({
          id: c.id,
          title: c.title,
          priority: c.priority,
          dueDate: c.dueDate,
        })),
      })),
      members: ctx.members,
      events: ctx.events.slice(0, 20),
    },
    null,
    2,
  )}`;
}

export function parseAiToolResponse(raw: string): {
  message: string;
  toolCalls: AiToolCall[];
} {
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(extractJsonText(raw)) as Record<string, unknown>;
  } catch {
    return { message: raw.trim() || "Pronto.", toolCalls: [] };
  }

  const message =
    typeof parsed.message === "string" && parsed.message.trim()
      ? parsed.message.trim()
      : "Pronto.";

  const rawCalls = parsed.tool_calls ?? parsed.toolCalls;
  const toolCalls: AiToolCall[] = [];

  if (Array.isArray(rawCalls)) {
    for (const item of rawCalls.slice(0, 12)) {
      if (!item || typeof item !== "object") continue;
      const rec = item as Record<string, unknown>;
      const name = String(rec.name || rec.tool || "").trim();
      if (!name) continue;
      let args: Record<string, unknown> = {};
      if (rec.arguments && typeof rec.arguments === "object" && !Array.isArray(rec.arguments)) {
        args = rec.arguments as Record<string, unknown>;
      } else if (rec.args && typeof rec.args === "object" && !Array.isArray(rec.args)) {
        args = rec.args as Record<string, unknown>;
      } else {
        args = { ...rec };
        delete args.name;
        delete args.tool;
        delete args.arguments;
        delete args.args;
      }
      toolCalls.push({ name, arguments: args });
    }
  } else if (parsed.action && typeof parsed.action === "object") {
    const converted = actionToToolCalls(parsed.action as AiAction);
    toolCalls.push(...converted);
  }

  return { message, toolCalls };
}

function actionToToolCalls(action: AiAction): AiToolCall[] {
  if (action.type === "create_cards") {
    return [
      {
        name: "create_cards",
        arguments: {
          listId: action.listId,
          cards: action.cards,
        },
      },
    ];
  }
  if (action.type === "create_lists") {
    return action.titles.map((title) => ({
      name: "create_list",
      arguments: { title },
    }));
  }
  return [];
}

export function resolveEventDate(raw: string | undefined, today: string): string {
  const t = (raw || "").trim().toLowerCase();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  if (!t || t === "hoje" || t === "today") return today;
  if (/amanh/.test(t) || t === "tomorrow") return shiftCalendarDay(today, 1);
  const br = t.match(/^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?$/);
  if (br) {
    const d = br[1].padStart(2, "0");
    const m = br[2].padStart(2, "0");
    let y = br[3] || today.slice(0, 4);
    if (y.length === 2) y = `20${y}`;
    return `${y}-${m}-${d}`;
  }
  return today;
}

export function resolveListId(
  ctx: AiToolContext,
  listId?: string | null,
  listTitle?: string | null,
): string | null {
  if (listId && ctx.lists.some((l) => l.id === listId)) return listId;
  const wanted = (listTitle || "").trim().toLowerCase();
  if (wanted) {
    const match = ctx.lists.find((l) => l.title.trim().toLowerCase() === wanted);
    if (match) return match.id;
    const partial = ctx.lists.find((l) =>
      l.title.trim().toLowerCase().includes(wanted),
    );
    if (partial) return partial.id;
  }
  const work = ctx.lists.find((l) => !isMayaRisksList(l));
  return work?.id ?? ctx.lists[0]?.id ?? null;
}

function resolveMemberId(
  ctx: AiToolContext,
  assigneeId?: string | null,
  assigneeName?: string | null,
): string | null {
  if (assigneeId && ctx.members.some((m) => m.id === assigneeId)) return assigneeId;
  const wanted = (assigneeName || "").trim().toLowerCase();
  if (!wanted) return null;
  const match = ctx.members.find((m) => m.name.trim().toLowerCase() === wanted);
  if (match) return match.id;
  const partial = ctx.members.find((m) =>
    m.name.trim().toLowerCase().includes(wanted),
  );
  return partial?.id ?? null;
}

function asPriority(value: unknown): Card["priority"] {
  if (value === "low" || value === "medium" || value === "high") return value;
  return null;
}

function asKind(value: unknown): TeamEventKind {
  if (
    value === "meeting" ||
    value === "deadline" ||
    value === "milestone" ||
    value === "review" ||
    value === "other"
  ) {
    return value;
  }
  return "meeting";
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function makeLabels(raw: unknown): Label[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, i) => {
      const name = typeof item === "string" ? item.trim() : asString((item as { name?: string })?.name);
      if (!name) return null;
      return {
        id: nanoid(),
        name,
        color: LABEL_COLORS[i % LABEL_COLORS.length],
      } satisfies Label;
    })
    .filter((x): x is Label => Boolean(x))
    .slice(0, 6);
}

function makeChecklist(raw: unknown): ChecklistItem[] {
  if (!Array.isArray(raw)) return [];
  const items: ChecklistItem[] = [];
  for (const item of raw) {
    const text =
      typeof item === "string"
        ? item.trim()
        : asString((item as { text?: string })?.text);
    if (!text) continue;
    items.push({ id: nanoid(), text, done: false });
    if (items.length >= 12) break;
  }
  return items;
}

function cardExtras(
  ctx: AiToolContext,
  args: Record<string, unknown>,
): Partial<Pick<Card, "description" | "priority" | "dueDate" | "assigneeId" | "labels" | "checklist" | "acceptanceCriteria">> {
  const due = asString(args.dueDate);
  return {
    description: asString(args.description) || "",
    priority: asPriority(args.priority),
    dueDate: due ? resolveEventDate(due, ctx.today) : null,
    assigneeId: resolveMemberId(ctx, asString(args.assigneeId) || null, asString(args.assigneeName) || null),
    labels: makeLabels(args.labels),
    checklist: makeChecklist(args.checklist),
    acceptanceCriteria: asString(args.acceptanceCriteria) || "",
  };
}

export function runBoardToolCall(
  call: AiToolCall,
  ctx: AiToolContext,
  ops: BoardToolOps,
): ToolExecResult {
  try {
    const args = call.arguments || {};
    const name = call.name;

    if (name === "create_list") {
      const title = asString(args.title);
      if (!title) return { name, ok: false, summary: "Lista sem título." };
      ops.addList(ctx.boardId, title);
      return { name, ok: true, summary: `Lista "${title}" criada.` };
    }

    if (name === "create_card") {
      const title = asString(args.title);
      if (!title) return { name, ok: false, summary: "Card sem título." };
      const listId = resolveListId(ctx, asString(args.listId) || null, asString(args.listTitle) || null);
      if (!listId) return { name, ok: false, summary: "Nenhuma lista no board." };
      ops.addCard(listId, title, cardExtras(ctx, args));
      const listTitle = ctx.lists.find((l) => l.id === listId)?.title || "lista";
      return { name, ok: true, summary: `Card "${title}" em ${listTitle}.` };
    }

    if (name === "create_cards") {
      const cards = Array.isArray(args.cards) ? args.cards : [];
      const listId = resolveListId(ctx, asString(args.listId) || null, asString(args.listTitle) || null);
      if (!listId) return { name, ok: false, summary: "Nenhuma lista no board." };
      let count = 0;
      for (const item of cards.slice(0, 8)) {
        const rec = (item && typeof item === "object" ? item : { title: item }) as Record<string, unknown>;
        const title = asString(rec.title);
        if (!title) continue;
        ops.addCard(listId, title, cardExtras(ctx, rec));
        count += 1;
      }
      if (!count) return { name, ok: false, summary: "Nenhum card válido." };
      return { name, ok: true, summary: `${count} card(s) criado(s).` };
    }

    if (name === "create_calendar_event") {
      const created = createOneEvent(args, ctx, ops);
      if (!created.ok) return { name, ...created };
      return { name, ok: true, summary: created.summary };
    }

    if (name === "create_calendar_events") {
      const events = Array.isArray(args.events) ? args.events : [];
      let count = 0;
      for (const item of events.slice(0, 5)) {
        if (!item || typeof item !== "object") continue;
        const created = createOneEvent(item as Record<string, unknown>, ctx, ops);
        if (created.ok) count += 1;
      }
      if (!count) return { name, ok: false, summary: "Nenhum evento válido." };
      return { name, ok: true, summary: `${count} evento(s) no calendário.` };
    }

    if (name === "update_calendar_event") {
      const eventId =
        asString(args.eventId) ||
        ctx.events.find(
          (e) => e.title.trim().toLowerCase() === asString(args.title).toLowerCase(),
        )?.id ||
        "";
      if (!eventId) return { name, ok: false, summary: "Evento não encontrado." };
      const patch: Parameters<BoardToolOps["updateCalendarEvent"]>[1] = {};
      if (args.title) patch.title = asString(args.title);
      if (args.description !== undefined) patch.description = asString(args.description);
      if (args.kind) patch.kind = asKind(args.kind);
      if (args.date) patch.date = resolveEventDate(asString(args.date), ctx.today);
      if (args.time !== undefined) patch.time = asString(args.time) || null;
      if (args.meetingUrl !== undefined) {
        patch.meetingUrl = sanitizeMeetingUrl(asString(args.meetingUrl));
      }
      ops.updateCalendarEvent(eventId, patch);
      return { name, ok: true, summary: "Evento atualizado." };
    }

    return { name, ok: false, summary: `Tool desconhecida: ${name}` };
  } catch (err) {
    return {
      name: call.name,
      ok: false,
      summary: err instanceof Error ? err.message : "Falha ao executar a tool.",
    };
  }
}

export function runBoardToolCalls(
  calls: AiToolCall[],
  ctx: AiToolContext,
  ops: BoardToolOps,
): ToolExecResult[] {
  const live: AiToolContext = {
    ...ctx,
    lists: ctx.lists.map((l) => ({ ...l, cards: [...l.cards] })),
    events: [...ctx.events],
  };
  const wrapped: BoardToolOps = {
    addList: (boardId, title) => {
      const id = ops.addList(boardId, title);
      live.lists.push({ id, title, cards: [] });
      return id;
    },
    addCard: (listId, title, extras) => {
      const id = ops.addCard(listId, title, extras);
      const list = live.lists.find((l) => l.id === listId);
      list?.cards.push({
        id,
        title,
        priority: extras?.priority ?? null,
        assigneeId: extras?.assigneeId ?? null,
        dueDate: extras?.dueDate ?? null,
      });
      return id;
    },
    createCalendarEvent: (input) => {
      const id = ops.createCalendarEvent(input);
      live.events.push({
        id,
        title: input.title,
        date: input.date,
        time: input.time ?? null,
        kind: input.kind || "meeting",
        meetingUrl: input.meetingUrl,
      });
      return id;
    },
    updateCalendarEvent: ops.updateCalendarEvent,
  };
  return calls.slice(0, 12).map((call) => runBoardToolCall(call, live, wrapped));
}

function createOneEvent(
  args: Record<string, unknown>,
  ctx: AiToolContext,
  ops: BoardToolOps,
): { ok: boolean; summary: string } {
  const title = asString(args.title);
  if (!title) return { ok: false, summary: "Evento sem título." };
  const description = asString(args.description);
  const meetingUrl =
    sanitizeMeetingUrl(asString(args.meetingUrl)) ||
    extractMeetingUrlFromText(description) ||
    extractMeetingUrlFromText(title);
  const memberNames = Array.isArray(args.memberNames) ? args.memberNames : [];
  const memberIds = memberNames
    .map((n) => resolveMemberId(ctx, null, asString(n)))
    .filter((id): id is string => Boolean(id));
  ops.createCalendarEvent({
    boardId: ctx.boardId,
    title,
    description,
    kind: asKind(args.kind),
    date: resolveEventDate(asString(args.date) || undefined, ctx.today),
    time: asString(args.time) || null,
    meetingUrl,
    memberIds: memberIds.length ? memberIds : ctx.members.map((m) => m.id),
  });
  const when = `${resolveEventDate(asString(args.date) || undefined, ctx.today)}${
    asString(args.time) ? ` ${asString(args.time)}` : ""
  }`;
  return { ok: true, summary: `Evento "${title}" em ${when}.` };
}

function extractBulletLines(prompt: string): string[] {
  return prompt
    .split(/\n|\u2022|;/)
    .map((s) => s.replace(/^[\d)+.\s-]+/, "").trim())
    .filter((s) => s.length > 3 && s.length < 140);
}

function extractTime(prompt: string): string | null {
  const m = prompt.match(/\b([01]?\d|2[0-3])[:h]([0-5]\d)\b/i);
  if (!m) return null;
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

function extractDateHint(prompt: string, today: string): string {
  const lower = prompt.toLowerCase();
  if (/amanh/.test(lower)) return shiftCalendarDay(today, 1);
  const iso = prompt.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (iso) return iso[1];
  const br = prompt.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
  if (br) return resolveEventDate(br[0], today);
  return today;
}

export function localAiToolRespond(prompt: string, ctx: AiToolContext): AiToolChatResponse {
  const lower = prompt.toLowerCase();
  const toolCalls: AiToolCall[] = [];
  const notes: string[] = [];

  const wantsEvent = /agend|evento|reuni[aã]o|daily|standup|meet|teams|calend[aá]rio|marco|review/.test(
    lower,
  );
  const wantsCards = /card|tarefa|criar|gere|gerar|quebr|lista|kanban|backlog/.test(lower);

  if (wantsEvent) {
    const meetingUrl = extractMeetingUrlFromText(prompt);
    const titleMatch = prompt
      .replace(/https?:\/\/\S+/gi, "")
      .replace(/msteams:\S+/gi, "")
      .trim();
    let title = "Reunião do time";
    if (/daily/.test(lower)) title = `Daily — ${ctx.boardTitle}`;
    else if (/review/.test(lower)) title = "Review";
    else {
      const named = titleMatch.match(
        /(?:agende|marcar|cria(?:r)? evento)?\s*[:\-]?\s*["“]?([^"”\n]{4,80})/i,
      );
      if (named?.[1] && !/^(agende|marcar|cria)/i.test(named[1])) {
        title = named[1].trim();
      }
    }
    toolCalls.push({
      name: "create_calendar_event",
      arguments: {
        title,
        date: extractDateHint(prompt, ctx.today),
        time: extractTime(prompt) || ( /daily/.test(lower) ? "09:00" : null),
        kind: /prazo|deadline/.test(lower)
          ? "deadline"
          : /marco|milestone/.test(lower)
            ? "milestone"
            : /review|revis/.test(lower)
              ? "review"
              : "meeting",
        meetingUrl,
        description: meetingUrl ? "Link da sala no evento." : "",
      },
    });
    notes.push("evento no calendário");
  }

  if (wantsCards || (!wantsEvent && /criar|gerar|faça|fazer/.test(lower))) {
    let titles = extractBulletLines(prompt).filter(
      (line) =>
        !/^(crie|criar|gere|gerar|faça|fazer|agende|marcar|prioridade|board|lista|evento)/i.test(
          line,
        ) && !/^https?:\/\//i.test(line),
    );
    if (titles.length < 2) {
      const topic =
        prompt.replace(/^(crie|criar|gere|gerar|faça|sugira)[^\w]*/i, "").trim() ||
        ctx.boardTitle;
      titles = [
        `Mapear: ${topic.slice(0, 60)}`,
        `Implementar: ${topic.slice(0, 60)}`,
        `Revisar: ${topic.slice(0, 60)}`,
        `Documentar: ${topic.slice(0, 60)}`,
      ];
    }
    toolCalls.push({
      name: "create_cards",
      arguments: {
        cards: titles.slice(0, 8).map((title) => ({ title })),
      },
    });
    notes.push("cards no board");
  }

  if (toolCalls.length === 0) {
    return {
      message:
        "Posso criar cards e eventos. Exemplos:\n• Crie 4 cards para o piloto\n• Agende a daily amanhã às 9h com o link do Teams\n• Crie as tarefas e marque a review sexta 14h",
      toolCalls: [],
      provider: "local",
    };
  }

  return {
    message: `Vou registrar ${notes.join(" e ")}.`,
    toolCalls,
    provider: "local",
  };
}
