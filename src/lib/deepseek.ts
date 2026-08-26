/**
 * Cliente OpenAI-compatível para DeepSeek nativo e LiteLLM CGE.
 *
 * O proxy CGE mapeia `deepseek.v3.2` para Bedrock Invoke, que devolve 404
 * (provider=None). O modelo que funciona hoje é `us.deepseek.r1-v1:0`
 * (Converse / inference profile). Bedrock também rejeita `temperature` e
 * `response_format` — omitimos os dois e pedimos JSON no prompt.
 *
 * DeepSeek R1 no Bedrock Converse não aceita role `system` e exige que a
 * conversa comece com `user`. O LiteLLM CGE, quando o modelo não suporta
 * system, funde o system no próximo turno — se esse turno for a Maya
 * (`assistant`), o Bedrock recebe a conversa começando na assistente e
 * devolve 400. Por isso o caminho LiteLLM/Bedrock vira UM único `user`.
 */

export type DeepSeekChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

/** Aliases do LiteLLM CGE que caem no Bedrock Invoke quebrado. */
export const BROKEN_LITELLM_DEEPSEEK_MODELS = new Set([
  "deepseek.v3.2",
  "bedrock/us-east-1/deepseek.v3.2",
]);

export const LITELLM_DEEPSEEK_FALLBACK_MODEL = "us.deepseek.r1-v1:0";

export function getDeepSeekConfig() {
  const requested = process.env.DEEPSEEK_MODEL?.trim() || "deepseek-chat";
  const baseUrl = (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(
    /\/$/,
    "",
  );
  return { model: resolveDeepSeekModel(baseUrl, requested), baseUrl, requested };
}

export function isLiteLLMBedrockTarget(baseUrl: string, model: string): boolean {
  if (/litellm/i.test(baseUrl) || /bedrock/i.test(baseUrl) || /bedrock/i.test(model)) {
    return true;
  }
  // Alias CGE / Bedrock: deepseek.v3.2, us.deepseek.r1-v1:0
  return model.includes(".");
}

export function shouldDropBedrockParams(baseUrl: string, model: string): boolean {
  const flag = process.env.DEEPSEEK_DROP_PARAMS?.trim().toLowerCase();
  if (flag === "1" || flag === "true") return true;
  if (flag === "0" || flag === "false") return false;
  return isLiteLLMBedrockTarget(baseUrl, model);
}

export function resolveDeepSeekModel(baseUrl: string, model: string): string {
  const flag = process.env.DEEPSEEK_DISABLE_MODEL_REMAP?.trim().toLowerCase();
  if (flag === "1" || flag === "true") return model;
  if (!shouldDropBedrockParams(baseUrl, model) && !/litellm/i.test(baseUrl)) {
    return model;
  }
  if (!BROKEN_LITELLM_DEEPSEEK_MODELS.has(model)) return model;
  return process.env.DEEPSEEK_FALLBACK_MODEL?.trim() || LITELLM_DEEPSEEK_FALLBACK_MODEL;
}

export function chatCompletionsUrl(baseUrl: string): string {
  const base = baseUrl.replace(/\/$/, "");
  if (/\/chat\/completions$/i.test(base)) return base;
  if (/\/v1$/i.test(base)) return `${base}/chat/completions`;
  if (/litellm/i.test(base)) return `${base}/v1/chat/completions`;
  return `${base}/chat/completions`;
}

/**
 * Um único `user`: o LiteLLM não tem como reordenar system/assistant e
 * mandar o Bedrock começar a conversa na Maya.
 */
export function normalizeBedrockChatMessages(
  messages: DeepSeekChatMessage[],
): DeepSeekChatMessage[] {
  const systems: string[] = [];
  const turns: { role: "user" | "assistant"; content: string }[] = [];

  for (const raw of messages) {
    const content = raw.content.trim();
    if (!content) continue;
    if (raw.role === "system") {
      systems.push(content);
      continue;
    }
    turns.push({
      role: raw.role === "assistant" ? "assistant" : "user",
      content,
    });
  }

  const system = systems.join("\n\n");
  const hasAssistant = turns.some((turn) => turn.role === "assistant");

  if (!hasAssistant) {
    const userText = turns.map((turn) => turn.content).join("\n\n");
    return [{ role: "user", content: [system, userText].filter(Boolean).join("\n\n") || "Continue." }];
  }

  const parts: string[] = [];
  if (system) parts.push(system);
  for (const turn of turns) {
    parts.push(turn.role === "assistant" ? `Maya: ${turn.content}` : `Usuário: ${turn.content}`);
  }
  return [{ role: "user", content: parts.join("\n\n") }];
}

export function buildDeepSeekChatBody(opts: {
  model: string;
  baseUrl: string;
  messages: DeepSeekChatMessage[];
  temperature?: number;
}): Record<string, unknown> {
  const model = resolveDeepSeekModel(opts.baseUrl, opts.model);
  const converse = isLiteLLMBedrockTarget(opts.baseUrl, model);
  const dropParams = shouldDropBedrockParams(opts.baseUrl, model);
  const body: Record<string, unknown> = {
    model,
    messages: converse ? normalizeBedrockChatMessages(opts.messages) : opts.messages,
  };

  if (dropParams) {
    // R1 gasta tokens em raciocínio; sem teto a resposta JSON pode vir vazia.
    body.max_tokens = 4096;
    return body;
  }

  if (typeof opts.temperature === "number") {
    body.temperature = opts.temperature;
  }
  body.response_format = { type: "json_object" };
  return body;
}

export function stripJsonFence(content: string) {
  return content
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

export function extractJsonText(content: string) {
  const stripped = stripJsonFence(content);
  try {
    JSON.parse(stripped);
    return stripped;
  } catch {
    const start = stripped.indexOf("{");
    const end = stripped.lastIndexOf("}");
    if (start >= 0 && end > start) return stripped.slice(start, end + 1);
    return stripped;
  }
}

type ChatMessage = {
  content?: string | null;
  reasoning_content?: string | null;
};

export function messageText(message: ChatMessage | undefined): string {
  const content = message?.content?.trim();
  if (content) return content;
  return message?.reasoning_content?.trim() || "";
}

export async function deepSeekChatCompletions(opts: {
  apiKey: string;
  messages: DeepSeekChatMessage[];
  temperature?: number;
}): Promise<string> {
  const { model, baseUrl } = getDeepSeekConfig();
  const res = await fetch(chatCompletionsUrl(baseUrl), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(
      buildDeepSeekChatBody({
        model,
        baseUrl,
        messages: opts.messages,
        temperature: opts.temperature,
      }),
    ),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DeepSeek error ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: ChatMessage }[];
  };
  const content = messageText(data.choices?.[0]?.message);
  if (!content) throw new Error("Empty DeepSeek response");
  return extractJsonText(content);
}
