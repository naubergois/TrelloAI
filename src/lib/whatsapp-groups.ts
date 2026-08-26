import type { BoardWhatsAppGroup, BoardWhatsAppGroupInput } from "./types";

export const WHATSAPP_GROUP_NAME_MAX = 120;
export const WHATSAPP_GROUP_NOTES_MAX = 2000;

const INVITE_CODE = /^[A-Za-z0-9_-]{10,80}$/;
const JID_IN_TEXT = /(\d{10,32})@g\.us/i;

function trimTo(value: string, max: number) {
  return value.replace(/\r\n/g, "\n").trim().slice(0, max);
}

export function sanitizeWhatsAppInviteUrl(raw: string | null | undefined): string | null {
  let value = (raw || "").trim();
  if (!value) return null;
  if (/^chat\.whatsapp\.com\//i.test(value)) value = `https://${value}`;
  try {
    const parsed = new URL(value);
    const proto = parsed.protocol.toLowerCase();
    if (proto !== "https:" && proto !== "http:") return null;
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
    if (host !== "chat.whatsapp.com") return null;
    const segments = parsed.pathname.split("/").filter(Boolean);
    const code = segments[0] === "invite" ? segments[1] : segments[0];
    if (!code || !INVITE_CODE.test(code)) return null;
    return `https://chat.whatsapp.com/${code}`;
  } catch {
    return null;
  }
}

export function sanitizeWhatsAppJid(raw: string | null | undefined): string | null {
  const value = (raw || "").trim();
  if (!value) return null;
  const matched = value.match(JID_IN_TEXT);
  if (matched) return `${matched[1]}@g.us`;
  const digits = value.match(/^(\d{10,32})$/);
  if (digits) return `${digits[1]}@g.us`;
  return null;
}

export function sanitizeWhatsAppGroupName(raw: string | null | undefined): string {
  return trimTo(raw || "", WHATSAPP_GROUP_NAME_MAX);
}

export function sanitizeWhatsAppGroupNotes(raw: string | null | undefined): string {
  return trimTo(raw || "", WHATSAPP_GROUP_NOTES_MAX);
}

function defaultName(inviteUrl: string | null, jid: string | null): string {
  if (inviteUrl) {
    try {
      const code = new URL(inviteUrl).pathname.replace(/^\//, "");
      return `Grupo WhatsApp (${code.slice(0, 8)}…)`;
    } catch {
      return "Grupo WhatsApp";
    }
  }
  if (jid) return `Grupo WhatsApp (${jid.replace(/@g\.us$/i, "")})`;
  return "";
}

export function normalizeWhatsAppGroupInput(
  input: BoardWhatsAppGroupInput,
): { name: string; inviteUrl: string | null; jid: string | null; notes: string } | null {
  const inviteUrl = sanitizeWhatsAppInviteUrl(input.inviteUrl);
  const jid = sanitizeWhatsAppJid(input.jid);
  const notes = sanitizeWhatsAppGroupNotes(input.notes);
  const name = sanitizeWhatsAppGroupName(input.name) || defaultName(inviteUrl, jid);
  if (!name && !inviteUrl && !jid) return null;
  if (!name) return null;
  return { name, inviteUrl, jid, notes };
}

function stableId(inviteUrl: string | null, jid: string | null): string | null {
  if (jid) return `wa-${jid.replace(/@g\.us$/i, "")}`;
  if (inviteUrl) {
    try {
      return `wa-url-${new URL(inviteUrl).pathname.replace(/^\//, "")}`;
    } catch {
      return null;
    }
  }
  return null;
}

export function coerceWhatsAppGroup(
  raw: unknown,
  now = new Date().toISOString(),
): BoardWhatsAppGroup | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  const normalized = normalizeWhatsAppGroupInput({
    name: typeof item.name === "string" ? item.name : "",
    inviteUrl: typeof item.inviteUrl === "string" ? item.inviteUrl : null,
    jid: typeof item.jid === "string" ? item.jid : null,
    notes: typeof item.notes === "string" ? item.notes : "",
  });
  if (!normalized) return null;
  const givenId = typeof item.id === "string" ? item.id.trim() : "";
  const id = givenId || stableId(normalized.inviteUrl, normalized.jid);
  if (!id) return null;
  const addedAt = typeof item.addedAt === "string" && item.addedAt ? item.addedAt : now;
  const updatedAt =
    typeof item.updatedAt === "string" && item.updatedAt ? item.updatedAt : addedAt;
  return {
    id,
    name: normalized.name,
    inviteUrl: normalized.inviteUrl,
    jid: normalized.jid,
    notes: normalized.notes || undefined,
    addedAt,
    updatedAt,
  };
}

export function normalizeWhatsAppGroups(raw: unknown): BoardWhatsAppGroup[] {
  if (!Array.isArray(raw)) return [];
  const out: BoardWhatsAppGroup[] = [];
  const seenId = new Set<string>();
  const seenUrl = new Set<string>();
  const seenJid = new Set<string>();
  for (const item of raw) {
    const group = coerceWhatsAppGroup(item);
    if (!group) continue;
    if (seenId.has(group.id)) continue;
    if (group.inviteUrl && seenUrl.has(group.inviteUrl)) continue;
    if (group.jid && seenJid.has(group.jid)) continue;
    seenId.add(group.id);
    if (group.inviteUrl) seenUrl.add(group.inviteUrl);
    if (group.jid) seenJid.add(group.jid);
    out.push(group);
  }
  return out;
}

export function findDuplicateWhatsAppGroup(
  groups: BoardWhatsAppGroup[],
  candidate: Pick<BoardWhatsAppGroup, "inviteUrl" | "jid">,
  exceptId?: string,
): BoardWhatsAppGroup | undefined {
  return groups.find((group) => {
    if (exceptId && group.id === exceptId) return false;
    if (candidate.inviteUrl && group.inviteUrl === candidate.inviteUrl) return true;
    if (candidate.jid && group.jid === candidate.jid) return true;
    return false;
  });
}

export function mergeWhatsAppGroup(
  current: BoardWhatsAppGroup,
  patch: BoardWhatsAppGroupInput,
  now = new Date().toISOString(),
): BoardWhatsAppGroup | null {
  const next = normalizeWhatsAppGroupInput({
    name: patch.name !== undefined ? patch.name : current.name,
    inviteUrl:
      patch.inviteUrl !== undefined ? patch.inviteUrl : current.inviteUrl,
    jid: patch.jid !== undefined ? patch.jid : current.jid,
    notes: patch.notes !== undefined ? patch.notes : current.notes,
  });
  if (!next) return null;
  return {
    ...current,
    name: next.name,
    inviteUrl: next.inviteUrl,
    jid: next.jid,
    notes: next.notes || undefined,
    updatedAt: now,
  };
}
