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
import { checkRateLimit, requireSession, assertBodySize } from "@/lib/api-security";

export async function POST(request: Request) {
  const { session, error } = await requireSession();
  if (error) return error;

  const raw = await request.text();
  const sizeCheck = assertBodySize(raw, 800_000);
  if (!sizeCheck.ok) return sizeCheck.response;

  const rate = checkRateLimit(`manager:${session!.user!.email}`, 25, 60_000);
  if (!rate.ok) return rate.response;

  try {
    const body = JSON.parse(raw) as {
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
        } catch (err) {
          const fallback = localStandupTurn(body.standup);
          return NextResponse.json({
            ...fallback,
            message: `${fallback.message}\n\n(Nota: DeepSeek falhou — usei o gestor local. ${
              err instanceof Error ? err.message : ""
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
        } catch (err) {
          const fallback = localManagerChat(userMessage, body.context);
          return NextResponse.json({
            ...fallback,
            message: `${fallback.message}\n\n(Nota: DeepSeek falhou — usei o gestor local. ${
              err instanceof Error ? err.message : ""
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
      } catch (err) {
        const fallback = localManagerProcess(body.context);
        return NextResponse.json({
          ...fallback,
          message: `${fallback.message}\n\n(Nota: DeepSeek falhou — usei o gestor local. ${
            err instanceof Error ? err.message : ""
          })`,
        });
      }
    }

    return NextResponse.json(localManagerProcess(body.context));
  } catch {
    return NextResponse.json({ error: "Falha ao processar gestor." }, { status: 500 });
  }
}
