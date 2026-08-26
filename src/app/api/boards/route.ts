import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listBoardsForHome } from "@/lib/shared-boards";
import { withoutSharedMayaLogs } from "@/lib/board-snapshot";
import { listMayaChatsForUser } from "@/lib/maya-chat-store";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const snapshots = await listBoardsForHome(
    session.user.email,
    session.user.role === "admin",
  );
  const legacyByBoard = Object.fromEntries(
    snapshots.map((snapshot) => [snapshot.board.id, snapshot.mayaLogs]),
  );
  const mayaLogs = await listMayaChatsForUser(session.user.email, { legacyByBoard });
  return NextResponse.json({
    snapshots: snapshots.map(withoutSharedMayaLogs),
    mayaLogs,
  });
}

