import { NextResponse } from "next/server";
import { getInvite, isInviteValid } from "@/lib/invites";
import { getSharedBoard } from "@/lib/shared-boards";

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const invite = getInvite(token);
  if (!invite) {
    return NextResponse.json({ error: "Convite não encontrado." }, { status: 404 });
  }

  const validity = isInviteValid(invite);
  const snapshot = await getSharedBoard(invite.boardId);

  return NextResponse.json({
    token: invite.token,
    boardId: invite.boardId,
    boardTitle: invite.boardTitle,
    createdByName: invite.createdByName,
    inviteeEmail: invite.inviteeEmail,
    expiresAt: invite.expiresAt,
    valid: validity.ok,
    error: validity.ok ? null : validity.error,
    hasSnapshot: Boolean(snapshot),
  });
}
