import type { AiAction, Card } from "./types";

export interface AiRequestContext {
  boardTitle: string;
  lists: {
    id: string;
    title: string;
    cards: {
      id: string;
      title: string;
      description?: string;
      priority: Card["priority"];
      assigneeId?: string | null;
      dueDate?: string | null;
    }[];
  }[];
}

export interface AiResponse {
  message: string;
  action: AiAction;
  provider: "openai" | "deepseek" | "local";
}

function firstListId(context: AiRequestContext) {
  return context.lists[0]?.id;
}

function extractBulletLines(prompt: string): string[] {
  return prompt
    .split(/\n|,|;|\.|\u2022|- /)
    .map((s) => s.replace(/^[\d)+.\s-]+/, "").trim())
    .filter((s) => s.length > 3 && s.length < 120);
}

function guessPriority(title: string): Card["priority"] {
  const t = title.toLowerCase();
  if (/urgente|crítico|critical|asap|blocker|segurança|security/.test(t)) return "high";
  if (/melhoria|docs|document|refino|cleanup|chore/.test(t)) return "low";
  return "medium";
}

export function localAiRespond(prompt: string, context: AiRequestContext): AiResponse {
  const lower = prompt.toLowerCase();

  if (/priorid|priority|suger/.test(lower)) {
    const updates = context.lists
      .flatMap((list) => list.cards)
      .filter((c) => !c.priority)
      .slice(0, 8)
      .map((c) => ({
        cardId: c.id,
        priority: guessPriority(c.title) as NonNullable<Card["priority"]>,
      }));

    if (updates.length === 0) {
      return {
        message:
          "Todos os cards já têm prioridade. Posso gerar novos cards a partir de um briefing — descreva o que precisa ser feito.",
        action: { type: "none" },
        provider: "local",
      };
    }

    return {
      message: `Sugeri prioridade em ${updates.length} card(s) sem classificação. Revise e ajuste se precisar.`,
      action: { type: "suggest_priorities", updates },
      provider: "local",
    };
  }

  if (/criar|gerar|quebr|breakdown|cards?|tarefas?|tasks?/.test(lower)) {
    let titles = extractBulletLines(prompt).filter(
      (line) =>
        !/^(crie|criar|gere|gerar|faça|fazer|sugira|prioridade|board|lista)/i.test(line),
    );

    if (titles.length < 2) {
      const topic = prompt.replace(/^(crie|criar|gere|gerar|faça|sugira)[^\w]*/i, "").trim() || "novo fluxo";
      titles = [
        `Pesquisar requisitos: ${topic}`,
        `Esboçar solução para ${topic}`,
        `Implementar MVP de ${topic}`,
        `Revisar e testar ${topic}`,
        `Documentar e publicar ${topic}`,
      ];
    }

    const listId = firstListId(context);
    const cards = titles.slice(0, 8).map((title) => ({
      title,
      description: `Gerado pelo assistente a partir do briefing.`,
      priority: guessPriority(title),
    }));

    return {
      message: `Criei ${cards.length} cards na lista "${context.lists[0]?.title ?? "A fazer"}". Arraste-os conforme o fluxo.`,
      action: { type: "create_cards", listId, cards },
      provider: "local",
    };
  }

  return {
    message:
      "Posso ajudar a organizar o board. Experimente:\n• \"Gere cards para lançar o MVP\"\n• \"Sugira prioridades nos cards\"\n• Liste tarefas em tópicos e peço para eu criar os cards",
    action: { type: "none" },
    provider: "local",
  };
}

export async function deepSeekRespond(
  prompt: string,
  context: AiRequestContext,
  apiKey: string,
): Promise<AiResponse> {
  const model = process.env.DEEPSEEK_MODEL || "deepseek-chat";
  const baseUrl = (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(
    /\/$/,
    "",
  );

  const system = `You are TrelloAI, an assistant inside a kanban board named "${context.boardTitle}".
Reply in Portuguese (Brazil). Be concise.
You MUST return ONLY valid JSON with this shape:
{
  "message": string,
  "action":
    | { "type": "none" }
    | { "type": "create_cards", "listId": string | null, "cards": [{ "title": string, "description"?: string, "priority"?: "low"|"medium"|"high" }] }
    | { "type": "suggest_priorities", "updates": [{ "cardId": string, "priority": "low"|"medium"|"high" }] }
}
Board context:
${JSON.stringify(context, null, 2)}
Rules:
- Prefer create_cards when user asks to break work down or generate tasks.
- Prefer suggest_priorities when user asks for priorities.
- Use existing listId from context when creating cards (default first list).
- Only use cardIds that exist in context for priority updates.
- Max 8 cards per create_cards.`;

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
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
    action?: AiAction;
  };

  return {
    message: parsed.message || "Pronto.",
    action: parsed.action || { type: "none" },
    provider: "deepseek",
  };
}

export async function openAiRespond(
  prompt: string,
  context: AiRequestContext,
  apiKey: string,
): Promise<AiResponse> {
  const system = `You are TrelloAI, an assistant inside a kanban board named "${context.boardTitle}".
Reply in Portuguese (Brazil). Be concise.
You MUST return ONLY valid JSON with this shape:
{
  "message": string,
  "action":
    | { "type": "none" }
    | { "type": "create_cards", "listId": string | null, "cards": [{ "title": string, "description"?: string, "priority"?: "low"|"medium"|"high" }] }
    | { "type": "suggest_priorities", "updates": [{ "cardId": string, "priority": "low"|"medium"|"high" }] }
}
Board context:
${JSON.stringify(context, null, 2)}
Rules:
- Prefer create_cards when user asks to break work down or generate tasks.
- Prefer suggest_priorities when user asks for priorities.
- Use existing listId from context when creating cards (default first list).
- Only use cardIds that exist in context for priority updates.
- Max 8 cards per create_cards.`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
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
  };

  return {
    message: parsed.message || "Pronto.",
    action: parsed.action || { type: "none" },
    provider: "openai",
  };
}
