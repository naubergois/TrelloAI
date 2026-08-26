import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { assertBodySize, checkRateLimit } from "@/lib/api-security";
import { setVisibleBoards } from "@/lib/shared-boards";
import { withoutSharedMayaLogs } from "@/lib/board-snapshot";
import { listMayaChatsForUser } from "@/lib/maya-chat-store";

async function save(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const raw = await request.text();
  const sizeCheck = assertBodySize(raw, 50_000);
  if (!sizeCheck.ok) return sizeCheck.response;

  const rate = checkRateLimit(`board-visibility:${session.user.email}`, 40, 60_000);
  if (!rate.ok) return rate.response;

  let body: { boardIds?: unknown };
  try {
    body = JSON.parse(raw) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  if (!Array.isArray(body.boardIds) || body.boardIds.some((id) => typeof id !== "string")) {
    return NextResponse.json({ error: "Informe a lista de boards." }, { status: 400 });
  }

  try {
    const result = await setVisibleBoards(
      session.user.email,
      body.boardIds,
      session.user.role === "admin",
    );
    return NextResponse.json({
      ok: true,
      boardIds: result.boardIds,
      snapshots: result.snapshots.map(withoutSharedMayaLogs),
      mayaLogs: await listMayaChatsForUser(session.user.email, {
        legacyByBoard: Object.fromEntries(
          result.snapshots.map((snapshot) => [snapshot.board.id, snapshot.mayaLogs]),
        ),
      }),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao salvar a escolha.";
    console.error("[boards/visibility]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  return save(request);
}

export async function POST(request: Request) {
  return save(request);
}
