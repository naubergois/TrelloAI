import type { CSSProperties } from "react";
import type { LabelColor } from "@/lib/types";
import { LABEL_COLOR_OPTIONS, labelStyles } from "@/lib/utils";

export const CARD_COVER_OPTIONS = [
  { id: "green", name: "Verde", bg: "#61bd4f" },
  { id: "yellow", name: "Amarelo", bg: "#f2d600" },
  { id: "orange", name: "Laranja", bg: "#ff9f1a" },
  { id: "red", name: "Vermelho", bg: "#eb5a46" },
  { id: "purple", name: "Roxo", bg: "#c377e0" },
  { id: "blue", name: "Azul", bg: "#0079bf" },
  { id: "sky", name: "Ciano", bg: "#00c2e0" },
  { id: "lime", name: "Lima", bg: "#51e898" },
  { id: "pink", name: "Rosa", bg: "#ff78cb" },
  { id: "black", name: "Preto", bg: "#344563" },
  { id: "navy", name: "Marinho", bg: "#172b4d" },
  { id: "cream", name: "Creme", bg: "#f4e6c3" },
] as const;

export type CardCoverId = (typeof CARD_COVER_OPTIONS)[number]["id"];

export type CardCoverTone = {
  bg: string;
  text: string;
  muted: string;
  border: string;
};

export const HEX_COVER_RE = /^#([0-9a-f]{6})$/i;

function hexLuminance(hex: string) {
  const match = HEX_COVER_RE.exec(hex);
  if (!match) return 1;
  const n = parseInt(match[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function toneFromHex(bg: string): CardCoverTone {
  const dark = hexLuminance(bg) < 0.58;
  return {
    bg,
    text: dark ? "#ffffff" : "#172b4d",
    muted: dark ? "rgba(255,255,255,0.78)" : "#5e6c84",
    border: dark ? "rgba(255,255,255,0.22)" : "rgba(9,30,66,0.14)",
  };
}

export function normalizeCoverColor(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (CARD_COVER_OPTIONS.some((c) => c.id === trimmed)) return trimmed;
  if (HEX_COVER_RE.test(trimmed)) return trimmed.toLowerCase();
  return null;
}

export function resolveCardCover(coverColor?: string | null): CardCoverTone | null {
  const value = normalizeCoverColor(coverColor);
  if (!value) return null;
  const named = CARD_COVER_OPTIONS.find((c) => c.id === value);
  return toneFromHex(named?.bg ?? value);
}

export function cardCoverStyle(coverColor?: string | null): CSSProperties | undefined {
  const tone = resolveCardCover(coverColor);
  if (!tone) return undefined;
  return {
    background: tone.bg,
    color: tone.text,
    ["--board-card-bg" as string]: tone.bg,
    ["--board-card-text" as string]: tone.text,
    ["--board-card-muted" as string]: tone.muted,
    ["--board-card-border" as string]: tone.border,
  } as CSSProperties;
}

export function labelColorName(color: LabelColor) {
  return LABEL_COLOR_OPTIONS.find((c) => c.id === color)?.name ?? color;
}

export function labelBarClass(color: LabelColor) {
  return labelStyles[color] ?? labelStyles.teal;
}
