import { NextResponse } from "next/server";
import { createUser, ensureDefaultAdmin, listUsers, type UserRole } from "@/lib/users";
import { assertBodySize, checkRateLimit, requireAdmin } from "@/lib/api-security";

export async function GET() {
  await ensureDefaultAdmin();
  const { error } = await requireAdmin();
  if (error) return error;
  const users = await listUsers();
  return NextResponse.json({ users });
}

export async function POST(request: Request) {
  await ensureDefaultAdmin();
  const { error } = await requireAdmin();
  if (error) return error;

  const raw = await request.text();
  const sizeCheck = assertBodySize(raw, 10_000);
  if (!sizeCheck.ok) return sizeCheck.response;

  const rate = checkRateLimit("admin-users", 30, 3600_000);
  if (!rate.ok) return rate.response;

  let body: { email?: string; username?: string; name?: string; password?: string; role?: UserRole };
  try {
    body = JSON.parse(raw) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const result = await createUser({
    email: body.email ?? "",
    username: body.username ?? "",
    name: body.name ?? "",
    password: body.password ?? "",
    role: body.role === "admin" ? "admin" : "user",
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ user: result.user }, { status: 201 });
}
