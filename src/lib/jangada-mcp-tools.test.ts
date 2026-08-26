import { describe, expect, it } from "vitest";
import {
  applyAdicionarGit,
  applyAtualizarResumo,
  applyCriarCard,
  applyCriarLista,
  applyMoverCard,
  compactBoard,
  findList,
} from "../../scripts/jangada-mcp-tools.mjs";

function snapshot() {
  return {
    board: {
      id: "asesi",
      title: "ASESI",
      listIds: ["backlog", "doing"],
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    lists: {
      backlog: { id: "backlog", boardId: "asesi", title: "Backlog", cardIds: [] },
      doing: { id: "doing", boardId: "asesi", title: "Em andamento", cardIds: [] },
    },
    cards: {},
    requirements: {},
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("jangada MCP snapshot tools", () => {
  it("creates a card on a list found by title", () => {
    const { snapshot: next, cardId, listId } = applyCriarCard(snapshot(), {
      title: "Mapear fontes",
      list_title: "Backlog",
      priority: "high",
    });
    expect(listId).toBe("backlog");
    expect(next.cards[cardId].title).toBe("Mapear fontes");
    expect(next.lists.backlog.cardIds).toContain(cardId);
    expect(compactBoard(next).lists[0].cards[0].title).toBe("Mapear fontes");
  });

  it("creates a list and moves a card onto it", () => {
    const withList = applyCriarLista(snapshot(), { title: "Bloqueios" });
    const withCard = applyCriarCard(withList.snapshot, { title: "VPN", list_title: "Backlog" });
    const moved = applyMoverCard(withCard.snapshot, {
      card_id: withCard.cardId,
      list_id: withList.listId,
    });
    expect(moved.snapshot.cards[withCard.cardId].listId).toBe(withList.listId);
    expect(moved.snapshot.lists.backlog.cardIds).not.toContain(withCard.cardId);
    expect(findList(moved.snapshot, withList.listId)?.cardIds).toContain(withCard.cardId);
  });

  it("links a git repo to the board without duplicating the same URL", () => {
    const first = applyAdicionarGit(snapshot(), {
      url: "http://git.cge.local/g_asesi/jangada.git",
    });
    const again = applyAdicionarGit(first.snapshot, {
      url: "http://git.cge.local/g_asesi/jangada.git",
    });
    expect(first.repoId).toBeTruthy();
    expect(again.repoId).toBe(first.repoId);
    expect(first.snapshot.board.gitRepos).toHaveLength(1);
    expect(compactBoard(first.snapshot).board.gitRepos[0].url).toContain("jangada.git");
  });

  it("stores and returns an executive summary on the board", () => {
    const { snapshot: next, executiveSummary } = applyAtualizarResumo(snapshot(), {
      resumo: "  Situação estável.\r\nPrioridade: piloto.  ",
    });
    expect(executiveSummary).toBe("Situação estável.\nPrioridade: piloto.");
    expect(compactBoard(next).board.executiveSummary).toBe(
      "Situação estável.\nPrioridade: piloto.",
    );
  });
});
