import type { BoardRisk, Card, GitCoverageItem, Requirement } from "./types";

const STOP = new Set([
  "para",
  "com",
  "uma",
  "dos",
  "das",
  "que",
  "por",
  "the",
  "and",
  "card",
  "lista",
  "board",
  "kanban",
  "projeto",
  "gestao",
  "gestão",
]);

export function significantTokens(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4 && !STOP.has(w));
}

export function matchCoverage(
  title: string,
  haystack: string,
): { status: GitCoverageItem["status"]; evidence?: string } {
  const tokens = significantTokens(title);
  if (tokens.length === 0) return { status: "missing" };
  const hits = tokens.filter((t) => haystack.includes(t));
  if (hits.length >= 2 || (hits.length === 1 && tokens.length === 1)) {
    return { status: "implemented", evidence: hits.slice(0, 4).join(", ") };
  }
  if (hits.length === 1) return { status: "partial", evidence: hits[0] };
  return { status: "missing" };
}

export function analyzeGitCoverage(opts: {
  cards: { id: string; title: string }[];
  requirements: { id: string; title: string; code?: string }[];
  files: string[];
  readmeExcerpt?: string;
}): GitCoverageItem[] {
  const haystack = `${opts.files.join("\n")}\n${opts.readmeExcerpt || ""}`.toLowerCase();
  const items: GitCoverageItem[] = [];
  for (const card of opts.cards) {
    const match = matchCoverage(card.title, haystack);
    items.push({ kind: "card", id: card.id, title: card.title, ...match });
  }
  for (const req of opts.requirements) {
    const match = matchCoverage(`${req.code || ""} ${req.title}`, haystack);
    items.push({ kind: "requirement", id: req.id, title: req.title, ...match });
  }
  return items;
}

export function analyzeBoardRisks(opts: {
  lists: { id: string; title: string; cards: (Pick<Card, "id" | "title" | "priority" | "dueDate" | "assigneeId"> & { listTitle?: string })[] }[];
  requirements?: Pick<Requirement, "id" | "title" | "code" | "status">[];
  today?: string;
}): BoardRisk[] {
  const today = opts.today || new Date().toISOString().slice(0, 10);
  const risks: BoardRisk[] = [];
  const allCards = opts.lists.flatMap((list) =>
    list.cards.map((c) => ({ ...c, listTitle: list.title })),
  );
  const firstList = opts.lists[0]?.title || "";

  for (const card of allCards) {
    if (card.dueDate && card.dueDate < today && !/conclu|done|feito/i.test(card.listTitle || "")) {
      risks.push({
        id: `overdue-${card.id}`,
        title: `Atraso: ${card.title}`,
        severity: "high",
        reason: `Prazo ${card.dueDate} vencido e o card ainda está em "${card.listTitle}".`,
        cardId: card.id,
      });
    }
    if (card.priority === "high" && /backlog|fazer|todo/i.test(card.listTitle || firstList) && card.listTitle === opts.lists[0]?.title) {
      risks.push({
        id: `stuck-high-${card.id}`,
        title: `Alta prioridade parada: ${card.title}`,
        severity: "high",
        reason: "Card de prioridade alta ainda no backlog.",
        cardId: card.id,
      });
    }
    if (card.priority === "high" && !card.assigneeId) {
      risks.push({
        id: `unassigned-${card.id}`,
        title: `Sem responsável: ${card.title}`,
        severity: "medium",
        reason: "Prioridade alta sem assignee.",
        cardId: card.id,
      });
    }
    if (/bloqueio|blocker|risco/i.test(card.title)) {
      risks.push({
        id: `blocker-${card.id}`,
        title: card.title,
        severity: "high",
        reason: "Card marcado como bloqueio/risco.",
        cardId: card.id,
      });
    }
  }

  for (const req of opts.requirements || []) {
    if (req.status === "rejected" || req.status === "done") continue;
    const linked = allCards.some(
      (c) =>
        c.title.toLowerCase().includes((req.code || "").toLowerCase()) ||
        significantTokens(req.title).some((t) => c.title.toLowerCase().includes(t)),
    );
    if (!linked) {
      risks.push({
        id: `req-${req.id}`,
        title: `Requisito sem card: ${req.code || req.title}`,
        severity: "medium",
        reason: "Não há card claramente associado a este requisito.",
      });
    }
  }

  const unique = risks.filter(
    (r, i, arr) => arr.findIndex((x) => x.title.toLowerCase() === r.title.toLowerCase()) === i,
  );
  return unique.slice(0, 16);
}
