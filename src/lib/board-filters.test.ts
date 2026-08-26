import { describe, expect, it } from "vitest";
import { EMPTY_BOARD_FILTER, cardMatchesFilter } from "./board-filters";

describe("cardMatchesFilter assignees", () => {
  it("matches a secondary responsible on the card", () => {
    const card = {
      title: "Homologar",
      assigneeId: "ana",
      assigneeIds: ["ana", "bia"],
    };
    expect(
      cardMatchesFilter(card, { ...EMPTY_BOARD_FILTER, assigneeId: "bia" }),
    ).toBe(true);
    expect(
      cardMatchesFilter(card, { ...EMPTY_BOARD_FILTER, assigneeId: "leo" }),
    ).toBe(false);
  });
});
