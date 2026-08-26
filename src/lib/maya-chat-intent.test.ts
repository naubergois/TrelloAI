import { describe, expect, it } from "vitest";
import { isMayaChatSmallTalk, mayaChatRequestsBoardChange } from "./maya-chat-intent";

describe("Maya chat intent", () => {
  it("treats greetings as small talk", () => {
    for (const text of ["oi", "Oi!", "olá Maya", "bom dia", "eae", "ok", "valeu"]) {
      expect(isMayaChatSmallTalk(text)).toBe(true);
      expect(mayaChatRequestsBoardChange(text)).toBe(false);
    }
  });

  it("does not treat management requests as small talk", () => {
    expect(isMayaChatSmallTalk("Crie cards para o plano ASESI")).toBe(false);
    expect(mayaChatRequestsBoardChange("Crie cards para o plano ASESI")).toBe(true);
    expect(mayaChatRequestsBoardChange("Atribua Validar Jangada para Ana")).toBe(true);
    expect(mayaChatRequestsBoardChange("Mova X para concluído")).toBe(true);
  });

  it("does not treat status questions as board changes", () => {
    expect(mayaChatRequestsBoardChange("Qual a situação deste board?")).toBe(false);
    expect(mayaChatRequestsBoardChange("como está o projeto")).toBe(false);
  });
});
