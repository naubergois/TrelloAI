import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-security";
import { runMayaGitJob } from "@/lib/maya-git-job";

function cronAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = request.headers.get("authorization") || "";
  return header === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  if (!cronAuthorized(request)) {
    const admin = await requireAdmin();
    if (admin.error) return admin.error;
  }

  const url = new URL(request.url);
  const force = url.searchParams.get("force") === "1";
  const boardId = url.searchParams.get("boardId") || undefined;
  const results = await runMayaGitJob({ forceClone: force, boardId });
  return NextResponse.json({ ok: true, results });
}

export async function GET(request: Request) {
  return POST(request);
}
