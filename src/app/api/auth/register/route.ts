import { NextResponse } from "next/server";
import { createUser } from "@/lib/users";
import { checkRateLimit, assertBodySize } from "@/lib/api-security";

export async function POST(request: Request) {
  const raw = await request.text();
  const sizeCheck = assertBodySize(raw, 10_000);
  if (!sizeCheck.ok) return sizeCheck.response;

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "register";
  const rate = checkRateLimit(`register:${ip}`, 8, 3600_000);
  if (!rate.ok) return rate.response;

  let body: { email?: string; name?: string; password?: string };
  try {
    body = JSON.parse(raw) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const result = await createUser({
    email: body.email ?? "",
    name: body.name ?? "",
    password: body.password ?? "",
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ user: result.user }, { status: 201 });
}
