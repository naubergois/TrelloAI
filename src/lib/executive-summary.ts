import type { BoardIndicatorStats } from "@/lib/board-indicators";

export const EXECUTIVE_SUMMARY_MAX = 8000;

export function sanitizeExecutiveSummary(value: string | null | undefined): string {
  if (!value) return "";
  return String(value)
    .replace(/\r\n/g, "\n")
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, EXECUTIVE_SUMMARY_MAX);
}

export function executiveSummaryExcerpt(
  value: string | null | undefined,
  maxChars = 220,
): string {
  const text = sanitizeExecutiveSummary(value).replace(/\s+/g, " ");
  if (!text) return "";
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(1, maxChars - 1)).trimEnd()}…`;
}

export function draftExecutiveSummary(input: {
  title: string;
  description?: string | null;
  stats: BoardIndicatorStats;
  descendantCount?: number;
}): string {
  const stats = input.stats;
  const lines: string[] = [`${input.title.trim() || "Board"} — resumo executivo`];

  const description = sanitizeExecutiveSummary(input.description || "");
  if (description) lines.push("", description);

  const situation: string[] = [];
  if (stats.cards > 0) {
    situation.push(
      `${stats.progressPct}% concluído (${stats.done}/${stats.cards} cards)`,
    );
  } else {
    situation.push("sem cards ativos");
  }
  if (stats.wip > 0) situation.push(`em curso: ${stats.wip}`);
  if (stats.overdue > 0) situation.push(`atrasados: ${stats.overdue}`);
  if (stats.blocked > 0) situation.push(`bloqueios: ${stats.blocked}`);
  if (stats.highPriority > 0) situation.push(`alta prioridade: ${stats.highPriority}`);
  if (stats.risks > 0) {
    situation.push(
      stats.risksHigh > 0
        ? `riscos: ${stats.risks} (${stats.risksHigh} alta)`
        : `riscos: ${stats.risks}`,
    );
  }
  const situationText = situation
    .map((part, i) => (i === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join(". ");
  lines.push("", `Situação: ${situationText}.`);

  if (stats.cards > 0) {
    lines.push(
      `Fluxo: backlog ${stats.backlog} · em andamento ${stats.doing} · revisão ${stats.review} · concluído ${stats.done}.`,
    );
  }
  if (stats.requirements > 0) {
    lines.push(
      `Requisitos: ${stats.requirementsDone}/${stats.requirements} concluídos.`,
    );
  }
  if (input.descendantCount && input.descendantCount > 0) {
    lines.push(
      `Carteira: inclui ${input.descendantCount} board${
        input.descendantCount === 1 ? "" : "s"
      } inferior${input.descendantCount === 1 ? "" : "es"}.`,
    );
  }

  return sanitizeExecutiveSummary(lines.join("\n"));
}
