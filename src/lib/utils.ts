import type { LabelColor } from "@/lib/types";
import { clsx } from "clsx";

export function cn(...inputs: Array<string | false | null | undefined>) {
  return clsx(inputs);
}

export const labelStyles: Record<LabelColor, string> = {
  teal: "bg-[#0079bf] text-white",
  amber: "bg-[#f2d600] text-[#172b4d]",
  rose: "bg-[#eb5a46] text-white",
  sky: "bg-[#00c2e0] text-[#172b4d]",
  lime: "bg-[#61bd4f] text-[#172b4d]",
  violet: "bg-[#c377e0] text-[#172b4d]",
};

/** Priority badges on white board cards */
export const cardPriorityStyles = {
  high: "bg-rose-100 text-rose-700 ring-rose-200",
  medium: "bg-amber-100 text-amber-800 ring-amber-200",
  low: "bg-emerald-100 text-emerald-800 ring-emerald-200",
} as const;

export const priorityStyles = {
  high: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
  medium: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  low: "bg-teal-500/15 text-teal-300 ring-teal-500/30",
} as const;

export const priorityLabel = {
  high: "Alta",
  medium: "Média",
  low: "Baixa",
} as const;

export const requirementStatusLabel = {
  draft: "Rascunho",
  approved: "Aprovado",
  in_progress: "Em andamento",
  done: "Concluído",
  rejected: "Rejeitado",
} as const;

export const requirementStatusStyles = {
  draft: "bg-white/5 text-[var(--muted)] ring-white/10",
  approved: "bg-sky-500/15 text-sky-300 ring-sky-500/30",
  in_progress: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  done: "bg-teal-500/15 text-teal-300 ring-teal-500/30",
  rejected: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
} as const;

export const teamEventKindLabel = {
  meeting: "Reunião",
  deadline: "Prazo",
  milestone: "Marco",
  review: "Revisão",
  other: "Outro",
} as const;

export const teamEventKindStyles = {
  meeting: "bg-sky-500/20 text-sky-200",
  deadline: "bg-rose-500/20 text-rose-200",
  milestone: "bg-[var(--accent)]/20 text-[var(--accent)]",
  review: "bg-amber-500/20 text-amber-200",
  other: "bg-white/10 text-[var(--muted)]",
} as const;

export const teamEventKindDot = {
  meeting: "bg-sky-400",
  deadline: "bg-rose-400",
  milestone: "bg-[var(--accent)]",
  review: "bg-amber-400",
  other: "bg-[var(--muted)]",
} as const;

export const activityKindLabel = {
  card_create: "criou card",
  card_update: "atualizou card",
  card_move: "moveu card",
  card_delete: "excluiu card",
  card_archive: "arquivou card",
  card_comment: "comentou",
  standup_reply: "respondeu daily",
} as const;

export const LABEL_COLOR_OPTIONS: { id: import("./types").LabelColor; name: string }[] = [
  { id: "teal", name: "Azul" },
  { id: "lime", name: "Verde" },
  { id: "amber", name: "Amarelo" },
  { id: "rose", name: "Vermelho" },
  { id: "violet", name: "Roxo" },
  { id: "sky", name: "Ciano" },
];
