import { describe, expect, it } from "vitest";
import { ASESI_BOARD_ID, CGE_BOARD_ID } from "./constants";
import {
  applyOfficialBoardHierarchy,
  eligibleParentBoards,
  getChildBoards,
  isValidParentLevel,
  parentLevelFor,
} from "./board-hierarchy";
import type { Board } from "./types";

describe("board hierarchy parents", () => {
  it("keeps the preferred immediate parent", () => {
    expect(parentLevelFor("team")).toBe("unit");
    expect(parentLevelFor("project")).toBe("team");
    expect(parentLevelFor("organization")).toBeNull();
  });

  it("allows a team under the organization when there is no unit", () => {
    expect(isValidParentLevel("organization", "team")).toBe(true);
    expect(isValidParentLevel("organization", "project")).toBe(true);
    expect(isValidParentLevel("team", "project")).toBe(true);
    expect(isValidParentLevel("project", "team")).toBe(false);
    expect(isValidParentLevel("team", "organization")).toBe(false);
  });

  it("lists eligible parents skipping the child itself", () => {
    const boards = [
      { id: "cge", level: "organization" as const },
      { id: "asesi", level: "team" as const },
      { id: "farol", level: "project" as const },
    ];
    expect(eligibleParentBoards("team", boards).map((b) => b.id)).toEqual(["cge"]);
    expect(eligibleParentBoards("project", boards, "farol").map((b) => b.id)).toEqual([
      "cge",
      "asesi",
    ]);
  });
});

describe("applyOfficialBoardHierarchy", () => {
  it("puts ASESI back under CGE when a stale snapshot made it an organization", () => {
    const drifted = applyOfficialBoardHierarchy({
      id: ASESI_BOARD_ID,
      level: "organization" as const,
      parentBoardId: null,
    });
    expect(drifted).toEqual({
      id: ASESI_BOARD_ID,
      level: "team",
      parentBoardId: CGE_BOARD_ID,
    });

    const cge = applyOfficialBoardHierarchy({
      id: CGE_BOARD_ID,
      level: "team" as const,
      parentBoardId: "asesi",
    });
    expect(cge).toEqual({
      id: CGE_BOARD_ID,
      level: "organization",
      parentBoardId: null,
    });
  });

  it("lets CGE list ASESI after the official parent is restored", () => {
    const boards: Record<string, Board> = {
      cge: {
        id: "cge",
        title: "CGE",
        description: "",
        listIds: [],
        memberIds: [],
        teamId: null,
        level: "organization",
        parentBoardId: null,
        backgroundId: "ceara",
        designId: "classic",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      asesi: applyOfficialBoardHierarchy({
        id: "asesi",
        title: "ASESI",
        description: "",
        listIds: [],
        memberIds: [],
        teamId: "asesi-team",
        level: "organization",
        parentBoardId: null,
        backgroundId: "trello",
        designId: "classic",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      }),
    };
    expect(getChildBoards("cge", boards).map((b) => b.id)).toEqual(["asesi"]);
  });
});
