import { mkdirSync, readFileSync, unlinkSync, writeFileSync, existsSync } from "fs";
import path from "path";
import { isPgConfigured, pgDeleteAttachmentBlob, pgGetAttachmentBlob, pgSaveAttachmentBlob } from "@/lib/storage/pg";
import { isSafeAttachmentId } from "@/lib/card-attachments";

function dataDir() {
  return process.env.USERS_DATA_DIR || path.join(process.cwd(), "data");
}

function safeSegment(value: string) {
  if (!isSafeAttachmentId(value)) {
    throw new Error("Identificador de anexo inválido.");
  }
  return value;
}

export function attachmentDiskPath(boardId: string, cardId: string, attachmentId: string) {
  return path.join(
    dataDir(),
    "uploads",
    safeSegment(boardId),
    safeSegment(cardId),
    safeSegment(attachmentId),
  );
}

export async function saveAttachmentBytes(opts: {
  id: string;
  boardId: string;
  cardId: string;
  name: string;
  mimeType: string;
  bytes: Buffer;
}) {
  if (isPgConfigured()) {
    await pgSaveAttachmentBlob(opts);
    return;
  }
  const file = attachmentDiskPath(opts.boardId, opts.cardId, opts.id);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, opts.bytes);
}

export async function loadAttachmentBytes(opts: {
  id: string;
  boardId: string;
  cardId: string;
}): Promise<{ bytes: Buffer; name?: string; mimeType?: string } | null> {
  if (isPgConfigured()) {
    const row = await pgGetAttachmentBlob(opts);
    if (!row) return null;
    return { bytes: row.data, name: row.name, mimeType: row.mimeType };
  }
  const file = attachmentDiskPath(opts.boardId, opts.cardId, opts.id);
  if (!existsSync(file)) return null;
  return { bytes: readFileSync(file) };
}

export async function removeAttachmentBytes(opts: {
  id: string;
  boardId: string;
  cardId: string;
}) {
  if (isPgConfigured()) {
    await pgDeleteAttachmentBlob(opts);
    return;
  }
  const file = attachmentDiskPath(opts.boardId, opts.cardId, opts.id);
  if (existsSync(file)) unlinkSync(file);
}
