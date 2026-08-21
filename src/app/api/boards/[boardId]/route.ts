import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  addMembership,
  emailHasBoardAccess,
  getSharedBoard,
  saveSharedBoard,
  type BoardSnapshot,
} from "@/lib/shared-boards";

export async function GET(
  _request: Request,
  context: { params: Promise<{ boardId: string }> },
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const { boardId } = await context.params;
  const snapshot = getSharedBoard(boardId);
  if (!snapshot) {
    return NextResponse.json({ error: "Board compartilhado não encontrado." }, { status: 404 });
  }
  if (!emailHasBoardAccess(session.user.email, boardId)) {
    // allow owner email that created invites via membership add on create
    return NextResponse.json({ error: "Sem acesso a este board." }, { status: 403 });
  }
  return NextResponse.json({ snapshot });
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ boardId: string }> },
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const { boardId } = await context.params;
  let body: { snapshot?: BoardSnapshot };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }
  if (!body.snapshot?.board || body.snapshot.board.id !== boardId) {
    return NextResponse.json({ error: "Snapshot inválido." }, { status: 400 });
  }

  saveSharedBoard(body.snapshot);
  addMembership(session.user.email, boardId);
  return NextResponse.json({ ok: true, updatedAt: body.snapshot.updatedAt });
}
