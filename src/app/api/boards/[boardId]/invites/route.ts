import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createInvite, listInvitesForBoard } from "@/lib/invites";
import { addMembership, saveSharedBoard, type BoardSnapshot } from "@/lib/shared-boards";

export async function GET(
  _request: Request,
  context: { params: Promise<{ boardId: string }> },
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const { boardId } = await context.params;
  const invites = listInvitesForBoard(boardId).filter((i) => !i.usedAt);
  return NextResponse.json({
    invites: invites.map((i) => ({
      token: i.token,
      boardTitle: i.boardTitle,
      inviteeEmail: i.inviteeEmail,
      expiresAt: i.expiresAt,
      createdAt: i.createdAt,
      urlPath: `/invite/${i.token}`,
    })),
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ boardId: string }> },
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { boardId } = await context.params;
  let body: { snapshot?: BoardSnapshot; inviteeEmail?: string | null; boardTitle?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  if (!body.snapshot?.board || body.snapshot.board.id !== boardId) {
    return NextResponse.json({ error: "Snapshot do board obrigatório." }, { status: 400 });
  }

  saveSharedBoard(body.snapshot);
  addMembership(session.user.email, boardId);

  const invite = createInvite({
    boardId,
    boardTitle: body.boardTitle || body.snapshot.board.title,
    createdByEmail: session.user.email,
    createdByName: session.user.name || "Admin",
    inviteeEmail: body.inviteeEmail || null,
  });

  return NextResponse.json({
    token: invite.token,
    expiresAt: invite.expiresAt,
    urlPath: `/invite/${invite.token}`,
  });
}
