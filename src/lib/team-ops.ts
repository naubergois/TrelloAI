import { nanoid } from "nanoid";
import type { BoardSnapshot } from "@/lib/board-snapshot";
import type { Team, TeamMember } from "@/lib/types";

export type InviteProfile = {
  name: string;
  email: string;
  image?: string | null;
};

export function snapshotHasTeam(snapshot: BoardSnapshot, teamId: string): boolean {
  return snapshot.board.teamId === teamId || Boolean(snapshot.teams?.[teamId]);
}

export function stripTeamFromSnapshot(snapshot: BoardSnapshot, teamId: string): BoardSnapshot {
  const teams = { ...(snapshot.teams || {}) };
  delete teams[teamId];
  const now = new Date().toISOString();
  const board =
    snapshot.board.teamId === teamId
      ? { ...snapshot.board, teamId: null, updatedAt: now }
      : snapshot.board;
  return { ...snapshot, teams, board, updatedAt: now };
}

export function attachTeamToSnapshot(snapshot: BoardSnapshot, team: Team): BoardSnapshot {
  return {
    ...snapshot,
    teams: { ...(snapshot.teams || {}), [team.id]: team },
    updatedAt: new Date().toISOString(),
  };
}

/** Boards the invitee should actually join (linked team), else the invite anchor. */
export function membershipBoardIdsForTeam(
  snapshots: BoardSnapshot[],
  teamId: string | null | undefined,
  fallbackBoardId: string,
): string[] {
  if (teamId) {
    const linked = snapshots
      .filter((s) => s.board.teamId === teamId)
      .map((s) => s.board.id);
    if (linked.length > 0) return [...new Set(linked)];
  }
  return [fallbackBoardId];
}

function findMemberByEmail(
  snapshots: BoardSnapshot[],
  email: string,
): TeamMember | undefined {
  for (const snapshot of snapshots) {
    const found = Object.values(snapshot.members || {}).find(
      (m) => m.email.trim().toLowerCase() === email,
    );
    if (found) return found;
  }
  return undefined;
}

export function addProfileToTeamSnapshots(
  snapshots: BoardSnapshot[],
  opts: {
    teamId?: string | null;
    membershipBoardIds: string[];
    profile: InviteProfile;
  },
): { snapshots: BoardSnapshot[]; memberId: string } {
  const email = opts.profile.email.trim().toLowerCase();
  const name = opts.profile.name.trim() || email.split("@")[0] || "Membro";
  const now = new Date().toISOString();
  const existing = findMemberByEmail(snapshots, email);
  const memberId = existing?.id || nanoid();
  const member: TeamMember = existing
    ? {
        ...existing,
        name,
        email: email || existing.email,
        image: opts.profile.image ?? existing.image,
      }
    : {
        id: memberId,
        name,
        email: email || `${memberId}@invite.local`,
        role: "member",
        color: "sky",
        image: opts.profile.image ?? null,
        createdAt: now,
      };

  const membership = new Set(opts.membershipBoardIds);
  const next = snapshots.map((snapshot) => {
    const members = { ...(snapshot.members || {}), [memberId]: member };
    let teams = snapshot.teams || {};
    if (opts.teamId && teams[opts.teamId]) {
      const team = teams[opts.teamId];
      teams = {
        ...teams,
        [team.id]: {
          ...team,
          memberIds: Array.from(new Set([...team.memberIds, memberId])),
          updatedAt: now,
        },
      };
    }
    const onBoard =
      membership.has(snapshot.board.id) || snapshot.board.teamId === opts.teamId;
    const board = onBoard
      ? {
          ...snapshot.board,
          memberIds: Array.from(new Set([...(snapshot.board.memberIds || []), memberId])),
          updatedAt: now,
        }
      : snapshot.board;
    return { ...snapshot, members, teams, board, updatedAt: now };
  });

  return { snapshots: next, memberId };
}
