import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listBoardsForEmail } from "@/lib/shared-boards";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const snapshots = await listBoardsForEmail(session.user.email);
  return NextResponse.json({ snapshots });
}
