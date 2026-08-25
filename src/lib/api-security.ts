import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { assertBodySize, checkRateLimit } from "@/lib/rate-limit";

export async function requireSession() {
  const session = await auth();
  if (!session?.user?.email) {
    return {
      session: null,
      error: NextResponse.json({ error: "Não autenticado." }, { status: 401 }),
    };
  }
  return { session, error: null };
}

export async function requireAdmin() {
  const { session, error } = await requireSession();
  if (error || !session) return { session: null, error };
  if (session.user.role !== "admin") {
    return {
      session,
      error: NextResponse.json({ error: "Acesso restrito ao administrador." }, { status: 403 }),
    };
  }
  return { session, error: null };
}

export function allowLocalBypass() {
  return (
    process.env.ALLOW_LOCAL_BYPASS === "1" ||
    process.env.NODE_ENV !== "production"
  );
}

export { checkRateLimit, assertBodySize };
