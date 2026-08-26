import { createHash, randomBytes } from "crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";
import {
  isPgConfigured,
  pgGetInvite,
  pgInsertInvite,
  pgListInvitesForBoard,
  pgRecordInviteAcceptance,
} from "@/lib/storage/pg";

export type InviteKind = "board" | "team";

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
  /** @deprecated single-use — use acceptedEmails */
  usedAt: string | null;
  usedByEmail: string | null;
  /** emails that accepted via this link (team invites are reusable) */
  acceptedEmails: string[];
  kind: InviteKind;
  teamId: string | null;
  teamName: string | null;
};

function withInviteDefaults(inv: BoardInvite): BoardInvite {
  return {
    ...inv,
    acceptedEmails: inv.acceptedEmails ?? (inv.usedByEmail ? [inv.usedByEmail] : []),
    kind: inv.kind === "team" ? "team" : "board",
    teamId: inv.teamId ?? null,
    teamName: inv.teamName ?? null,
  };
}

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
    return {
      invites: (Array.isArray(parsed.invites) ? parsed.invites : []).map((inv) =>
        withInviteDefaults(inv),
      ),
    };
  } catch {
    return { invites: [] };
  }
}

function writeStore(store: InviteStore) {
  mkdirSync(dataDir(), { recursive: true });
  writeFileSync(storePath(), JSON.stringify(store, null, 2), "utf8");
}

export async function createInvite(input: {
  boardId: string;
  boardTitle: string;
  createdByEmail: string;
  createdByName: string;
  inviteeEmail?: string | null;
  daysValid?: number;
  kind?: InviteKind;
  teamId?: string | null;
  teamName?: string | null;
}): Promise<BoardInvite> {
  const token = createHash("sha256")
    .update(`${randomBytes(24).toString("hex")}:${Date.now()}`)
    .digest("hex")
    .slice(0, 32);

  const now = new Date();
  const expires = new Date(now.getTime() + (input.daysValid ?? 14) * 24 * 60 * 60 * 1000);
  const kind: InviteKind = input.kind === "team" ? "team" : "board";

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
    acceptedEmails: [],
    kind,
    teamId: kind === "team" ? input.teamId || null : null,
    teamName: kind === "team" ? input.teamName?.trim() || null : null,
  };

  if (isPgConfigured()) {
    await pgInsertInvite(invite);
    return invite;
  }

  const store = readStore();
  store.invites.unshift(invite);
  // keep last 500
  store.invites = store.invites.slice(0, 500);
  writeStore(store);
  return invite;
}

export async function getInvite(token: string): Promise<BoardInvite | null> {
  if (isPgConfigured()) {
    const invite = await pgGetInvite(token);
    return invite ? withInviteDefaults(invite) : null;
  }
  return readStore().invites.find((i) => i.token === token) ?? null;
}

export function isInviteValid(
  invite: BoardInvite,
  forEmail?: string,
): { ok: true } | { ok: false; error: string } {
  if (new Date(invite.expiresAt).getTime() < Date.now()) {
    return { ok: false, error: "Este convite expirou." };
  }
  const email = forEmail?.trim().toLowerCase();
  if (invite.inviteeEmail && email && invite.inviteeEmail !== email) {
    return { ok: false, error: "Este convite é exclusivo para outro e-mail." };
  }
  // Single-email locked invites: one acceptance only
  if (invite.inviteeEmail && invite.acceptedEmails?.length > 0) {
    if (!email || !invite.acceptedEmails.includes(email)) {
      return { ok: false, error: "Este convite já foi utilizado." };
    }
  }
  return { ok: true };
}

export async function recordInviteAcceptance(token: string, usedByEmail: string) {
  if (isPgConfigured()) {
    return pgRecordInviteAcceptance(token, usedByEmail);
  }
  const store = readStore();
  const invite = store.invites.find((i) => i.token === token);
  if (!invite) return null;
  const email = usedByEmail.trim().toLowerCase();
  if (!invite.acceptedEmails) invite.acceptedEmails = [];
  if (!invite.acceptedEmails.includes(email)) {
    invite.acceptedEmails.push(email);
  }
  if (!invite.usedAt) {
    invite.usedAt = new Date().toISOString();
    invite.usedByEmail = email;
  }
  writeStore(store);
  return invite;
}

export async function listInvitesForBoard(boardId: string): Promise<BoardInvite[]> {
  if (isPgConfigured()) {
    return pgListInvitesForBoard(boardId);
  }
  return readStore().invites.filter((i) => i.boardId === boardId);
}
