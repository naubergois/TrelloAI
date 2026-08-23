import { NextResponse } from "next/server";
import {
  deepSeekRespond,
  localAiRespond,
  openAiRespond,
  type AiRequestContext,
} from "@/lib/ai";
import { checkRateLimit, requireSession, assertBodySize } from "@/lib/api-security";

export async function POST(request: Request) {
  const { session, error } = await requireSession();
  if (error) return error;

  const raw = await request.text();
  const sizeCheck = assertBodySize(raw, 500_000);
  if (!sizeCheck.ok) return sizeCheck.response;

  const rate = checkRateLimit(`ai:${session!.user!.email}`, 30, 60_000);
  if (!rate.ok) return rate.response;

  try {
    const body = JSON.parse(raw) as {
      prompt?: string;
      context?: AiRequestContext;
    };

    const prompt = body.prompt?.trim();
    if (!prompt) {
      return NextResponse.json({ error: "Prompt vazio." }, { status: 400 });
    }

    const context: AiRequestContext = body.context ?? {
      boardTitle: "Board",
      lists: [],
    };

    const deepSeekKey = process.env.DEEPSEEK_API_KEY;
    if (deepSeekKey) {
      try {
        const result = await deepSeekRespond(prompt, context, deepSeekKey);
        return NextResponse.json(result);
      } catch (err) {
        const fallback = localAiRespond(prompt, context);
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
        const result = await openAiRespond(prompt, context, openAiKey);
        return NextResponse.json(result);
      } catch (err) {
        const fallback = localAiRespond(prompt, context);
        return NextResponse.json({
          ...fallback,
          message: `${fallback.message}\n\n(Nota: OpenAI falhou — usei o assistente local. ${
            err instanceof Error ? err.message : ""
          })`,
        });
      }
    }

    return NextResponse.json(localAiRespond(prompt, context));
  } catch {
    return NextResponse.json({ error: "Falha ao processar IA." }, { status: 500 });
  }
}
