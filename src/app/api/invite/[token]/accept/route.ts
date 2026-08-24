import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getInvite, isInviteValid, recordInviteAcceptance } from "@/lib/invites";
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
  const invite = await getInvite(token);
  if (!invite) {
    return NextResponse.json({ error: "Convite não encontrado." }, { status: 404 });
  }

  const email = session.user.email.trim().toLowerCase();
  const validity = isInviteValid(invite, email);
  if (!validity.ok) {
    return NextResponse.json({ error: validity.error }, { status: 400 });
  }

  const snapshot = await getSharedBoard(invite.boardId);
  if (!snapshot) {
    return NextResponse.json(
      { error: "Board do convite não está disponível no servidor. Peça um novo convite." },
      { status: 404 },
    );
  }

  await addMembership(email, invite.boardId);
  await recordInviteAcceptance(token, email);

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
