import { NextResponse } from "next/server";
import { getInvite, isInviteValid, recordInviteAcceptance } from "@/lib/invites";
import { createUser } from "@/lib/users";
import { applyInviteJoin } from "@/lib/team-invite-server";
import { assertBodySize, checkRateLimit } from "@/lib/api-security";

function clientKey(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "local"
  );
}

export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const limited = checkRateLimit(`invite-register:${clientKey(request)}`, 8, 10 * 60_000);
  if (!limited.ok) return limited.response;

  const { token } = await context.params;
  const raw = await request.text();
  const sizeCheck = assertBodySize(raw, 10_000);
  if (!sizeCheck.ok) return sizeCheck.response;

  let body: { name?: string; username?: string; password?: string; email?: string };
  try {
    body = JSON.parse(raw) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const invite = await getInvite(token);
  if (!invite) {
    return NextResponse.json({ error: "Convite não encontrado." }, { status: 404 });
  }

  const validity = isInviteValid(invite, body.email || invite.inviteeEmail || undefined);
  if (!validity.ok) {
    return NextResponse.json({ error: validity.error }, { status: 400 });
  }

  if (invite.inviteeEmail && body.email && invite.inviteeEmail !== body.email.trim().toLowerCase()) {
    return NextResponse.json(
      { error: "Este convite é exclusivo para outro e-mail." },
      { status: 400 },
    );
  }

  const created = await createUser({
    name: body.name || "",
    username: body.username,
    email: invite.inviteeEmail || body.email,
    password: body.password || "",
    role: "user",
  });
  if (!created.ok) {
    return NextResponse.json({ error: created.error }, { status: 400 });
  }

  const joined = await applyInviteJoin(invite, {
    name: created.user.name,
    email: created.user.email,
  });
  if (!joined.ok) {
    return NextResponse.json({ error: joined.error }, { status: 404 });
  }

  await recordInviteAcceptance(token, created.user.email);

  return NextResponse.json({
    ok: true,
    username: created.user.username,
    email: created.user.email,
    boardId: joined.boardId,
    boardIds: joined.boardIds,
    teamId: invite.teamId,
    teamName: invite.teamName,
    snapshots: joined.snapshots,
    profile: {
      name: created.user.name,
      email: created.user.email,
      image: null,
    },
  });
}
