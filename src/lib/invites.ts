import { createHash, randomBytes } from "crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";

export type BoardInvite = {
  token: string;
  boardId: string;
  boardTitle: string;
  createdByEmail: string;
  createdByName: string;
  /** optional: lock invite to one email */
  inviteeEmail: string | null;
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
  usedByEmail: string | null;
};

type InviteStore = { invites: BoardInvite[] };

function dataDir() {
  return process.env.USERS_DATA_DIR || path.join(process.cwd(), "data");
}

function storePath() {
  return path.join(dataDir(), "invites.json");
}

function readStore(): InviteStore {
  const file = storePath();
  if (!existsSync(file)) return { invites: [] };
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as InviteStore;
    return { invites: Array.isArray(parsed.invites) ? parsed.invites : [] };
  } catch {
    return { invites: [] };
  }
}

function writeStore(store: InviteStore) {
  mkdirSync(dataDir(), { recursive: true });
  writeFileSync(storePath(), JSON.stringify(store, null, 2), "utf8");
}

export function createInvite(input: {
  boardId: string;
  boardTitle: string;
  createdByEmail: string;
  createdByName: string;
  inviteeEmail?: string | null;
  daysValid?: number;
}): BoardInvite {
  const token = createHash("sha256")
    .update(`${randomBytes(24).toString("hex")}:${Date.now()}`)
    .digest("hex")
    .slice(0, 32);

  const now = new Date();
  const expires = new Date(now.getTime() + (input.daysValid ?? 14) * 24 * 60 * 60 * 1000);

  const invite: BoardInvite = {
    token,
    boardId: input.boardId,
    boardTitle: input.boardTitle,
    createdByEmail: input.createdByEmail.trim().toLowerCase(),
    createdByName: input.createdByName.trim() || "Admin",
    inviteeEmail: input.inviteeEmail?.trim().toLowerCase() || null,
    createdAt: now.toISOString(),
    expiresAt: expires.toISOString(),
    usedAt: null,
    usedByEmail: null,
  };

  const store = readStore();
  store.invites.unshift(invite);
  // keep last 500
  store.invites = store.invites.slice(0, 500);
  writeStore(store);
  return invite;
}

export function getInvite(token: string): BoardInvite | null {
  return readStore().invites.find((i) => i.token === token) ?? null;
}

export function isInviteValid(invite: BoardInvite): { ok: true } | { ok: false; error: string } {
  if (invite.usedAt) return { ok: false, error: "Este convite já foi utilizado." };
  if (new Date(invite.expiresAt).getTime() < Date.now()) {
    return { ok: false, error: "Este convite expirou." };
  }
  return { ok: true };
}

export function markInviteUsed(token: string, usedByEmail: string) {
  const store = readStore();
  const invite = store.invites.find((i) => i.token === token);
  if (!invite) return null;
  invite.usedAt = new Date().toISOString();
  invite.usedByEmail = usedByEmail.trim().toLowerCase();
  writeStore(store);
  return invite;
}

export function listInvitesForBoard(boardId: string): BoardInvite[] {
  return readStore().invites.filter((i) => i.boardId === boardId);
}
