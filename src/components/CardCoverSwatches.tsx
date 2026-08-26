"use client";

import { Check } from "lucide-react";
import {
  CARD_COVER_OPTIONS,
  HEX_COVER_RE,
  normalizeCoverColor,
  resolveCardCover,
} from "@/lib/card-appearance";

export function CardCoverSwatches({
  value,
  onChange,
}: {
  value?: string | null;
  onChange: (next: string | null) => void;
}) {
  const current = normalizeCoverColor(value);
  const custom = HEX_COVER_RE.test(current || "");

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        onClick={() => onChange(null)}
        className={`h-7 rounded-md border px-2 text-[10px] font-medium ${
          !current
            ? "border-[var(--accent)] bg-white text-[var(--ink)] ring-2 ring-[var(--accent)]"
            : "border-black/15 bg-white/80 text-[var(--board-card-text,#172b4d)] hover:bg-white"
        }`}
        title="Usar a cor padrão do board"
      >
        Padrão
      </button>
      {CARD_COVER_OPTIONS.map((cover) => {
        const selected = current === cover.id;
        const checkColor = resolveCardCover(cover.id)?.text ?? "#ffffff";
        return (
          <button
            key={cover.id}
            type="button"
            title={cover.name}
            aria-pressed={selected}
            onClick={() => onChange(selected ? null : cover.id)}
            className={`relative h-7 w-7 rounded-md border ${
              selected
                ? "border-white ring-2 ring-[var(--accent)]"
                : "border-black/20 hover:scale-105"
            }`}
            style={{ background: cover.bg }}
          >
            {selected ? (
              <Check
                className="mx-auto h-3.5 w-3.5 drop-shadow"
                style={{ color: checkColor }}
              />
            ) : null}
            <span className="sr-only">{cover.name}</span>
          </button>
        );
      })}
      <label
        className={`relative h-7 w-7 cursor-pointer overflow-hidden rounded-md border ${
          custom
            ? "border-white ring-2 ring-[var(--accent)]"
            : "border-black/20"
        }`}
        title="Cor personalizada"
      >
        <span
          className="absolute inset-0"
          style={{
            background:
              resolveCardCover(current)?.bg ??
              "conic-gradient(red, yellow, lime, aqua, blue, magenta, red)",
          }}
        />
        <input
          type="color"
          className="absolute inset-0 cursor-pointer opacity-0"
          value={resolveCardCover(current)?.bg ?? "#0079bf"}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Cor personalizada do card"
        />
      </label>
    </div>
  );
}
