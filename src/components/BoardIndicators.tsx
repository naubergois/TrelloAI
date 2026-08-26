"use client";

import type { BoardCardFilter } from "@/lib/board-filters";
import {
  boardIndicatorChips,
  stageBarSegments,
  type BoardIndicatorStats,
  type IndicatorChip,
  type IndicatorTone,
} from "@/lib/board-indicators";

const TONE_CLASS: Record<IndicatorTone, string> = {
  neutral: "bg-black/35 text-white/90",
  ok: "bg-lime-400/90 text-slate-950",
  warn: "bg-amber-400/90 text-slate-950",
  danger: "bg-rose-500/90 text-white",
  info: "bg-sky-400/90 text-slate-950",
};

function Chip({
  chip,
  clickable,
  active,
  onClick,
}: {
  chip: IndicatorChip;
  clickable?: boolean;
  active?: boolean;
  onClick?: () => void;
}) {
  const className = `inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${TONE_CLASS[chip.tone]} ${
    active ? "ring-2 ring-white/80" : ""
  } ${clickable ? "cursor-pointer hover:brightness-110" : ""}`;

  if (clickable && onClick) {
    return (
      <button type="button" className={className} onClick={onClick} title={chip.label}>
        <span className="opacity-80">{chip.label}</span>
        <span>{chip.value}</span>
      </button>
    );
  }

  return (
    <span className={className} title={chip.label}>
      <span className="opacity-80">{chip.label}</span>
      <span>{chip.value}</span>
    </span>
  );
}

function StageBar({ stats }: { stats: BoardIndicatorStats }) {
  const segments = stageBarSegments(stats);
  if (stats.cards === 0) {
    return (
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/35">
        <div className="h-full w-1/5 bg-white/20" />
      </div>
    );
  }
  return (
    <div
      className="flex h-1.5 w-full overflow-hidden rounded-full bg-black/35"
      title={`Backlog ${stats.backlog} · Em curso ${stats.wip} · Feito ${stats.done}`}
    >
      {segments.map((seg) => (
        <div
          key={seg.key}
          className={`h-full ${seg.className}`}
          style={{ width: `${seg.pct}%` }}
        />
      ))}
    </div>
  );
}

export function BoardIndicators({
  stats,
  variant = "compact",
  rolledUp = false,
  onChipClick,
  activeFilter,
}: {
  stats: BoardIndicatorStats;
  variant?: "compact" | "full";
  rolledUp?: boolean;
  onChipClick?: (chip: IndicatorChip) => void;
  activeFilter?: BoardCardFilter;
}) {
  const chips = boardIndicatorChips(stats, { compact: variant === "compact" });
  const clickable = Boolean(onChipClick) && variant === "full";

  if (stats.cards === 0 && stats.risks === 0 && stats.requirements === 0) {
    return variant === "full" ? (
      <p className="text-[11px] text-white/65">Sem indicadores ainda — o board está vazio.</p>
    ) : (
      <p className="text-[10px] text-white/70">Sem cards</p>
    );
  }

  return (
    <div className={variant === "full" ? "space-y-2" : "space-y-1.5"}>
      <div className="flex items-center gap-2">
        <StageBar stats={stats} />
        {stats.cards > 0 ? (
          <span
            className={`shrink-0 font-semibold tabular-nums ${
              variant === "full" ? "text-xs text-white/85" : "text-[10px] text-white/85"
            }`}
          >
            {stats.progressPct}%
          </span>
        ) : null}
      </div>
      {chips.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {chips.map((chip) => (
            <Chip
              key={chip.key}
              chip={chip}
              clickable={clickable && Boolean(chip.filter)}
              active={
                Boolean(
                  chip.filter &&
                    activeFilter &&
                    ((chip.filter.due && activeFilter.due === chip.filter.due) ||
                      (chip.filter.priority &&
                        activeFilter.priority === chip.filter.priority)),
                )
              }
              onClick={
                clickable && chip.filter && onChipClick
                  ? () => onChipClick(chip)
                  : undefined
              }
            />
          ))}
        </div>
      ) : null}
      {rolledUp && variant === "full" ? (
        <p className="text-[10px] text-white/60">Inclui boards inferiores</p>
      ) : null}
    </div>
  );
}
