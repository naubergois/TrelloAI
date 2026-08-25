import { afterEach, describe, expect, it } from "vitest";
import {
  buildDeepSeekChatBody,
  shouldDropBedrockParams,
  stripJsonFence,
} from "./deepseek";

describe("LiteLLM / Bedrock params", () => {
  const prev = {
    drop: process.env.DEEPSEEK_DROP_PARAMS,
    model: process.env.DEEPSEEK_MODEL,
    base: process.env.DEEPSEEK_BASE_URL,
  };

  afterEach(() => {
    if (prev.drop === undefined) delete process.env.DEEPSEEK_DROP_PARAMS;
    else process.env.DEEPSEEK_DROP_PARAMS = prev.drop;
    if (prev.model === undefined) delete process.env.DEEPSEEK_MODEL;
    else process.env.DEEPSEEK_MODEL = prev.model;
    if (prev.base === undefined) delete process.env.DEEPSEEK_BASE_URL;
    else process.env.DEEPSEEK_BASE_URL = prev.base;
  });

  it("drops temperature and response_format for LiteLLM CGE", () => {
    delete process.env.DEEPSEEK_DROP_PARAMS;
    const baseUrl = "https://litellm.cge.ce.gov.br";
    const model = "deepseek.v3.2";
    expect(shouldDropBedrockParams(baseUrl, model)).toBe(true);
    const body = buildDeepSeekChatBody({
      model,
      baseUrl,
      messages: [{ role: "user", content: "oi" }],
      temperature: 0.4,
    });
    expect(body).toEqual({
      model,
      messages: [{ role: "user", content: "oi" }],
    });
    expect(body).not.toHaveProperty("temperature");
    expect(body).not.toHaveProperty("response_format");
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

  it("strips markdown fences from model output", () => {
    expect(stripJsonFence('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });
});
