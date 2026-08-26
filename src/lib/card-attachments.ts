import type { BoardSnapshot } from "@/lib/board-snapshot";
import type { CardAttachment } from "@/lib/types";

export const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;

const BLOCKED_EXTENSIONS = new Set([
  "exe",
  "bat",
  "cmd",
  "com",
  "scr",
  "pif",
  "msi",
  "dll",
]);

const MIME_BY_EXT: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  txt: "text/plain",
  md: "text/markdown",
  csv: "text/csv",
  json: "application/json",
  xml: "application/xml",
  zip: "application/zip",
  rar: "application/vnd.rar",
  "7z": "application/x-7z-compressed",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  odt: "application/vnd.oasis.opendocument.text",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  mp3: "audio/mpeg",
  mp4: "video/mp4",
  wav: "audio/wav",
};

export function fileExtension(name: string) {
  const base = String(name || "").split(/[\\/]/).pop() || "";
  const dot = base.lastIndexOf(".");
  if (dot <= 0 || dot === base.length - 1) return "";
  return base.slice(dot + 1).toLowerCase();
}

export function sanitizeFilename(name: string) {
  const base = String(name || "")
    .split(/[\\/]/)
    .pop()
    ?.replace(/[\u0000-\u001f<>:"|?*]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
  const cleaned = (base || "arquivo").slice(0, 180);
  return cleaned === "." || cleaned === ".." ? "arquivo" : cleaned;
}

export function isBlockedFilename(name: string) {
  return BLOCKED_EXTENSIONS.has(fileExtension(name));
}

export function guessMimeType(name: string, fallback = "application/octet-stream") {
  return MIME_BY_EXT[fileExtension(name)] || fallback || "application/octet-stream";
}

export function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10_240 ? 1 : 0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

export function attachmentPublicUrl(boardId: string, cardId: string, attachmentId: string) {
  return `/api/boards/${encodeURIComponent(boardId)}/cards/${encodeURIComponent(cardId)}/attachments/${encodeURIComponent(attachmentId)}`;
}

export function isSafeAttachmentId(value: string) {
  return /^[a-zA-Z0-9_-]{2,80}$/.test(value);
}

export function contentDisposition(filename: string, inline = false) {
  const safe = sanitizeFilename(filename).replace(/"/g, "");
  const encoded = encodeURIComponent(safe);
  const kind = inline ? "inline" : "attachment";
  return `${kind}; filename="${safe}"; filename*=UTF-8''${encoded}`;
}

export function assertAttachmentPayload(name: string, size: number) {
  const filename = sanitizeFilename(name);
  if (isBlockedFilename(filename)) {
    throw new Error(`Tipo de arquivo não permitido: ${fileExtension(filename)}`);
  }
  if (!Number.isFinite(size) || size <= 0) {
    throw new Error("Arquivo vazio.");
  }
  if (size > MAX_ATTACHMENT_BYTES) {
    throw new Error(`Arquivo maior que ${formatFileSize(MAX_ATTACHMENT_BYTES)}.`);
  }
  return filename;
}

export function snapshotWithAttachment(
  snapshot: BoardSnapshot,
  cardId: string,
  attachment: CardAttachment,
): BoardSnapshot {
  const card = snapshot.cards?.[cardId];
  if (!card) return snapshot;
  const current = card.attachments || [];
  if (current.some((item) => item.id === attachment.id)) return snapshot;
  const ts = new Date().toISOString();
  return {
    ...snapshot,
    cards: {
      ...snapshot.cards,
      [cardId]: {
        ...card,
        attachments: [...current, attachment],
        updatedAt: ts,
      },
    },
    board: snapshot.board ? { ...snapshot.board, updatedAt: ts } : snapshot.board,
    updatedAt: ts,
  };
}

export function snapshotWithoutAttachment(
  snapshot: BoardSnapshot,
  cardId: string,
  attachmentId: string,
): BoardSnapshot {
  const card = snapshot.cards?.[cardId];
  if (!card) return snapshot;
  const current = card.attachments || [];
  if (!current.some((item) => item.id === attachmentId)) return snapshot;
  const ts = new Date().toISOString();
  return {
    ...snapshot,
    cards: {
      ...snapshot.cards,
      [cardId]: {
        ...card,
        attachments: current.filter((item) => item.id !== attachmentId),
        updatedAt: ts,
      },
    },
    board: snapshot.board ? { ...snapshot.board, updatedAt: ts } : snapshot.board,
    updatedAt: ts,
  };
}

/** Une anexos do servidor (MCP/API) com o snapshot que o cliente está gravando. */
export function mergeSnapshotAttachments(
  existing: BoardSnapshot | null | undefined,
  incoming: BoardSnapshot,
): BoardSnapshot {
  if (!existing?.cards) return incoming;
  let changed = false;
  const cards = { ...incoming.cards };
  for (const [cardId, card] of Object.entries(cards)) {
    const previous = existing.cards[cardId]?.attachments || [];
    if (!previous.length) continue;
    const current = card.attachments || [];
    const seen = new Set(current.map((item) => item.id));
    const extra = previous.filter((item) => !seen.has(item.id));
    if (!extra.length) continue;
    cards[cardId] = { ...card, attachments: [...current, ...extra] };
    changed = true;
  }
  return changed ? { ...incoming, cards } : incoming;
}
