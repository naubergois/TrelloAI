import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { auth } from "@/auth";
import { emailHasBoardAccess, getSharedBoard, saveSharedBoard } from "@/lib/shared-boards";
import {
  assertAttachmentPayload,
  attachmentPublicUrl,
  guessMimeType,
  isSafeAttachmentId,
  snapshotWithAttachment,
} from "@/lib/card-attachments";
import { saveAttachmentBytes } from "@/lib/card-attachment-store";
import { checkRateLimit } from "@/lib/api-security";
import type { CardAttachment } from "@/lib/types";

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

export async function POST(
  request: Request,
  context: { params: Promise<{ boardId: string; cardId: string }> },
) {
  const { boardId, cardId } = await context.params;
  if (!isSafeAttachmentId(boardId) || !isSafeAttachmentId(cardId)) {
    return NextResponse.json({ error: "Identificador inválido." }, { status: 400 });
  }

  const access = await requireBoardAccess(boardId);
  if (access.error) return access.error;

  const limited = checkRateLimit(`attach:${access.session!.user.email}:${boardId}`, 30, 60_000);
  if (!limited.ok) return limited.response;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Envie o arquivo como multipart/form-data." }, { status: 400 });
  }

  const files = form
    .getAll("file")
    .concat(form.getAll("files"))
    .filter((value): value is File => value instanceof File && value.size > 0);

  if (files.length === 0) {
    return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
  }

  const snapshot = await getSharedBoard(boardId);
  if (!snapshot) {
    return NextResponse.json({ error: "Board não encontrado." }, { status: 404 });
  }

  const created: CardAttachment[] = [];
  let nextSnapshot = snapshot;
  const ts = new Date().toISOString();

  for (const file of files.slice(0, 10)) {
    let name: string;
    try {
      name = assertAttachmentPayload(file.name, file.size);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Arquivo inválido." },
        { status: 400 },
      );
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    const id = nanoid();
    const mimeType = guessMimeType(name, file.type || "application/octet-stream");
    await saveAttachmentBytes({ id, boardId, cardId, name, mimeType, bytes });
    const attachment: CardAttachment = {
      id,
      name,
      mimeType,
      size: bytes.length,
      kind: "file",
      url: attachmentPublicUrl(boardId, cardId, id),
      createdAt: ts,
    };
    created.push(attachment);
    nextSnapshot = snapshotWithAttachment(nextSnapshot, cardId, attachment);
  }

  if (nextSnapshot !== snapshot) {
    await saveSharedBoard(nextSnapshot);
  }

  return NextResponse.json({ attachments: created });
}
