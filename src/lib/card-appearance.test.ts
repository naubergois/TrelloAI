import { describe, expect, it } from "vitest";
import {
  cardCoverStyle,
  normalizeCoverColor,
  resolveCardCover,
} from "./card-appearance";

describe("card appearance", () => {
  it("keeps named cover colors and hex, drops invalid values", () => {
    expect(normalizeCoverColor("blue")).toBe("blue");
    expect(normalizeCoverColor("#EB5A46")).toBe("#eb5a46");
    expect(normalizeCoverColor("not-a-color")).toBeNull();
    expect(normalizeCoverColor("")).toBeNull();
  });

  it("uses light text on dark covers and dark text on light covers", () => {
    expect(resolveCardCover("navy")?.text).toBe("#ffffff");
    expect(resolveCardCover("yellow")?.text).toBe("#172b4d");
    expect(resolveCardCover("#000000")?.text).toBe("#ffffff");
    expect(resolveCardCover("#ffffff")?.text).toBe("#172b4d");
  });

  it("sets CSS variables used by the board card surface", () => {
    const style = cardCoverStyle("red") as Record<string, string>;
    expect(style["--board-card-bg"]).toBe("#eb5a46");
    expect(style.background).toBe("#eb5a46");
    expect(cardCoverStyle(null)).toBeUndefined();
  });
});
