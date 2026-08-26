import { mkdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";
import {
  isPgConfigured,
  pgDeleteMayaDayChat,
  pgListMayaChats,
  pgSaveMayaChats,
  pgSaveMayaDayChat,
} from "@/lib/storage/pg";
import {
  isMayaChatDate,
  mayaDayLogId,
  mayaLogsRecord,
  mergeMayaLogRecords,
  normalizeMayaDayLog,
} from "@/lib/maya-chat";
import type { MayaDayLog } from "@/lib/types";

type MayaChatFile = {
  users: Record<string, Record<string, MayaDayLog>>;
};

function dataDir() {
  return process.env.USERS_DATA_DIR || path.join(process.cwd(), "data");
}

function storePath() {
  return path.join(dataDir(), "maya-chats.json");
}

function readFileStore(): MayaChatFile {
  const file = storePath();
  if (!existsSync(file)) return { users: {} };
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as MayaChatFile;
    return { users: parsed.users && typeof parsed.users === "object" ? parsed.users : {} };
  } catch {
    return { users: {} };
  }
}

function writeFileStore(store: MayaChatFile) {
  mkdirSync(dataDir(), { recursive: true });
  writeFileSync(storePath(), JSON.stringify(store, null, 2), "utf8");
}

function tryWriteFileStore(store: MayaChatFile) {
  try {
    writeFileStore(store);
  } catch (err) {
    if (!isPgConfigured()) throw err;
    console.error("[maya-chats] cache local indisponível", err);
  }
}

function emailKey(email: string) {
  return email.trim().toLowerCase();
}

function fileLogsFor(email: string, boardId?: string): Record<string, MayaDayLog> {
  const all = mayaLogsRecord(Object.values(readFileStore().users[emailKey(email)] || {}));
  if (!boardId) return all;
  return Object.fromEntries(Object.entries(all).filter(([, log]) => log.boardId === boardId));
}

async function seedFromLegacyLogs(
  email: string,
  boardId: string,
  existing: Record<string, MayaDayLog>,
  legacy?: Record<string, MayaDayLog>,
): Promise<Record<string, MayaDayLog>> {
  if (!legacy || Object.keys(legacy).length === 0) return existing;
  if (Object.values(existing).some((log) => log.boardId === boardId)) return existing;
  const seeded = mayaLogsRecord(Object.values(legacy).filter((log) => log.boardId === boardId));
  if (Object.keys(seeded).length === 0) return existing;
  await saveMayaChatsForUser(email, Object.values(seeded));
  return mergeMayaLogRecords(existing, seeded);
}

export async function listMayaChatsForUser(
  email: string,
  opts?: {
    boardId?: string;
    legacyLogs?: Record<string, MayaDayLog>;
    legacyByBoard?: Record<string, Record<string, MayaDayLog> | undefined>;
  },
): Promise<Record<string, MayaDayLog>> {
  const key = emailKey(email);
  if (!key) return {};

  let logs = isPgConfigured()
    ? await pgListMayaChats(key, opts?.boardId)
    : fileLogsFor(key, opts?.boardId);

  if (opts?.boardId && opts.legacyLogs) {
    logs = await seedFromLegacyLogs(key, opts.boardId, logs, opts.legacyLogs);
  }
  for (const [boardId, legacy] of Object.entries(opts?.legacyByBoard || {})) {
    logs = await seedFromLegacyLogs(key, boardId, logs, legacy);
  }
  return logs;
}

export async function saveMayaDayChatForUser(email: string, log: MayaDayLog) {
  const key = emailKey(email);
  const normalized = normalizeMayaDayLog(log.boardId, log.date, log.messages, log.updatedAt);
  if (!key || !normalized) return false;

  if (isPgConfigured()) {
    await pgSaveMayaDayChat(key, normalized);
  }

  const store = readFileStore();
  const current = store.users[key] || {};
  store.users[key] = { ...current, [normalized.id]: normalized };
  tryWriteFileStore(store);
  return true;
}

export async function saveMayaChatsForUser(email: string, logs: MayaDayLog[]) {
  const key = emailKey(email);
  if (!key) return false;
  const normalized = Object.values(mayaLogsRecord(logs));
  if (normalized.length === 0) return true;

  if (isPgConfigured()) {
    await pgSaveMayaChats(key, normalized);
  }

  const store = readFileStore();
  const current = { ...(store.users[key] || {}) };
  for (const log of normalized) current[log.id] = log;
  store.users[key] = current;
  tryWriteFileStore(store);
  return true;
}

export async function deleteMayaDayChatForUser(email: string, boardId: string, date: string) {
  const key = emailKey(email);
  if (!key || !boardId.trim() || !isMayaChatDate(date)) return false;

  if (isPgConfigured()) {
    await pgDeleteMayaDayChat(key, boardId, date);
  }

  const store = readFileStore();
  const current = store.users[key];
  if (!current) return true;
  const id = mayaDayLogId(boardId, date);
  if (!current[id]) return true;
  const next = { ...current };
  delete next[id];
  store.users[key] = next;
  tryWriteFileStore(store);
  return true;
}

export async function deleteMayaChatsForBoard(boardId: string) {
  const store = readFileStore();
  let changed = false;
  for (const email of Object.keys(store.users)) {
    const next: Record<string, MayaDayLog> = {};
    for (const [id, log] of Object.entries(store.users[email] || {})) {
      if (log.boardId === boardId) {
        changed = true;
        continue;
      }
      next[id] = log;
    }
    store.users[email] = next;
  }
  if (changed) tryWriteFileStore(store);
}
