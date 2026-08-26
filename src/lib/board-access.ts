import type { BoardSnapshot } from "@/lib/board-snapshot";
import type { Board, Team, TeamMember } from "@/lib/types";

function normalizeEmail(email: string | null | undefined) {
  return (email || "").trim().toLowerCase();
}

export function findMemberByEmail(
  members: Record<string, TeamMember> | undefined,
  email: string,
): TeamMember | undefined {
  const key = normalizeEmail(email);
  if (!key) return undefined;
  return Object.values(members || {}).find(
    (m) => normalizeEmail(m.email) === key,
  );
}

/** Team members see every board of that team; direct board members see that board. */
export function memberCanSeeBoard(
  board: Board,
  memberId: string | null | undefined,
  teams: Record<string, Team>,
  opts?: { isAdmin?: boolean },
): boolean {
  if (opts?.isAdmin) return true;
  if (!memberId) return false;
  if (board.teamId) {
    const team = teams[board.teamId];
    if (team?.memberIds.includes(memberId)) return true;
  }
  return (board.memberIds || []).includes(memberId);
}

export function filterBoardsForMember<T extends Board>(
  boards: T[],
  memberId: string | null | undefined,
  teams: Record<string, Team>,
  opts?: { isAdmin?: boolean },
): T[] {
  if (opts?.isAdmin) return boards;
  return boards.filter((board) => memberCanSeeBoard(board, memberId, teams));
}

export function filterTeamsForMember<T extends Team>(
  teams: T[],
  memberId: string | null | undefined,
  opts?: { isAdmin?: boolean },
): T[] {
  if (opts?.isAdmin) return teams;
  if (!memberId) return [];
  return teams.filter((team) => team.memberIds.includes(memberId));
}

export function emailIsOnBoardTeam(snapshot: BoardSnapshot, email: string): boolean {
  const key = normalizeEmail(email);
  if (!key || !snapshot.board.teamId) return false;
  const team = snapshot.teams?.[snapshot.board.teamId];
  if (!team) return false;
  for (const memberId of team.memberIds) {
    const member = snapshot.members?.[memberId];
    if (member && normalizeEmail(member.email) === key) return true;
  }
  const byEmail = findMemberByEmail(snapshot.members, key);
  return Boolean(byEmail && team.memberIds.includes(byEmail.id));
}

export function emailIsBoardMember(snapshot: BoardSnapshot, email: string): boolean {
  const member = findMemberByEmail(snapshot.members, email);
  if (!member) return false;
  return (snapshot.board.memberIds || []).includes(member.id);
}

/**
 * Team members see every board linked to that team.
 * Direct board members (invite) see that board even if they are not on the team.
 */
export function snapshotVisibleToEmail(snapshot: BoardSnapshot, email: string): boolean {
  return emailIsOnBoardTeam(snapshot, email) || emailIsBoardMember(snapshot, email);
}
