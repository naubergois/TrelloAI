import { NextResponse } from "next/server";
import { ensureDefaultAdmin, updateUser, type UserRole } from "@/lib/users";
import { assertBodySize, checkRateLimit, requireAdmin } from "@/lib/api-security";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  await ensureDefaultAdmin();
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await context.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "Usuário inválido." }, { status: 400 });
  }

  const raw = await request.text();
  const sizeCheck = assertBodySize(raw, 10_000);
  if (!sizeCheck.ok) return sizeCheck.response;

  const rate = checkRateLimit("admin-users", 30, 3600_000);
  if (!rate.ok) return rate.response;

  let body: {
    email?: string;
    username?: string;
    name?: string;
    password?: string;
    role?: UserRole;
  };
  try {
    body = JSON.parse(raw) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const result = await updateUser(id, {
    email: body.email,
    username: body.username,
    name: body.name,
    password: body.password,
    role: body.role,
  });

  if (!result.ok) {
    const status = result.error === "Usuário não encontrado." ? 404 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ user: result.user });
}
