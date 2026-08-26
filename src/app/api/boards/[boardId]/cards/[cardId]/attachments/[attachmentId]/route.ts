import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { emailHasBoardAccess, getSharedBoard, saveSharedBoard } from "@/lib/shared-boards";
import {
  contentDisposition,
  isSafeAttachmentId,
  snapshotWithoutAttachment,
} from "@/lib/card-attachments";
import { loadAttachmentBytes, removeAttachmentBytes } from "@/lib/card-attachment-store";

export const runtime = "nodejs";

async function requireBoardAccess(boardId: string) {
  const session = await auth();
  if (!session?.user?.email) {
    return {
      error: NextResponse.json({ error: "Não autenticado." }, { status: 401 }),
    };
  }
  const isAdmin = session.user.role === "admin";
  if (!isAdmin && !(await emailHasBoardAccess(session.user.email, boardId))) {
    return {
      error: NextResponse.json({ error: "Sem acesso a este board." }, { status: 403 }),
    };
  }
  return { session };
}

export async function GET(
  _request: Request,
  context: {
    params: Promise<{ boardId: string; cardId: string; attachmentId: string }>;
  },
) {
  const { boardId, cardId, attachmentId } = await context.params;
  if (
    !isSafeAttachmentId(boardId) ||
    !isSafeAttachmentId(cardId) ||
    !isSafeAttachmentId(attachmentId)
  ) {
    return NextResponse.json({ error: "Identificador inválido." }, { status: 400 });
  }

  const access = await requireBoardAccess(boardId);
  if (access.error) return access.error;

  const stored = await loadAttachmentBytes({ id: attachmentId, boardId, cardId });
  if (!stored) {
    return NextResponse.json({ error: "Anexo não encontrado." }, { status: 404 });
  }

  const snapshot = await getSharedBoard(boardId);
  const meta = snapshot?.cards?.[cardId]?.attachments?.find((item) => item.id === attachmentId);
  const name = meta?.name || stored.name || "arquivo";
  const mimeType = meta?.mimeType || stored.mimeType || "application/octet-stream";
  const inline = mimeType.startsWith("image/") || mimeType === "application/pdf";

  return new NextResponse(new Uint8Array(stored.bytes), {
    status: 200,
    headers: {
      "Content-Type": mimeType,
      "Content-Length": String(stored.bytes.length),
      "Content-Disposition": contentDisposition(name, inline),
      "Cache-Control": "private, max-age=3600",
    },
  });
}

export async function DELETE(
  _request: Request,
  context: {
    params: Promise<{ boardId: string; cardId: string; attachmentId: string }>;
  },
) {
  const { boardId, cardId, attachmentId } = await context.params;
  if (
    !isSafeAttachmentId(boardId) ||
    !isSafeAttachmentId(cardId) ||
    !isSafeAttachmentId(attachmentId)
  ) {
    return NextResponse.json({ error: "Identificador inválido." }, { status: 400 });
  }

  const access = await requireBoardAccess(boardId);
  if (access.error) return access.error;

  await removeAttachmentBytes({ id: attachmentId, boardId, cardId });

  const snapshot = await getSharedBoard(boardId);
  if (snapshot?.cards?.[cardId]) {
    await saveSharedBoard(snapshotWithoutAttachment(snapshot, cardId, attachmentId));
  }

  return NextResponse.json({ ok: true });
}
