import { describe, expect, it } from "vitest";
import {
  boardAssigneeOptions,
  cardAssigneeIds,
  cardAssigneeLabel,
  collectContactIds,
  isExternalMember,
  membersForSnapshot,
  syncCardAssignees,
} from "./members";
import type { Board, Card, Team, TeamMember } from "./types";

function member(partial: Partial<TeamMember> & Pick<TeamMember, "id" | "name">): TeamMember {
  return {
    email: `${partial.id}@equipe.local`,
    role: "member",
    color: "teal",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

function board(partial: Partial<Board> & Pick<Board, "id" | "memberIds">): Board {
  return {
    title: partial.title || partial.id,
    description: "",
    listIds: [],
    teamId: partial.teamId ?? null,
    level: "project",
    parentBoardId: null,
    backgroundId: "ceara",
    designId: "classic",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

describe("members and card assignees", () => {
  const ana = member({ id: "ana", name: "Ana" });
  const joao = member({ id: "joao", name: "João Fornecedor", kind: "external", color: "violet" });
  const members = { ana, joao };

  it("treats kind=external as a contact, not a team seat", () => {
    expect(isExternalMember(ana)).toBe(false);
    expect(isExternalMember(joao)).toBe(true);
  });

  it("keeps team and external people in separate assignee groups", () => {
    const options = boardAssigneeOptions({
      board: board({ id: "b1", memberIds: ["ana"], externalMemberIds: ["joao"] }),
      members,
    });
    expect(options.team.map((m) => m.id)).toEqual(["ana"]);
    expect(options.external.map((m) => m.id)).toEqual(["joao"]);
  });

  it("includes a card assignee even if they are not on the team", () => {
    const card = {
      id: "c1",
      listId: "l1",
      title: "Contrato",
      assigneeId: "joao",
    } as Card;
    const ids = collectContactIds({
      board: board({ id: "b1", memberIds: ["ana"] }),
      cards: [card],
    });
    expect(ids).toEqual(["ana", "joao"]);
    expect(membersForSnapshot(members, ids)).toEqual(members);
  });

  it("does not put externals into the team roster used for access", () => {
    const team: Team = {
      id: "team-1",
      name: "ASESI",
      description: "",
      memberIds: ["ana"],
      color: "teal",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const ids = collectContactIds({
      board: board({
        id: "b1",
        memberIds: ["ana"],
        externalMemberIds: ["joao"],
        teamId: team.id,
      }),
      team,
    });
    expect(team.memberIds).toEqual(["ana"]);
    expect(ids).toContain("joao");
  });

  it("lists every team member as an assignee option", () => {
    const bia = member({ id: "bia", name: "Bia" });
    const options = boardAssigneeOptions({
      board: board({ id: "b1", memberIds: ["ana"], teamId: "team-1" }),
      members: { ...members, bia },
      team: {
        memberIds: ["ana", "bia"],
      },
    });
    expect(options.team.map((m) => m.id).sort()).toEqual(["ana", "bia"]);
  });

  it("merges legacy assigneeId with multiple assigneeIds", () => {
    expect(cardAssigneeIds({ assigneeId: "ana" })).toEqual(["ana"]);
    expect(cardAssigneeIds({ assigneeId: "ana", assigneeIds: ["bia", "ana"] })).toEqual([
      "bia",
      "ana",
    ]);
    expect(syncCardAssignees(["bia", "ana", "bia"])).toEqual({
      assigneeId: "bia",
      assigneeIds: ["bia", "ana"],
    });
    expect(cardAssigneeLabel({ ana: { name: "Ana" }, bia: { name: "Bia" } }, {
      assigneeIds: ["ana", "bia"],
    })).toBe("Ana, Bia");
  });

  it("keeps every assigned person when collecting contacts", () => {
    const card = {
      id: "c1",
      listId: "l1",
      title: "Contrato",
      assigneeId: "ana",
      assigneeIds: ["ana", "joao"],
    } as Card;
    const ids = collectContactIds({
      board: board({ id: "b1", memberIds: ["ana"] }),
      cards: [card],
    });
    expect(ids).toEqual(["ana", "joao"]);
  });
});
