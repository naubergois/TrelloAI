import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { assertBodySize, checkRateLimit } from "@/lib/api-security";
import { emailHasBoardAccess, getSharedBoard } from "@/lib/shared-boards";
import {
  isMayaChatDate,
  mayaDayLogId,
  MAYA_CHAT_ID_MAX,
  mayaLogsRecord,
  normalizeMayaDayLog,
} from "@/lib/maya-chat";
import {
  deleteMayaDayChatForUser,
  listMayaChatsForUser,
  saveMayaChatsForUser,
  saveMayaDayChatForUser,
} from "@/lib/maya-chat-store";
import type { MayaDayLog } from "@/lib/types";

async function requireBoardAccess(boardId: string) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return {
      ok: false as const,
      error: NextResponse.json({ error: "Não autenticado." }, { status: 401 }),
    };
  }
  const isAdmin = session.user.role === "admin";
  if (!isAdmin && !(await emailHasBoardAccess(email, boardId))) {
    return {
      ok: false as const,
      error: NextResponse.json({ error: "Sem acesso a este board." }, { status: 403 }),
    };
  }
  return { ok: true as const, email };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ boardId: string }> },
) {
  const { boardId } = await context.params;
  const access = await requireBoardAccess(boardId);
  if (!access.ok) return access.error;

  const snapshot = await getSharedBoard(boardId);
  const mayaLogs = await listMayaChatsForUser(access.email, {
    boardId,
    legacyLogs: snapshot?.mayaLogs,
  });
  return NextResponse.json({ mayaLogs });
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ boardId: string }> },
) {
  const { boardId } = await context.params;
  const access = await requireBoardAccess(boardId);
  if (!access.ok) return access.error;

  const email = access.email;
  const limited = checkRateLimit(`maya-chat:${email}:${boardId}`, 40, 60_000);
  if (!limited.ok) return limited.response;

  const raw = await request.text();
  const sizeCheck = assertBodySize(raw, 400_000);
  if (!sizeCheck.ok) return sizeCheck.response;

  let body: { logs?: unknown; date?: unknown; messages?: unknown };
  try {
    body = JSON.parse(raw) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const incoming: MayaDayLog[] = [];
  if (Array.isArray(body.logs)) {
    incoming.push(...Object.values(mayaLogsRecord(body.logs as MayaDayLog[])));
  } else if (typeof body.date === "string" && isMayaChatDate(body.date)) {
    const msgs = Array.isArray(body.messages) ? body.messages : [];
    if (msgs.length === 0) {
      await deleteMayaDayChatForUser(email, boardId, body.date);
      const mayaLogs = await listMayaChatsForUser(email, { boardId });
      return NextResponse.json({ ok: true, mayaLogs });
    }
    const log = normalizeMayaDayLog(boardId, body.date, msgs);
    if (log) incoming.push(log);
  }

  const forBoard = incoming.filter((log) => log.boardId === boardId);
  if (forBoard.length === 0 && !Array.isArray(body.logs)) {
    return NextResponse.json({ error: "Informe as mensagens do chat." }, { status: 400 });
  }

  await saveMayaChatsForUser(email, forBoard);
  const mayaLogs = await listMayaChatsForUser(email, { boardId });
  return NextResponse.json({ ok: true, mayaLogs });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ boardId: string }> },
) {
  const { boardId } = await context.params;
  const access = await requireBoardAccess(boardId);
  if (!access.ok) return access.error;

  const email = access.email;
  const limited = checkRateLimit(`maya-chat-del:${email}:${boardId}`, 40, 60_000);
  if (!limited.ok) return limited.response;

  const url = new URL(request.url);
  const date = String(url.searchParams.get("date") || "").trim();
  const messageId = String(url.searchParams.get("messageId") || "")
    .trim()
    .slice(0, MAYA_CHAT_ID_MAX);
  if (!isMayaChatDate(date)) {
    return NextResponse.json({ error: "Informe a data da conversa." }, { status: 400 });
  }

  if (messageId) {
    const logs = await listMayaChatsForUser(email, { boardId });
    const log = logs[mayaDayLogId(boardId, date)];
    if (log) {
      const remaining = log.messages.filter((msg) => msg.id !== messageId);
      if (remaining.length === 0) {
        await deleteMayaDayChatForUser(email, boardId, date);
      } else {
        await saveMayaDayChatForUser(email, {
          ...log,
          messages: remaining,
          updatedAt: new Date().toISOString(),
        });
      }
    }
  } else {
    await deleteMayaDayChatForUser(email, boardId, date);
  }

  const mayaLogs = await listMayaChatsForUser(email, { boardId });
  return NextResponse.json({ ok: true, mayaLogs });
}
