import { describe, expect, it } from "vitest";
import { boardThemeStyle, getCardTheme } from "./board-themes";
import { boardPhotoCatalog, isUsableBackgroundUrl } from "./board-photos";

describe("board appearance", () => {
  it("applies card color vars", () => {
    const style = boardThemeStyle({
      backgroundId: "ceara",
      designId: "classic",
      cardThemeId: "dark",
    });
    expect(style["--board-card-bg"]).toBe(getCardTheme("dark").vars["--board-card-bg"]);
  });

  it("uses photo overlay when a background image is set", () => {
    const style = boardThemeStyle({
      backgroundId: "ceara",
      designId: "classic",
      backgroundImageUrl: "https://picsum.photos/id/10/1600/900",
      backgroundTint: 40,
    });
    expect(String(style.backgroundImage)).toContain("url(");
    expect(String(style.backgroundImage)).toContain("linear-gradient");
    expect(style.backgroundSize).toBe("cover");
  });

  it("exposes hundreds of gallery photos and validates urls", () => {
    expect(boardPhotoCatalog().length).toBeGreaterThanOrEqual(300);
    expect(isUsableBackgroundUrl("https://picsum.photos/id/10/1600/900")).toBe(true);
    expect(isUsableBackgroundUrl("javascript:alert(1)")).toBe(false);
  });
});
