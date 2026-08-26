import { describe, expect, it } from "vitest";
import {
  isMayaChatSmallTalk,
  isMayaConversationalTurn,
  mayaChatRequestsBoardChange,
  resolveMayaChatReply,
  shouldUseStandupTurn,
} from "./maya-chat-intent";

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

  it("keeps the LLM greeting and drops unsolicited action claims", () => {
    const dropped = resolveMayaChatReply({
      userMessage: "oi",
      apiMessage:
        "Atribuí a tarefa de alta prioridade 'Carteira ASESI no Jangada' ao Charles Marques.",
      greeting: 'Oi. Maya no ar — board "Carteira ASESI", 1 card no buffer.',
    });
    expect(dropped.allowActions).toBe(false);
    expect(dropped.message).toMatch(/Maya no ar/);
    expect(dropped.message).not.toMatch(/Atribuí/);

    const kept = resolveMayaChatReply({
      userMessage: "oi",
      apiMessage: "Oi! Board Carteira ASESI no radar, 3 cards no buffer. Manda o comando.",
      greeting: "fallback",
    });
    expect(kept.message).toMatch(/no radar/);
  });

  it("sends chat and social questions to the LLM even during daily", () => {
    expect(shouldUseStandupTurn("oi", true)).toBe(false);
    expect(shouldUseStandupTurn("como esta seu dia?", true)).toBe(false);
    expect(isMayaConversationalTurn("como esta seu dia?")).toBe(true);
    expect(shouldUseStandupTurn("Crie cards para o plano ASESI", true)).toBe(false);
    expect(shouldUseStandupTurn("Sem bloqueios", true)).toBe(true);
    expect(shouldUseStandupTurn("Terminei o login admin", true)).toBe(true);
    expect(shouldUseStandupTurn("Terminei o login admin", false)).toBe(false);
  });
});
