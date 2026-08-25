/**
 * Cliente OpenAI-compatível para DeepSeek nativo e LiteLLM CGE.
 *
 * O Bedrock (modelo `deepseek.v3.2` via LiteLLM) rejeita `temperature` e
 * `response_format`. Nesses casos omitimos os dois; o JSON continua pedido
 * no prompt de sistema.
 */

export type DeepSeekChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export function getDeepSeekConfig() {
  const model = process.env.DEEPSEEK_MODEL?.trim() || "deepseek-chat";
  const baseUrl = (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(
    /\/$/,
    "",
  );
  return { model, baseUrl };
}

export function shouldDropBedrockParams(baseUrl: string, model: string): boolean {
  const flag = process.env.DEEPSEEK_DROP_PARAMS?.trim().toLowerCase();
  if (flag === "1" || flag === "true") return true;
  if (flag === "0" || flag === "false") return false;
  if (/litellm/i.test(baseUrl) || /bedrock/i.test(baseUrl) || /bedrock/i.test(model)) {
    return true;
  }
  // Alias CGE / Bedrock: deepseek.v3.2 (o DeepSeek nativo usa deepseek-chat)
  if (model.includes(".")) return true;
  return false;
}

export function buildDeepSeekChatBody(opts: {
  model: string;
  baseUrl: string;
  messages: DeepSeekChatMessage[];
  temperature?: number;
}): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: opts.model,
    messages: opts.messages,
  };

  if (shouldDropBedrockParams(opts.baseUrl, opts.model)) {
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

export async function deepSeekChatCompletions(opts: {
  apiKey: string;
  messages: DeepSeekChatMessage[];
  temperature?: number;
}): Promise<string> {
  const { model, baseUrl } = getDeepSeekConfig();
  const res = await fetch(`${baseUrl}/chat/completions`, {
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
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty DeepSeek response");
  return stripJsonFence(content);
}
