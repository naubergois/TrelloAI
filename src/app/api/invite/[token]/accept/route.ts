import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getInvite, isInviteValid, recordInviteAcceptance } from "@/lib/invites";
import { applyInviteJoin } from "@/lib/team-invite-server";

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

  const joined = await applyInviteJoin(invite, {
    name: session.user.name || email.split("@")[0],
    email,
    image: session.user.image ?? null,
  });
  if (!joined.ok) {
    return NextResponse.json({ error: joined.error }, { status: 404 });
  }

  await recordInviteAcceptance(token, email);

  return NextResponse.json({
    boardId: joined.boardId,
    boardIds: joined.boardIds,
    boardTitle: invite.kind === "team" ? invite.teamName || invite.boardTitle : invite.boardTitle,
    teamId: invite.teamId,
    teamName: invite.teamName,
    snapshots: joined.snapshots,
    snapshot: joined.snapshots.find((s) => s.board.id === joined.boardId) || joined.snapshots[0],
    profile: {
      name: session.user.name || email.split("@")[0],
      email,
      image: session.user.image ?? null,
    },
  });
}
