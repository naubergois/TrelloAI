import { describe, expect, it } from "vitest";
import type { BoardSnapshot } from "./board-snapshot";
import type { Board, Team } from "./types";
import {
  addProfileToTeamSnapshots,
  attachTeamToSnapshot,
  membershipBoardIdsForTeam,
  snapshotHasTeam,
  stripTeamFromSnapshot,
} from "./team-ops";

function board(partial: Partial<Board> & Pick<Board, "id" | "teamId">): Board {
  return {
    title: partial.title || partial.id,
    description: "",
    listIds: [],
    memberIds: partial.memberIds || [],
    level: "team",
    parentBoardId: null,
    backgroundId: "ceara",
    designId: "classic",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

function snap(partial: Partial<BoardSnapshot> & { board: Board }): BoardSnapshot {
  return {
    lists: {},
    cards: {},
    members: {},
    teams: {},
    meetings: {},
    managers: {},
    standups: {},
    activities: {},
    requirements: {},
    calendarEvents: {},
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

const engineering: Team = {
  id: "team-eng",
  name: "Engenharia",
  description: "",
  memberIds: ["owner-1"],
  color: "teal",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("team snapshot ops", () => {
  it("strips a team from every snapshot and unlinks the board", () => {
    const linked = snap({
      board: board({ id: "b1", teamId: "team-eng", memberIds: ["owner-1"] }),
      teams: { "team-eng": engineering },
    });
    const catalog = snap({
      board: board({ id: "b2", teamId: "other" }),
      teams: { "team-eng": engineering },
    });

    const stripped = stripTeamFromSnapshot(linked, "team-eng");
    expect(stripped.board.teamId).toBeNull();
    expect(stripped.teams["team-eng"]).toBeUndefined();
    expect(snapshotHasTeam(stripTeamFromSnapshot(catalog, "team-eng"), "team-eng")).toBe(
      false,
    );
  });

  it("attaches a team catalog without changing the board assignment", () => {
    const base = snap({ board: board({ id: "b1", teamId: null }) });
    const next = attachTeamToSnapshot(base, engineering);
    expect(next.board.teamId).toBeNull();
    expect(next.teams["team-eng"]?.name).toBe("Engenharia");
  });

  it("joins linked boards, not a catalog-only host", () => {
    const snapshots = [
      snap({
        board: board({ id: "linked", teamId: "team-eng" }),
        teams: { "team-eng": engineering },
      }),
      snap({
        board: board({ id: "host", teamId: null }),
        teams: { "team-eng": engineering },
      }),
    ];
    expect(membershipBoardIdsForTeam(snapshots, "team-eng", "host")).toEqual(["linked"]);
    expect(membershipBoardIdsForTeam(snapshots, "team-eng", "host").length).toBe(1);
    expect(membershipBoardIdsForTeam(snapshots, null, "host")).toEqual(["host"]);
  });

  it("adds the person to the team and to linked boards", () => {
    const snapshots = [
      snap({
        board: board({ id: "linked", teamId: "team-eng", memberIds: ["owner-1"] }),
        teams: { "team-eng": engineering },
        members: {
          "owner-1": {
            id: "owner-1",
            name: "Ana",
            email: "ana@cge.ce.gov.br",
            role: "owner",
            color: "teal",
            createdAt: "2026-01-01T00:00:00.000Z",
          },
        },
      }),
    ];
    const { snapshots: next, memberId } = addProfileToTeamSnapshots(snapshots, {
      teamId: "team-eng",
      membershipBoardIds: ["linked"],
      profile: { name: "Bia", email: "bia@cge.ce.gov.br" },
    });
    expect(next[0].teams["team-eng"].memberIds).toContain(memberId);
    expect(next[0].board.memberIds).toContain(memberId);
    expect(next[0].members[memberId].email).toBe("bia@cge.ce.gov.br");
  });
});
