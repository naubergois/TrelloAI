import type { AiAction, Card, StandupCheckIn } from "./types";
import type { AiRequestContext, AiResponse } from "./ai";

export interface ManagerContext extends AiRequestContext {
  managerName: string;
  members: { id: string; name: string; email?: string }[];
  checkIns: StandupCheckIn[];
  memberNames: Record<string, string>;
}

export type ManagerAiResponse = AiResponse & { extraAction?: AiAction };

export type StandupTurnInput = {
  managerName: string;
  memberName: string;
  memberId: string;
  questionIndex: number;
  questions: string[];
  userReply: string;
  checkIn: StandupCheckIn;
  recentChat: { role: string; content: string }[];
  boardTitle: string;
};

export type StandupTurnResult = {
  message: string;
  extract: Partial<Pick<StandupCheckIn, "yesterday" | "today" | "blockers">>;
  advanceQuestion: boolean;
  completeMember: boolean;
  provider: "deepseek" | "local";
};

const DEFAULT_QUESTIONS = [
  "O que você fez desde a última daily?",
  "No que vai trabalhar hoje?",
  "Há algum bloqueio?",
];

export function defaultManagerQuestions() {
  return [...DEFAULT_QUESTIONS];
}

export function localManagerProcess(context: ManagerContext): ManagerAiResponse {
  const todoList = context.lists[0];
  const doingList = context.lists[1] ?? context.lists[0];
  const doneList = context.lists[2] ?? context.lists[1] ?? context.lists[0];
  const allCards = context.lists.flatMap((l) =>
    l.cards.map((c) => ({ ...c, listId: l.id, listTitle: l.title })),
  );

  const createCards: { title: string; description?: string; priority?: Card["priority"] }[] = [];
  const updates: {
    cardId: string;
    title?: string;
    description?: string;
    priority?: Card["priority"];
    moveToListId?: string;
  }[] = [];

  const notes: string[] = [];

  for (const checkIn of context.checkIns) {
    const name = context.memberNames[checkIn.memberId] || "Membro";
    if (!checkIn.submittedAt) continue;

    notes.push(`• ${name}: ontem="${checkIn.yesterday || "—"}" | hoje="${checkIn.today || "—"}" | bloqueios="${checkIn.blockers || "nenhum"}"`);

    // Match existing cards by keyword overlap with "today" / "yesterday"
    const todayText = `${checkIn.today} ${checkIn.yesterday}`.toLowerCase();
    const matched = allCards.find((c) => {
      const words = c.title
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 3);
      return words.some((w) => todayText.includes(w));
    });

    if (checkIn.blockers.trim()) {
      createCards.push({
        title: `Bloqueio: ${checkIn.blockers.trim().slice(0, 80)}`,
        description: `Reportado por ${name} na daily.\nContexto: ${checkIn.today || checkIn.yesterday || "—"}`,
        priority: "high",
      });
    }

    if (matched) {
      const finished =
        /conclu|finaliz|terminei|feito|done|shipp|publiquei/i.test(checkIn.yesterday) ||
        /conclu|finaliz|terminei|feito|done/i.test(checkIn.today);
      const working = /trabalh|implement|fazendo|em progresso|continuar/i.test(checkIn.today);

      updates.push({
        cardId: matched.id,
        description: `${matched.title}\n\n[Daily ${new Date().toLocaleDateString("pt-BR")}] ${name}: ${checkIn.today || checkIn.yesterday}`,
        priority: checkIn.blockers.trim() ? "high" : undefined,
        moveToListId: finished
          ? doneList?.id
          : working
            ? doingList?.id
            : undefined,
      });
    } else if (checkIn.today.trim()) {
      createCards.push({
        title: checkIn.today.trim().slice(0, 100),
        description: `Criado pelo gestor virtual a partir do check-in de ${name}.`,
        priority: checkIn.blockers.trim() ? "high" : "medium",
      });
    }
  }

  const uniqueCreates = createCards
    .filter(
      (c, i, arr) =>
        arr.findIndex((x) => x.title.toLowerCase() === c.title.toLowerCase()) === i,
    )
    .slice(0, 8);

  const uniqueUpdates = updates
    .filter((u, i, arr) => arr.findIndex((x) => x.cardId === u.cardId) === i)
    .slice(0, 8);

  let action: AiAction = { type: "none" };
  const parts: string[] = [];

  if (uniqueCreates.length > 0) {
    action = {
      type: "create_cards",
      listId: todoList?.id,
      cards: uniqueCreates,
    };
    parts.push(`${uniqueCreates.length} card(s) criado(s)`);
  }

  // Prefer update_cards if we have updates; if we also created, we'll run creates first then need a second action
  // For simplicity: if updates exist and no creates, return updates; if both, return creates and encode updates in message
  // Better: return update_cards when updates exist, and include creates in a combined approach via API applying both.

  const summary = [
    `${context.managerName} fechou a daily de "${context.boardTitle}".`,
    notes.length ? `Check-ins:\n${notes.join("\n")}` : "Nenhum check-in submetido.",
    parts.length ? `Ações: ${parts.join(", ")}.` : "",
    uniqueUpdates.length
      ? `Atualizações sugeridas em ${uniqueUpdates.length} card(s) existentes.`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  if (uniqueUpdates.length > 0 && uniqueCreates.length === 0) {
    return {
      message: summary,
      action: { type: "update_cards", updates: uniqueUpdates },
      provider: "local",
    };
  }

  if (uniqueCreates.length > 0) {
    return {
      message: summary,
      action: {
        type: "create_cards",
        listId: todoList?.id,
        cards: uniqueCreates,
      },
      extraAction:
        uniqueUpdates.length > 0
          ? { type: "update_cards", updates: uniqueUpdates }
          : undefined,
      provider: "local",
    };
  }

  return {
    message: summary || "Daily registrada. Sem novas ações no board.",
    action,
    provider: "local",
  };
}

export async function deepSeekManagerProcess(
  context: ManagerContext,
  apiKey: string,
  opts?: { mode?: "daily" | "chat"; userMessage?: string },
): Promise<ManagerAiResponse> {
  const mode = opts?.mode || "daily";
  const model = process.env.DEEPSEEK_MODEL || "deepseek-chat";
  const baseUrl = (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(
    /\/$/,
    "",
  );

  const system = `Você é ${context.managerName}, gestor(a) virtual do kanban "${context.boardTitle}".
Fala português (Brasil). Você GERENCIA o projeto de verdade: cria listas/cards, move, prioriza, atribui responsáveis e define prazos.
Retorne SOMENTE JSON válido (sem markdown):
{
  "message": string (resumo claro das decisões para a equipe),
  "action":
    | { "type": "none" }
    | { "type": "create_cards", "listId": string | null, "cards": [{ "title": string, "description"?: string, "priority"?: "low"|"medium"|"high", "assigneeId"?: string|null, "dueDate"?: string|null }] }
    | { "type": "update_cards", "updates": [{ "cardId": string, "title"?: string, "description"?: string, "priority"?: "low"|"medium"|"high"|null, "moveToListId"?: string, "assigneeId"?: string|null, "dueDate"?: string|null }] }
    | { "type": "create_lists", "titles": string[] }
    | { "type": "assign_cards", "assignments": [{ "cardId": string, "assigneeId": string|null }] }
    | { "type": "suggest_priorities", "updates": [{ "cardId": string, "priority": "low"|"medium"|"high" }] },
  "extraAction": mesma forma de action ou omitido
}
Regras:
- Use ids reais do contexto (listas, cards, membros).
- Atribua trabalho com assigneeId quando fizer sentido.
- Mova cards entre listas conforme progresso (backlog → andamento → revisão → concluído).
- Crie listas só se o fluxo do projeto precisar.
- Max 8 creates / 8 updates / 4 listas novas.
Contexto:
${JSON.stringify(context, null, 2)}`;

  const userContent =
    mode === "chat"
      ? opts?.userMessage || "Ajude a organizar o projeto."
      : "Processe a daily: aplique ações concretas no board com base nos check-ins.";

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: userContent },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DeepSeek error ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty DeepSeek response");

  const cleaned = content.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "");
  const parsed = JSON.parse(cleaned) as {
    message?: string;
    action?: AiAction;
    extraAction?: AiAction;
  };

  return {
    message: parsed.message || (mode === "chat" ? "Pronto." : "Daily processada."),
    action: parsed.action || { type: "none" },
    extraAction: parsed.extraAction,
    provider: "deepseek",
  };
}

/** @deprecated use deepSeekManagerProcess — kept as alias for older call sites */
export async function openAiManagerProcess(
  context: ManagerContext,
  apiKey: string,
  opts?: { mode?: "daily" | "chat"; userMessage?: string },
): Promise<ManagerAiResponse> {
  return deepSeekManagerProcess(context, apiKey, opts);
}

export function localManagerChat(
  prompt: string,
  context: ManagerContext,
): ManagerAiResponse {
  const lower = prompt.toLowerCase();
  const todo = context.lists[0];
  const doing = context.lists[1] ?? todo;
  const done = context.lists[context.lists.length - 1] ?? todo;

  if (/lista|coluna|swim/.test(lower) && /cri|add|nova/.test(lower)) {
    const titleMatch = prompt.match(/["“](.+?)["”]/) || prompt.match(/lista\s+(.+)$/i);
    const title = titleMatch?.[1]?.trim() || "Nova etapa";
    return {
      message: `Criei a lista "${title}" para organizar melhor o fluxo.`,
      action: { type: "create_lists", titles: [title] },
      provider: "local",
    };
  }

  if (/atribu|responsáv|assignee|dono/.test(lower)) {
    const member = context.members.find((m) =>
      lower.includes(m.name.toLowerCase().split(" ")[0] || ""),
    );
    const card = context.lists
      .flatMap((l) => l.cards.map((c) => ({ ...c, listId: l.id })))
      .find((c) => lower.includes(c.title.toLowerCase().slice(0, 12)));
    if (member && card) {
      return {
        message: `Atribuí "${card.title}" para ${member.name}.`,
        action: {
          type: "assign_cards",
          assignments: [{ cardId: card.id, assigneeId: member.id }],
        },
        provider: "local",
      };
    }
  }

  if (/mover|mova|conclu|andamento|progresso/.test(lower)) {
    const card = context.lists
      .flatMap((l) => l.cards)
      .find((c) => lower.includes(c.title.toLowerCase().slice(0, 10)));
    if (card && done) {
      const target = /conclu|feito|done/.test(lower) ? done.id : doing?.id;
      if (target) {
        return {
          message: `Movimentei o card no fluxo do projeto.`,
          action: {
            type: "update_cards",
            updates: [{ cardId: card.id, moveToListId: target }],
          },
          provider: "local",
        };
      }
    }
  }

  // fallback: create task from prompt
  const title = prompt.replace(/^(crie|criar|adicione|faça)\s+/i, "").trim().slice(0, 100);
  if (title.length > 3 && todo) {
    return {
      message: `Criei o card "${title}" no backlog para a Maya acompanhar.`,
      action: {
        type: "create_cards",
        listId: todo.id,
        cards: [{ title, description: `Pedido ao gestor: ${prompt}`, priority: "medium" }],
      },
      provider: "local",
    };
  }

  return {
    message:
      "Posso gerir o projeto. Exemplos:\n• \"Crie cards para o plano de validação ASESI\"\n• \"Atribua Validar Jangada para Ana\"\n• \"Crie a lista Bloqueios\"\n• \"Mova X para concluído\"",
    action: { type: "none" },
    provider: "local",
  };
}

function fieldForQuestion(index: number): "yesterday" | "today" | "blockers" {
  if (index <= 0) return "yesterday";
  if (index === 1) return "today";
  return "blockers";
}

export function localStandupTurn(input: StandupTurnInput): StandupTurnResult {
  const reply = input.userReply.trim();
  const q = input.questions[input.questionIndex] || input.questions[0];
  const vague = !reply || reply.length < 4 || /^(oi+|olá+|ola+|ok|sim|não|nao|blz|eae|hey)$/i.test(reply);

  if (vague) {
    return {
      message: `${input.memberName}, preciso de um pouco mais de contexto. ${q}`,
      extract: {},
      advanceQuestion: false,
      completeMember: false,
      provider: "local",
    };
  }

  const field = fieldForQuestion(input.questionIndex);
  const nextIndex = input.questionIndex + 1;
  const completeMember = nextIndex >= input.questions.length;
  const extract = { [field]: reply } as StandupTurnResult["extract"];

  if (completeMember) {
    return {
      message: `Perfeito, ${input.memberName} — anotei: "${reply.slice(0, 80)}${reply.length > 80 ? "…" : ""}". Obrigado pelo check-in!`,
      extract,
      advanceQuestion: true,
      completeMember: true,
      provider: "local",
    };
  }

  const nextQ = input.questions[nextIndex];
  return {
    message: `Entendi: "${reply.slice(0, 90)}${reply.length > 90 ? "…" : ""}". ${input.memberName}, ${nextQ}`,
    extract,
    advanceQuestion: true,
    completeMember: false,
    provider: "local",
  };
}

export async function deepSeekStandupTurn(
  input: StandupTurnInput,
  apiKey: string,
): Promise<StandupTurnResult> {
  const model = process.env.DEEPSEEK_MODEL || "deepseek-chat";
  const baseUrl = (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(/\/$/, "");
  const currentQ = input.questions[input.questionIndex] || input.questions[0];
  const nextQ =
    input.questionIndex + 1 < input.questions.length
      ? input.questions[input.questionIndex + 1]
      : null;

  const system = `Você é ${input.managerName}, gestora virtual do board "${input.boardTitle}".
Conduza a daily em português do Brasil de forma NATURAL e conversacional (não robótica).
Pergunta atual (${input.questionIndex + 1}/${input.questions.length}): "${currentQ}"
Membro: ${input.memberName}
Check-in parcial: ${JSON.stringify(input.checkIn)}
Histórico recente: ${JSON.stringify(input.recentChat.slice(-8))}

Retorne SOMENTE JSON:
{
  "message": string,  // resposta da Maya: reconheça o que a pessoa disse; se advanceQuestion=true e ainda houver próxima pergunta, inclua a próxima naturalmente
  "extract": { "yesterday"?: string, "today"?: string, "blockers"?: string },
  "advanceQuestion": boolean, // false se a resposta for vaga (oi, ok, blz) — peça detalhes e repita a pergunta atual
  "completeMember": boolean   // true só quando as 3 perguntas tiverem respostas úteis
}

Regras:
- Nunca ignore a mensagem do usuário.
- Se for só saudação/vaga, advanceQuestion=false e completeMember=false.
- Ao avançar, preencha extract no campo correspondente (yesterday=perg0, today=perg1, blockers=perg2).
- Se for a última pergunta e a resposta for útil: completeMember=true e agradeça.
- Próxima pergunta (se houver): "${nextQ || ""}"
- Máx ~3 frases em message.`;

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.5,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: input.userReply },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DeepSeek error ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty DeepSeek response");

  const cleaned = content
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "");
  const parsed = JSON.parse(cleaned) as {
    message?: string;
    extract?: StandupTurnResult["extract"];
    advanceQuestion?: boolean;
    completeMember?: boolean;
  };

  return {
    message:
      parsed.message ||
      `${input.memberName}, ${currentQ}`,
    extract: parsed.extract || {},
    advanceQuestion: Boolean(parsed.advanceQuestion),
    completeMember: Boolean(parsed.completeMember),
    provider: "deepseek",
  };
}

