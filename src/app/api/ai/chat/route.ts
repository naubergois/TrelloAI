import { NextResponse } from "next/server";
import { deepSeekChatCompletions } from "@/lib/deepseek";
import { checkRateLimit, requireSession, assertBodySize } from "@/lib/api-security";
import {
  aiToolSystemPrompt,
  localAiToolRespond,
  parseAiToolResponse,
  type AiToolChatResponse,
  type AiToolContext,
} from "@/lib/ai-tools";

type ChatTurn = { role: "user" | "assistant"; content: string };

export async function POST(request: Request) {
  const { session, error } = await requireSession();
  if (error) return error;

  const raw = await request.text();
  const sizeCheck = assertBodySize(raw, 500_000);
  if (!sizeCheck.ok) return sizeCheck.response;

  const rate = checkRateLimit(`ai-chat:${session!.user!.email}`, 30, 60_000);
  if (!rate.ok) return rate.response;

  try {
    const body = JSON.parse(raw) as {
      prompt?: string;
      messages?: ChatTurn[];
      context?: AiToolContext;
    };

    const prompt = body.prompt?.trim() || "";
    if (!prompt) {
      return NextResponse.json({ error: "Prompt vazio." }, { status: 400 });
    }

    const context = body.context;
    if (!context?.boardId) {
      return NextResponse.json({ error: "Contexto do board ausente." }, { status: 400 });
    }

    const history = (body.messages || [])
      .filter((m) => m.content?.trim())
      .slice(-8)
      .map((m) => ({
        role: m.role,
        content: m.content.slice(0, 4000),
      }));

    const deepSeekKey = process.env.DEEPSEEK_API_KEY;
    if (deepSeekKey) {
      try {
        const cleaned = await deepSeekChatCompletions({
          apiKey: deepSeekKey,
          temperature: 0.3,
          messages: [
            { role: "system", content: aiToolSystemPrompt(context) },
            ...history,
            { role: "user", content: prompt },
          ],
        });
        const parsed = parseAiToolResponse(cleaned);
        const result: AiToolChatResponse = {
          ...parsed,
          provider: "deepseek",
        };
        return NextResponse.json(result);
      } catch (err) {
        const fallback = localAiToolRespond(prompt, context);
        return NextResponse.json({
          ...fallback,
          message: `${fallback.message}\n\n(Nota: DeepSeek falhou — usei o assistente local. ${
            err instanceof Error ? err.message : ""
          })`,
        });
      }
    }

    const openAiKey = process.env.OPENAI_API_KEY;
    if (openAiKey) {
      try {
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${openAiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: process.env.OPENAI_MODEL || "gpt-4o-mini",
            temperature: 0.3,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: aiToolSystemPrompt(context) },
              ...history,
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
        const parsed = parseAiToolResponse(content);
        return NextResponse.json({ ...parsed, provider: "openai" } satisfies AiToolChatResponse);
      } catch (err) {
        const fallback = localAiToolRespond(prompt, context);
        return NextResponse.json({
          ...fallback,
          message: `${fallback.message}\n\n(Nota: OpenAI falhou — usei o assistente local. ${
            err instanceof Error ? err.message : ""
          })`,
        });
      }
    }

    return NextResponse.json(localAiToolRespond(prompt, context));
  } catch {
    return NextResponse.json({ error: "Falha ao processar o chat de IA." }, { status: 500 });
  }
}
