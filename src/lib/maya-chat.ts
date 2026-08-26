import type { MayaDayLog, StandupChatMessage, StandupSession, TeamMember } from "./types";
import { formatCalendarDayLabel } from "./calendar-report";

export const MAYA_CHAT_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const MAYA_CHAT_MESSAGE_MAX = 8000;
export const MAYA_CHAT_DAY_MESSAGE_MAX = 200;
export const MAYA_CHAT_ID_MAX = 80;

export function mayaDayLogId(boardId: string, date: string) {
  return `${boardId}:${date}`;
}

export function isMayaChatDate(value: string) {
  return MAYA_CHAT_DATE_RE.test(value);
}

export function parseMayaChatMessages(raw: unknown): StandupChatMessage[] {
  if (!Array.isArray(raw)) return [];
  const incoming: StandupChatMessage[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const id = String(rec.id || "").trim().slice(0, MAYA_CHAT_ID_MAX);
    const content = String(rec.content || "").trim().slice(0, MAYA_CHAT_MESSAGE_MAX);
    const role = rec.role === "manager" ? "manager" : rec.role === "member" ? "member" : null;
    if (!id || !content || !role) continue;
    const createdAt =
      typeof rec.createdAt === "string" && rec.createdAt.trim()
        ? rec.createdAt
        : new Date().toISOString();
    incoming.push({
      id,
      role,
      memberId: rec.memberId ? String(rec.memberId).trim().slice(0, MAYA_CHAT_ID_MAX) : null,
      content,
      createdAt,
    });
  }
  return mergeMayaMessages([], incoming).slice(-MAYA_CHAT_DAY_MESSAGE_MAX);
}

export function normalizeMayaDayLog(
  boardId: string,
  date: string,
  messages: StandupChatMessage[],
  updatedAt?: string,
): MayaDayLog | null {
  if (!boardId.trim() || !isMayaChatDate(date)) return null;
  const parsed = parseMayaChatMessages(messages);
  if (parsed.length === 0) return null;
  return {
    id: mayaDayLogId(boardId, date),
    boardId,
    date,
    messages: parsed,
    updatedAt: updatedAt || new Date().toISOString(),
  };
}

export function mayaLogsRecord(logs: MayaDayLog[]): Record<string, MayaDayLog> {
  const out: Record<string, MayaDayLog> = {};
  for (const log of logs) {
    if (!log?.id || !log.boardId || !isMayaChatDate(log.date)) continue;
    const normalized = normalizeMayaDayLog(log.boardId, log.date, log.messages, log.updatedAt);
    if (normalized) out[normalized.id] = normalized;
  }
  return out;
}

export function mergeMayaLogRecords(
  base: Record<string, MayaDayLog> | undefined,
  incoming: Record<string, MayaDayLog> | undefined,
): Record<string, MayaDayLog> {
  const out: Record<string, MayaDayLog> = { ...(base || {}) };
  for (const log of Object.values(incoming || {})) {
    const prev = out[log.id];
    const messages = mergeMayaMessages(prev?.messages ?? [], log.messages ?? []);
    if (messages.length === 0) continue;
    const updatedAt =
      (prev?.updatedAt || "") > (log.updatedAt || "") ? prev!.updatedAt : log.updatedAt;
    out[log.id] = {
      id: log.id || mayaDayLogId(log.boardId, log.date),
      boardId: log.boardId,
      date: log.date,
      messages,
      updatedAt: updatedAt || new Date().toISOString(),
    };
  }
  return out;
}

/** Garante que a próxima mensagem fique depois da última, mesmo no mesmo milissegundo. */
export function mayaMessageTimestamp(after?: string | null) {
  const now = Date.now();
  const prev = after ? Date.parse(after) : Number.NaN;
  const ms = Number.isFinite(prev) && prev >= now ? prev + 1 : now;
  return new Date(ms).toISOString();
}

export function compareMayaChatMessages(a: StandupChatMessage, b: StandupChatMessage) {
  const byTime = a.createdAt.localeCompare(b.createdAt);
  if (byTime !== 0) return byTime;
  if (a.role !== b.role) return a.role === "member" ? -1 : 1;
  return a.id.localeCompare(b.id);
}

export function mergeMayaMessages(
  existing: StandupChatMessage[],
  incoming: StandupChatMessage[],
): StandupChatMessage[] {
  const byId = new Map<string, StandupChatMessage>();
  for (const msg of existing) {
    if (msg?.id) byId.set(msg.id, msg);
  }
  for (const msg of incoming) {
    if (msg?.id && msg.content?.trim()) byId.set(msg.id, msg);
  }
  return [...byId.values()].sort(compareMayaChatMessages);
}

export function upsertMayaDayLog(
  logs: Record<string, MayaDayLog>,
  boardId: string,
  date: string,
  messages: StandupChatMessage[],
): Record<string, MayaDayLog> {
  if (messages.length === 0) return logs;
  const id = mayaDayLogId(boardId, date);
  const prev = logs[id];
  return {
    ...logs,
    [id]: {
      id,
      boardId,
      date,
      messages: mergeMayaMessages(prev?.messages ?? [], messages),
      updatedAt: new Date().toISOString(),
    },
  };
}

export function omitMayaDayLog(
  logs: Record<string, MayaDayLog>,
  boardId: string,
  date: string,
): Record<string, MayaDayLog> {
  const id = mayaDayLogId(boardId, date);
  if (!logs[id]) return logs;
  const next = { ...logs };
  delete next[id];
  return next;
}

/** Substitui as mensagens do dia. Lista vazia remove a conversa. */
export function replaceMayaDayLog(
  logs: Record<string, MayaDayLog>,
  boardId: string,
  date: string,
  messages: StandupChatMessage[],
): Record<string, MayaDayLog> {
  const parsed = parseMayaChatMessages(messages);
  if (parsed.length === 0) return omitMayaDayLog(logs, boardId, date);
  const id = mayaDayLogId(boardId, date);
  return {
    ...logs,
    [id]: {
      id,
      boardId,
      date,
      messages: parsed,
      updatedAt: new Date().toISOString(),
    },
  };
}

export function removeMayaChatMessage(
  logs: Record<string, MayaDayLog>,
  boardId: string,
  date: string,
  messageId: string,
): Record<string, MayaDayLog> {
  const id = mayaDayLogId(boardId, date);
  const log = logs[id];
  if (!log || !messageId) return logs;
  return replaceMayaDayLog(
    logs,
    boardId,
    date,
    log.messages.filter((msg) => msg.id !== messageId),
  );
}

export function stripMayaStandupChat(
  standups: Record<string, StandupSession>,
  boardId: string,
  date: string,
  messageIds?: ReadonlySet<string>,
): Record<string, StandupSession> {
  let changed = false;
  const next = { ...standups };
  const now = new Date().toISOString();
  for (const [id, session] of Object.entries(standups)) {
    if (session.boardId !== boardId || session.date !== date) continue;
    const chat = session.chat ?? [];
    if (chat.length === 0) continue;
    const filtered = messageIds ? chat.filter((msg) => !messageIds.has(msg.id)) : [];
    if (filtered.length === chat.length) continue;
    changed = true;
    next[id] = { ...session, chat: filtered, updatedAt: now };
  }
  return changed ? next : standups;
}

export function collectMayaDayMessages(
  boardId: string,
  date: string,
  logs: Record<string, MayaDayLog> | undefined,
  standups: Record<string, StandupSession> | undefined,
): StandupChatMessage[] {
  const incoming: StandupChatMessage[] = [];
  const log = logs?.[mayaDayLogId(boardId, date)];
  if (log?.messages?.length) incoming.push(...log.messages);
  for (const standup of Object.values(standups || {})) {
    if (standup.boardId === boardId && standup.date === date && standup.chat?.length) {
      incoming.push(...standup.chat);
    }
  }
  return mergeMayaMessages([], incoming);
}

export function listMayaChatDays(
  boardId: string,
  logs: Record<string, MayaDayLog> | undefined,
  standups: Record<string, StandupSession> | undefined,
): string[] {
  const days = new Set<string>();
  for (const log of Object.values(logs || {})) {
    if (log.boardId === boardId && (log.messages?.length ?? 0) > 0) days.add(log.date);
  }
  for (const standup of Object.values(standups || {})) {
    if (standup.boardId === boardId && (standup.chat?.length ?? 0) > 0) {
      days.add(standup.date);
    }
  }
  return [...days].sort((a, b) => b.localeCompare(a));
}

export function mayaChatSpeakerName(
  msg: StandupChatMessage,
  managerName: string,
  members: Record<string, Pick<TeamMember, "name">>,
): string {
  if (msg.role === "manager") {
    const who = msg.memberId ? members[msg.memberId]?.name : null;
    return who ? `${managerName} · ${who}` : managerName;
  }
  return (msg.memberId && members[msg.memberId]?.name) || "Membro";
}

function formatClock(iso: string) {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return "--:--";
  }
}

export function formatMayaChatTranscript(opts: {
  boardTitle: string;
  managerName: string;
  date: string;
  messages: StandupChatMessage[];
  members: Record<string, Pick<TeamMember, "name">>;
}): string {
  const dayLabel = formatCalendarDayLabel(opts.date);
  const header = `Maya — conversa de ${dayLabel} (${opts.date})\nBoard: ${opts.boardTitle}\n`;
  if (opts.messages.length === 0) {
    return `${header}\n(Nenhuma mensagem neste dia.)\n`;
  }
  const body = opts.messages
    .map((msg) => {
      const time = formatClock(msg.createdAt);
      const who = mayaChatSpeakerName(msg, opts.managerName, opts.members);
      return `${time}  ${who}\n${msg.content.trim()}`;
    })
    .join("\n\n");
  return `${header}\n${body}\n`;
}

export function mayaChatFileName(boardTitle: string, date: string) {
  const slug =
    boardTitle
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40)
      .toLowerCase() || "board";
  return `maya-${slug}-${date}.txt`;
}

export function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
