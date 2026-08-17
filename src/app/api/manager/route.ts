import { NextResponse } from "next/server";
import {
  localManagerProcess,
  openAiManagerProcess,
  type ManagerContext,
} from "@/lib/manager";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { context?: ManagerContext };
    if (!body.context) {
      return NextResponse.json({ error: "Contexto ausente." }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      try {
        const result = await openAiManagerProcess(body.context, apiKey);
        return NextResponse.json(result);
      } catch (error) {
        const fallback = localManagerProcess(body.context);
        return NextResponse.json({
          ...fallback,
          message: `${fallback.message}\n\n(Nota: OpenAI falhou — usei o gestor local. ${
            error instanceof Error ? error.message : ""
          })`,
        });
      }
    }

    return NextResponse.json(localManagerProcess(body.context));
  } catch {
    return NextResponse.json({ error: "Falha ao processar daily." }, { status: 500 });
  }
}
