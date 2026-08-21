import { NextResponse } from "next/server";
import {
  deepSeekManagerProcess,
  deepSeekStandupTurn,
  localManagerChat,
  localManagerProcess,
  localStandupTurn,
  type ManagerContext,
  type StandupTurnInput,
} from "@/lib/manager";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      context?: ManagerContext;
      mode?: "daily" | "chat" | "standup";
      message?: string;
      standup?: StandupTurnInput;
    };

    const mode = body.mode || "daily";
    const apiKey = process.env.DEEPSEEK_API_KEY;

    if (mode === "standup") {
      if (!body.standup?.userReply?.trim()) {
        return NextResponse.json({ error: "Resposta da daily ausente." }, { status: 400 });
      }
      if (apiKey) {
        try {
          const result = await deepSeekStandupTurn(body.standup, apiKey);
          return NextResponse.json(result);
        } catch (error) {
          const fallback = localStandupTurn(body.standup);
          return NextResponse.json({
            ...fallback,
            message: `${fallback.message}\n\n(Nota: DeepSeek falhou — usei o gestor local. ${
              error instanceof Error ? error.message : ""
            })`,
          });
        }
      }
      return NextResponse.json(localStandupTurn(body.standup));
    }

    if (!body.context) {
      return NextResponse.json({ error: "Contexto ausente." }, { status: 400 });
    }

    if (mode === "chat") {
      const userMessage = body.message?.trim() || "";
      if (!userMessage) {
        return NextResponse.json({ error: "Mensagem ausente." }, { status: 400 });
      }
      if (apiKey) {
        try {
          const result = await deepSeekManagerProcess(body.context, apiKey, {
            mode: "chat",
            userMessage,
          });
          return NextResponse.json(result);
        } catch (error) {
          const fallback = localManagerChat(userMessage, body.context);
          return NextResponse.json({
            ...fallback,
            message: `${fallback.message}\n\n(Nota: DeepSeek falhou — usei o gestor local. ${
              error instanceof Error ? error.message : ""
            })`,
          });
        }
      }
      return NextResponse.json(localManagerChat(userMessage, body.context));
    }

    if (apiKey) {
      try {
        const result = await deepSeekManagerProcess(body.context, apiKey, { mode: "daily" });
        return NextResponse.json(result);
      } catch (error) {
        const fallback = localManagerProcess(body.context);
        return NextResponse.json({
          ...fallback,
          message: `${fallback.message}\n\n(Nota: DeepSeek falhou — usei o gestor local. ${
            error instanceof Error ? error.message : ""
          })`,
        });
      }
    }

    return NextResponse.json(localManagerProcess(body.context));
  } catch {
    return NextResponse.json({ error: "Falha ao processar gestor." }, { status: 500 });
  }
}
