import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { deleteTeamFromAllSnapshots } from "@/lib/team-invite-server";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ teamId: string }> },
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { teamId } = await context.params;
  if (!teamId.trim()) {
    return NextResponse.json({ error: "Equipe inválida." }, { status: 400 });
  }

  const result = await deleteTeamFromAllSnapshots(teamId, session.user.email);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, boardIds: result.boardIds });
}
