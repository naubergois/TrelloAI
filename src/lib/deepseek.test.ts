import { afterEach, describe, expect, it } from "vitest";
import {
  BROKEN_LITELLM_DEEPSEEK_MODELS,
  buildDeepSeekChatBody,
  chatCompletionsUrl,
  extractJsonText,
  LITELLM_DEEPSEEK_FALLBACK_MODEL,
  messageText,
  resolveDeepSeekModel,
  shouldDropBedrockParams,
  stripJsonFence,
} from "./deepseek";

describe("LiteLLM / Bedrock params", () => {
  const prev = {
    drop: process.env.DEEPSEEK_DROP_PARAMS,
    model: process.env.DEEPSEEK_MODEL,
    base: process.env.DEEPSEEK_BASE_URL,
    remap: process.env.DEEPSEEK_DISABLE_MODEL_REMAP,
    fallback: process.env.DEEPSEEK_FALLBACK_MODEL,
  };

  afterEach(() => {
    restore("DEEPSEEK_DROP_PARAMS", prev.drop);
    restore("DEEPSEEK_MODEL", prev.model);
    restore("DEEPSEEK_BASE_URL", prev.base);
    restore("DEEPSEEK_DISABLE_MODEL_REMAP", prev.remap);
    restore("DEEPSEEK_FALLBACK_MODEL", prev.fallback);
  });

  it("drops temperature and response_format for LiteLLM CGE", () => {
    delete process.env.DEEPSEEK_DROP_PARAMS;
    delete process.env.DEEPSEEK_DISABLE_MODEL_REMAP;
    const baseUrl = "https://litellm.cge.ce.gov.br";
    const model = "deepseek.v3.2";
    expect(shouldDropBedrockParams(baseUrl, model)).toBe(true);
    const body = buildDeepSeekChatBody({
      model,
      baseUrl,
      messages: [{ role: "user", content: "oi" }],
      temperature: 0.4,
    });
    expect(body.model).toBe(LITELLM_DEEPSEEK_FALLBACK_MODEL);
    expect(body.messages).toEqual([{ role: "user", content: "oi" }]);
    expect(body.max_tokens).toBe(4096);
    expect(body).not.toHaveProperty("temperature");
    expect(body).not.toHaveProperty("response_format");
  });

  it("remaps broken deepseek.v3.2 alias to R1 converse profile", () => {
    delete process.env.DEEPSEEK_DISABLE_MODEL_REMAP;
    expect(
      resolveDeepSeekModel("https://litellm.cge.ce.gov.br", "deepseek.v3.2"),
    ).toBe("us.deepseek.r1-v1:0");
    expect(
      resolveDeepSeekModel(
        "https://litellm.cge.ce.gov.br",
        "bedrock/us-east-1/deepseek.v3.2",
      ),
    ).toBe("us.deepseek.r1-v1:0");
    expect(BROKEN_LITELLM_DEEPSEEK_MODELS.has("deepseek.v3.2")).toBe(true);
  });

  it("keeps an already-working LiteLLM model", () => {
    expect(
      resolveDeepSeekModel("https://litellm.cge.ce.gov.br", "us.deepseek.r1-v1:0"),
    ).toBe("us.deepseek.r1-v1:0");
    expect(
      resolveDeepSeekModel("https://litellm.cge.ce.gov.br", "qwen.qwen3-32b-v1:0"),
    ).toBe("qwen.qwen3-32b-v1:0");
  });

  it("uses /v1/chat/completions on LiteLLM", () => {
    expect(chatCompletionsUrl("https://litellm.cge.ce.gov.br")).toBe(
      "https://litellm.cge.ce.gov.br/v1/chat/completions",
    );
    expect(chatCompletionsUrl("https://api.deepseek.com")).toBe(
      "https://api.deepseek.com/chat/completions",
    );
  });

  it("keeps temperature and json_object on native DeepSeek", () => {
    delete process.env.DEEPSEEK_DROP_PARAMS;
    const baseUrl = "https://api.deepseek.com";
    const model = "deepseek-chat";
    expect(shouldDropBedrockParams(baseUrl, model)).toBe(false);
    const body = buildDeepSeekChatBody({
      model,
      baseUrl,
      messages: [{ role: "user", content: "oi" }],
      temperature: 0.3,
    });
    expect(body.model).toBe("deepseek-chat");
    expect(body.temperature).toBe(0.3);
    expect(body.response_format).toEqual({ type: "json_object" });
  });

  it("honors DEEPSEEK_DROP_PARAMS override", () => {
    process.env.DEEPSEEK_DROP_PARAMS = "1";
    expect(shouldDropBedrockParams("https://api.deepseek.com", "deepseek-chat")).toBe(
      true,
    );
    process.env.DEEPSEEK_DROP_PARAMS = "0";
    expect(
      shouldDropBedrockParams("https://litellm.cge.ce.gov.br", "deepseek.v3.2"),
    ).toBe(false);
  });

  it("strips markdown fences and isolates JSON", () => {
    expect(stripJsonFence('```json\n{"a":1}\n```')).toBe('{"a":1}');
    expect(extractJsonText('\n\n{"message":"ok"}')).toBe('{"message":"ok"}');
  });

  it("reads reasoning_content when message content is empty", () => {
    expect(messageText({ content: "", reasoning_content: '{"a":1}' })).toBe(
      '{"a":1}',
    );
  });
});

function restore(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
