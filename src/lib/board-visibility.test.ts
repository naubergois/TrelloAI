import { describe, expect, it } from "vitest";
import {
  applyVisibilityPreference,
  buildBoardCatalog,
  catalogDepth,
  filterExistingBoardIds,
  orderedCatalog,
  uniqueBoardIds,
  withDescendantBoardIds,
} from "./board-visibility";

describe("board visibility helpers", () => {
  it("drops unknown and duplicate ids", () => {
    expect(filterExistingBoardIds(["asesi", "asesi", "ghost", ""], ["cge", "asesi"])).toEqual([
      "asesi",
    ]);
    expect(uniqueBoardIds([" b1 ", "b1", "b2"])).toEqual(["b1", "b2"]);
  });

  it("keeps every accessible board when there is no preference", () => {
    const boards = [{ id: "cge" }, { id: "asesi" }];
    expect(applyVisibilityPreference(boards, null, (b) => b.id)).toEqual(boards);
  });

  it("intersects an explicit preference with accessible boards", () => {
    const boards = [{ id: "cge" }, { id: "asesi" }, { id: "farol" }];
    expect(applyVisibilityPreference(boards, ["asesi", "ghost"], (b) => b.id)).toEqual([
      { id: "asesi" },
    ]);
    expect(applyVisibilityPreference(boards, [], (b) => b.id)).toEqual([]);
  });

  it("keeps descendants when a parent is selected", () => {
    const boards = [
      { id: "cge", parentBoardId: null },
      { id: "asesi", parentBoardId: "cge" },
      { id: "farol", parentBoardId: "asesi" },
      { id: "other", parentBoardId: null },
    ];
    expect(withDescendantBoardIds(["cge"], boards).sort()).toEqual([
      "asesi",
      "cge",
      "farol",
    ]);
    expect(withDescendantBoardIds(["asesi"], boards).sort()).toEqual([
      "asesi",
      "farol",
    ]);
  });

  it("marks selected boards and nests children under parents", () => {
    const catalog = buildBoardCatalog(
      [
        { id: "asesi", title: "ASESI", level: "unit", parentBoardId: "cge" },
        { id: "cge", title: "CGE", level: "organization", parentBoardId: null },
        { id: "farol", title: "Farol", level: "project", parentBoardId: "asesi" },
      ],
      ["asesi"],
    );
    expect(catalog.find((b) => b.id === "asesi")?.selected).toBe(true);
    expect(catalog.find((b) => b.id === "cge")?.selected).toBe(false);

    const ordered = orderedCatalog(catalog);
    expect(ordered.map((b) => b.id)).toEqual(["cge", "asesi", "farol"]);
    expect(catalogDepth(ordered[2], catalog)).toBe(2);
  });
});
