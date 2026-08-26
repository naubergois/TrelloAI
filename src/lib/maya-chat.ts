import type { MayaDayLog, StandupChatMessage, StandupSession, TeamMember } from "./types";
import { formatCalendarDayLabel } from "./calendar-report";

export function mayaDayLogId(boardId: string, date: string) {
  return `${boardId}:${date}`;
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
  return [...byId.values()].sort((a, b) => {
    const byTime = a.createdAt.localeCompare(b.createdAt);
    return byTime !== 0 ? byTime : a.id.localeCompare(b.id);
  });
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
