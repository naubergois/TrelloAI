import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  addMembership,
  addVisibleBoard,
  deleteSharedBoard,
  emailHasBoardAccess,
  getSharedBoard,
  saveSharedBoard,
  type BoardSnapshot,
} from "@/lib/shared-boards";
import { assertBodySize } from "@/lib/api-security";
import { mergeSnapshotAttachments } from "@/lib/card-attachments";
import { withoutSharedMayaLogs, withPreservedMayaLogs } from "@/lib/board-snapshot";
import { listMayaChatsForUser } from "@/lib/maya-chat-store";

export async function GET(
  _request: Request,
  context: { params: Promise<{ boardId: string }> },
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const { boardId } = await context.params;
  const snapshot = await getSharedBoard(boardId);
  if (!snapshot) {
    return NextResponse.json({ error: "Board compartilhado não encontrado." }, { status: 404 });
  }
  const isAdmin = session.user.role === "admin";
  if (!isAdmin && !(await emailHasBoardAccess(session.user.email, boardId))) {
    return NextResponse.json({ error: "Sem acesso a este board." }, { status: 403 });
  }
  const mayaLogs = await listMayaChatsForUser(session.user.email, {
    boardId,
    legacyLogs: snapshot.mayaLogs,
  });
  return NextResponse.json({ snapshot: withoutSharedMayaLogs(snapshot), mayaLogs });
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
  const raw = await request.text();
  const sizeCheck = assertBodySize(raw);
  if (!sizeCheck.ok) return sizeCheck.response;

  let body: { snapshot?: BoardSnapshot };
  try {
    body = JSON.parse(raw) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }
  if (!body.snapshot?.board || body.snapshot.board.id !== boardId) {
    return NextResponse.json({ error: "Snapshot inválido." }, { status: 400 });
  }

  const existing = await getSharedBoard(boardId);
  const isAdmin = session.user.role === "admin";
  if (existing && !isAdmin && !(await emailHasBoardAccess(session.user.email, boardId))) {
    return NextResponse.json({ error: "Sem acesso a este board." }, { status: 403 });
  }

  await saveSharedBoard(
    withPreservedMayaLogs(mergeSnapshotAttachments(existing, body.snapshot), existing),
  );
  await addMembership(session.user.email, boardId);
  await addVisibleBoard(session.user.email, boardId);
  return NextResponse.json({ ok: true, updatedAt: body.snapshot.updatedAt });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ boardId: string }> },
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const { boardId } = await context.params;
  const isAdmin = session.user.role === "admin";
  if (!isAdmin && !(await emailHasBoardAccess(session.user.email, boardId))) {
    const snapshot = await getSharedBoard(boardId);
    if (snapshot) {
      return NextResponse.json({ error: "Sem acesso a este board." }, { status: 403 });
    }
  }
  await deleteSharedBoard(boardId);
  return NextResponse.json({ ok: true });
}
