import type { LabelColor } from "@/lib/types";
import { clsx } from "clsx";

export function cn(...inputs: Array<string | false | null | undefined>) {
  return clsx(inputs);
}

export const labelStyles: Record<LabelColor, string> = {
  teal: "bg-teal-500/90 text-teal-950",
  amber: "bg-amber-400/90 text-amber-950",
  rose: "bg-rose-400/90 text-rose-950",
  sky: "bg-sky-400/90 text-sky-950",
  lime: "bg-lime-400/90 text-lime-950",
  violet: "bg-violet-400/90 text-violet-950",
};

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
