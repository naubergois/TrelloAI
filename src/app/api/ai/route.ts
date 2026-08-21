import { NextResponse } from "next/server";
import {
  deepSeekRespond,
  localAiRespond,
  openAiRespond,
  type AiRequestContext,
} from "@/lib/ai";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
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
      } catch (error) {
        const fallback = localAiRespond(prompt, context);
        return NextResponse.json({
          ...fallback,
          message: `${fallback.message}\n\n(Nota: DeepSeek falhou — usei o assistente local. ${
            error instanceof Error ? error.message : ""
          })`,
        });
      }
    }

    const openAiKey = process.env.OPENAI_API_KEY;
    if (openAiKey) {
      try {
        const result = await openAiRespond(prompt, context, openAiKey);
        return NextResponse.json(result);
      } catch (error) {
        const fallback = localAiRespond(prompt, context);
        return NextResponse.json({
          ...fallback,
          message: `${fallback.message}\n\n(Nota: OpenAI falhou — usei o assistente local. ${
            error instanceof Error ? error.message : ""
          })`,
        });
      }
    }

    return NextResponse.json(localAiRespond(prompt, context));
  } catch {
    return NextResponse.json({ error: "Falha ao processar IA." }, { status: 500 });
  }
}
