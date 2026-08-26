import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createInvite } from "@/lib/invites";
import { addMembership, saveSharedBoard, type BoardSnapshot } from "@/lib/shared-boards";
import { attachTeamToSnapshot } from "@/lib/team-ops";
import type { Team } from "@/lib/types";
import { assertBodySize } from "@/lib/api-security";

export async function POST(
  request: Request,
  context: { params: Promise<{ teamId: string }> },
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { teamId } = await context.params;
  const raw = await request.text();
  const sizeCheck = assertBodySize(raw, 2_000_000);
  if (!sizeCheck.ok) return sizeCheck.response;

  let body: {
    team?: Team;
    snapshots?: BoardSnapshot[];
    inviteeEmail?: string | null;
  };
  try {
    body = JSON.parse(raw) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  if (!body.team?.id || body.team.id !== teamId) {
    return NextResponse.json({ error: "Dados da equipe obrigatórios." }, { status: 400 });
  }
  if (!Array.isArray(body.snapshots) || body.snapshots.length === 0) {
    return NextResponse.json(
      { error: "Crie ou vincule um board para gerar o link da equipe." },
      { status: 400 },
    );
  }

  const snapshots = body.snapshots
    .filter((s) => s?.board?.id)
    .map((s) => attachTeamToSnapshot(s, body.team!));
  if (snapshots.length === 0) {
    return NextResponse.json({ error: "Snapshot do board inválido." }, { status: 400 });
  }

  for (const snapshot of snapshots) {
    await saveSharedBoard(snapshot);
    await addMembership(session.user.email, snapshot.board.id);
  }

  const anchor = snapshots.find((s) => s.board.teamId === teamId) || snapshots[0];
  const invite = await createInvite({
    boardId: anchor.board.id,
    boardTitle: body.team.name,
    createdByEmail: session.user.email,
    createdByName: session.user.name || "Admin",
    inviteeEmail: body.inviteeEmail || null,
    daysValid: 30,
    kind: "team",
    teamId,
    teamName: body.team.name,
  });

  return NextResponse.json({
    token: invite.token,
    expiresAt: invite.expiresAt,
    urlPath: `/invite/${invite.token}`,
    teamName: body.team.name,
  });
}
