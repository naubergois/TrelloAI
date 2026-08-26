import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listBoardCatalog } from "@/lib/shared-boards";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const boards = await listBoardCatalog(
    session.user.email,
    session.user.role === "admin",
  );
  return NextResponse.json({ boards });
}
