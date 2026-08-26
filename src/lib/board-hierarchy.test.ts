import { describe, expect, it } from "vitest";
import {
  eligibleParentBoards,
  isValidParentLevel,
  parentLevelFor,
} from "./board-hierarchy";

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
