import type { BoardInvite } from "@/lib/invites";
import {
  addMembership,
  emailHasBoardAccess,
  getSharedBoard,
  listAllSharedBoards,
  saveSharedBoard,
  type BoardSnapshot,
} from "@/lib/shared-boards";
import {
  addProfileToTeamSnapshots,
  membershipBoardIdsForTeam,
  snapshotHasTeam,
  stripTeamFromSnapshot,
  type InviteProfile,
} from "@/lib/team-ops";

export async function snapshotsForInvite(invite: BoardInvite): Promise<BoardSnapshot[]> {
  if (invite.kind === "team" && invite.teamId) {
    const all = await listAllSharedBoards();
    const matched = all.filter((s) => snapshotHasTeam(s, invite.teamId!));
    if (matched.length > 0) return matched;
  }
  const one = await getSharedBoard(invite.boardId);
  return one ? [one] : [];
}

export async function applyInviteJoin(
  invite: BoardInvite,
  profile: InviteProfile,
): Promise<
  | { ok: true; boardId: string; boardIds: string[]; snapshots: BoardSnapshot[] }
  | { ok: false; error: string }
> {
  const raw = await snapshotsForInvite(invite);
  if (raw.length === 0) {
    return {
      ok: false,
      error: "Board do convite não está disponível no servidor. Peça um novo convite.",
    };
  }

  const membershipBoardIds = membershipBoardIdsForTeam(raw, invite.teamId, invite.boardId);
  const { snapshots } = addProfileToTeamSnapshots(raw, {
    teamId: invite.teamId,
    membershipBoardIds,
    profile,
  });

  for (const snapshot of snapshots) {
    await saveSharedBoard(snapshot);
  }
  for (const boardId of membershipBoardIds) {
    await addMembership(profile.email, boardId);
  }

  return {
    ok: true,
    boardId: membershipBoardIds[0] || invite.boardId,
    boardIds: membershipBoardIds,
    snapshots,
  };
}

export async function deleteTeamFromAllSnapshots(
  teamId: string,
  actorEmail: string,
): Promise<{ ok: true; boardIds: string[] } | { ok: false; error: string; status: number }> {
  const all = await listAllSharedBoards();
  const affected = all.filter((s) => snapshotHasTeam(s, teamId));
  if (affected.length === 0) {
    return { ok: true, boardIds: [] };
  }

  const access = await Promise.all(
    affected.map((s) => emailHasBoardAccess(actorEmail, s.board.id)),
  );
  if (!access.some(Boolean)) {
    return { ok: false, error: "Sem acesso para excluir esta equipe.", status: 403 };
  }

  const boardIds: string[] = [];
  for (const snapshot of affected) {
    await saveSharedBoard(stripTeamFromSnapshot(snapshot, teamId));
    boardIds.push(snapshot.board.id);
  }
  return { ok: true, boardIds };
}
