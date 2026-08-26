import type { Board, Card, Requirement, Team, TeamMember } from "./types";

export function isExternalMember(member: TeamMember | null | undefined): boolean {
  return member?.kind === "external";
}

export function collectContactIds(input: {
  board: Pick<Board, "memberIds" | "externalMemberIds" | "teamId">;
  team?: Team | null;
  cards?: Iterable<Card>;
  requirements?: Iterable<Requirement>;
}): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  const push = (id: string | null | undefined) => {
    if (!id || seen.has(id)) return;
    seen.add(id);
    ids.push(id);
  };

  for (const id of input.board.memberIds || []) push(id);
  for (const id of input.board.externalMemberIds || []) push(id);
  for (const id of input.team?.memberIds || []) push(id);
  if (input.cards) {
    for (const card of input.cards) {
      for (const id of cardAssigneeIds(card)) push(id);
    }
  }
  if (input.requirements) {
    for (const req of input.requirements) push(req.ownerId);
  }
  return ids;
}

export function membersForSnapshot(
  members: Record<string, TeamMember>,
  ids: string[],
): Record<string, TeamMember> {
  const next: Record<string, TeamMember> = {};
  for (const id of ids) {
    if (members[id]) next[id] = members[id];
  }
  return next;
}

export function boardAssigneeOptions(input: {
  board: Pick<Board, "memberIds" | "externalMemberIds">;
  members: Record<string, TeamMember>;
  extraIds?: Array<string | null | undefined>;
  team?: Pick<Team, "memberIds"> | null;
}): { team: TeamMember[]; external: TeamMember[] } {
  const teamIds = new Set([
    ...(input.board.memberIds || []),
    ...(input.team?.memberIds || []),
  ]);
  const seen = new Set<string>();
  const team: TeamMember[] = [];
  const external: TeamMember[] = [];

  const push = (id: string | null | undefined) => {
    if (!id || seen.has(id)) return;
    const member = input.members[id];
    if (!member) return;
    seen.add(id);
    if (isExternalMember(member) || !teamIds.has(id)) external.push(member);
    else team.push(member);
  };

  for (const id of input.board.memberIds || []) push(id);
  for (const id of input.team?.memberIds || []) push(id);
  for (const id of input.board.externalMemberIds || []) push(id);
  for (const id of input.extraIds || []) push(id);

  team.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  external.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  return { team, external };
}

export function uniqueMemberIds(ids: Array<string | null | undefined>): string[] {
  const next: string[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    next.push(id);
  }
  return next;
}

/** Lista canônica de responsáveis, incluindo o assigneeId legado. */
export function cardAssigneeIds(card: {
  assigneeId?: string | null;
  assigneeIds?: string[] | null;
} | null | undefined): string[] {
  if (!card) return [];
  return uniqueMemberIds([...(card.assigneeIds || []), card.assigneeId]);
}

export function syncCardAssignees(
  ids: Array<string | null | undefined>,
): { assigneeId: string | null; assigneeIds: string[] } {
  const assigneeIds = uniqueMemberIds(ids);
  return { assigneeId: assigneeIds[0] ?? null, assigneeIds };
}

export function applyAssigneePatch(
  patch: {
    assigneeId?: string | null;
    assigneeIds?: string[] | null;
  },
): { assigneeId: string | null; assigneeIds: string[] } | null {
  if (patch.assigneeIds !== undefined) {
    return syncCardAssignees(patch.assigneeIds ?? []);
  }
  if (patch.assigneeId !== undefined) return syncCardAssignees([patch.assigneeId]);
  return null;
}

export function hasCardAssignees(card: {
  assigneeId?: string | null;
  assigneeIds?: string[] | null;
} | null | undefined): boolean {
  return cardAssigneeIds(card).length > 0;
}

export function cardAssigneeLabel(
  members: Record<string, { name?: string } | undefined> | undefined,
  card: { assigneeId?: string | null; assigneeIds?: string[] | null },
): string | null {
  if (!members) return null;
  const names = cardAssigneeIds(card)
    .map((id) => members[id]?.name?.trim())
    .filter((name): name is string => Boolean(name));
  return names.length ? names.join(", ") : null;
}

export function uniqueMemberList(members: TeamMember[]): TeamMember[] {
  const seen = new Set<string>();
  const next: TeamMember[] = [];
  for (const member of members) {
    if (seen.has(member.id)) continue;
    seen.add(member.id);
    next.push(member);
  }
  return next;
}
