import { NextResponse } from "next/server";
import { getInvite, isInviteValid } from "@/lib/invites";
import { snapshotsForInvite } from "@/lib/team-invite-server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const invite = await getInvite(token);
  if (!invite) {
    return NextResponse.json({ error: "Convite não encontrado." }, { status: 404 });
  }

  const validity = isInviteValid(invite);
  const snapshots = await snapshotsForInvite(invite);

  return NextResponse.json({
    token: invite.token,
    boardId: invite.boardId,
    boardTitle: invite.kind === "team" ? invite.teamName || invite.boardTitle : invite.boardTitle,
    createdByName: invite.createdByName,
    inviteeEmail: invite.inviteeEmail,
    expiresAt: invite.expiresAt,
    kind: invite.kind || "board",
    teamId: invite.teamId,
    teamName: invite.teamName,
    valid: validity.ok,
    error: validity.ok ? null : validity.error,
    hasSnapshot: snapshots.length > 0,
    canRegister: validity.ok,
  });
}
