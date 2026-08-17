import type { AiAction, Card, StandupCheckIn } from "./types";
import type { AiRequestContext, AiResponse } from "./ai";

export interface ManagerContext extends AiRequestContext {
  managerName: string;
  members: { id: string; name: string }[];
  checkIns: StandupCheckIn[];
  memberNames: Record<string, string>;
}

export type ManagerAiResponse = AiResponse & { extraAction?: AiAction };

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

export async function openAiManagerProcess(
  context: ManagerContext,
  apiKey: string,
): Promise<ManagerAiResponse> {
  const system = `Você é ${context.managerName}, gestor virtual do kanban "${context.boardTitle}".
Fala português (Brasil). Após a daily, analise os check-ins e proponha ações no board.
Retorne SOMENTE JSON:
{
  "message": string (resumo da daily para a equipe),
  "action":
    | { "type": "none" }
    | { "type": "create_cards", "listId": string | null, "cards": [{ "title": string, "description"?: string, "priority"?: "low"|"medium"|"high" }] }
    | { "type": "update_cards", "updates": [{ "cardId": string, "title"?: string, "description"?: string, "priority"?: "low"|"medium"|"high"|null, "moveToListId"?: string }] },
  "extraAction": mesma forma de action ou omitido (use para segunda ação, ex. updates além de creates)
}
Regras:
- Criar cards para trabalho novo ou bloqueios explícitos.
- Atualizar/mover cards existentes quando o check-in claramente se refere a eles (use cardIds do contexto).
- Listas: primeira = a fazer, segunda = em progresso, terceira = concluído.
- Max 8 creates e 8 updates.
Contexto:
${JSON.stringify(context, null, 2)}`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: "Processe a daily: pergunte implicitamente pelo status e aplique ações no board.",
        },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty OpenAI response");

  const parsed = JSON.parse(content) as {
    message?: string;
    action?: AiAction;
    extraAction?: AiAction;
  };

  return {
    message: parsed.message || "Daily processada.",
    action: parsed.action || { type: "none" },
    extraAction: parsed.extraAction,
    provider: "openai",
  };
}
