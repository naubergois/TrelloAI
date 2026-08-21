import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getInvite, isInviteValid, markInviteUsed } from "@/lib/invites";
import { addMembership, getSharedBoard } from "@/lib/shared-boards";

export async function POST(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Faça login ou cadastre-se primeiro." }, { status: 401 });
  }

  const { token } = await context.params;
  const invite = getInvite(token);
  if (!invite) {
    return NextResponse.json({ error: "Convite não encontrado." }, { status: 404 });
  }

  const validity = isInviteValid(invite);
  if (!validity.ok) {
    return NextResponse.json({ error: validity.error }, { status: 400 });
  }

  const email = session.user.email.trim().toLowerCase();
  if (invite.inviteeEmail && invite.inviteeEmail !== email) {
    return NextResponse.json(
      { error: "Este convite é exclusivo para outro e-mail." },
      { status: 403 },
    );
  }

  const snapshot = getSharedBoard(invite.boardId);
  if (!snapshot) {
    return NextResponse.json(
      { error: "Board do convite não está disponível no servidor. Peça um novo convite." },
      { status: 404 },
    );
  }

  addMembership(email, invite.boardId);
  markInviteUsed(token, email);

  return NextResponse.json({
    boardId: invite.boardId,
    boardTitle: invite.boardTitle,
    snapshot,
    profile: {
      name: session.user.name || email.split("@")[0],
      email,
      image: session.user.image ?? null,
    },
  });
}
