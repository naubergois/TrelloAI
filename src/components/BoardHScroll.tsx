"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
  type WheelEventHandler,
} from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Overflow = {
  overflow: boolean;
  canLeft: boolean;
  canRight: boolean;
  max: number;
  left: number;
  client: number;
  width: number;
};

function readOverflow(el: HTMLDivElement): Overflow {
  const max = Math.max(0, el.scrollWidth - el.clientWidth);
  const left = el.scrollLeft;
  return {
    overflow: max > 8,
    canLeft: left > 4,
    canRight: left < max - 4,
    max,
    left,
    client: el.clientWidth,
    width: el.scrollWidth,
  };
}

function columnStep(el: HTMLElement) {
  const child = el.querySelector(
    ":scope > :not(.board-h-scroll-end)",
  ) as HTMLElement | null;
  if (child) {
    const styles = window.getComputedStyle(el);
    const gap = Number.parseFloat(styles.columnGap || styles.gap || "12") || 12;
    return Math.round(child.getBoundingClientRect().width + gap);
  }
  return Math.round(Math.min(el.clientWidth * 0.78, 320));
}

function PanButton({
  dir,
  disabled,
  compact,
  onPan,
}: {
  dir: "left" | "right";
  disabled: boolean;
  compact?: boolean;
  onPan: (dir: -1 | 1) => void;
}) {
  const Icon = dir === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      data-board-pan={dir}
      className={
        compact
          ? "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white transition hover:bg-[var(--accent)] hover:text-[var(--accent-on)] disabled:opacity-30"
          : `pointer-events-auto inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/50 text-white shadow-lg shadow-black/30 backdrop-blur-md transition hover:border-[var(--accent)] hover:bg-[var(--accent)] hover:text-[var(--accent-on)] disabled:pointer-events-none disabled:opacity-0 ${
              disabled ? "invisible" : ""
            }`
      }
      aria-label={dir === "left" ? "Ver listas à esquerda" : "Ver listas à direita"}
      disabled={disabled}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onPan(dir === "left" ? -1 : 1);
      }}
    >
      <Icon className={compact ? "h-4 w-4" : "h-5 w-5"} />
    </button>
  );
}

export function BoardHScroll({
  children,
  className = "",
  style,
  onWheel,
  label = "Listas do board",
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  onWheel?: WheelEventHandler<HTMLDivElement>;
  label?: string;
}) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const panAnimRef = useRef<number | null>(null);

  const cancelPanAnim = () => {
    if (panAnimRef.current != null) {
      cancelAnimationFrame(panAnimRef.current);
      panAnimRef.current = null;
    }
  };
  const [state, setState] = useState<Overflow>({
    overflow: false,
    canLeft: false,
    canRight: false,
    max: 0,
    left: 0,
    client: 0,
    width: 1,
  });

  const sync = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setState(readOverflow(el));
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    for (const child of el.children) ro.observe(child);
    el.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
    };
  }, [sync, children]);

  const pan = useCallback((dir: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    cancelPanAnim();
    const max = Math.max(0, el.scrollWidth - el.clientWidth);
    const next = Math.max(0, Math.min(max, el.scrollLeft + dir * columnStep(el)));
    const start = el.scrollLeft;
    const dist = next - start;
    if (Math.abs(dist) < 1) return;
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / 320);
      const ease = 1 - (1 - t) ** 3;
      el.scrollLeft = start + dist * ease;
      if (t < 1) panAnimRef.current = requestAnimationFrame(tick);
      else panAnimRef.current = null;
    };
    panAnimRef.current = requestAnimationFrame(tick);
  }, []);

  const jumpToRatio = (clientX: number) => {
    const el = scrollerRef.current;
    const track = trackRef.current;
    if (!el || !track) return;
    cancelPanAnim();
    const max = Math.max(0, el.scrollWidth - el.clientWidth);
    if (max <= 0) return;
    const rect = track.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    el.scrollLeft = ratio * max;
  };

  const onTrackPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const track = trackRef.current;
    const el = scrollerRef.current;
    if (!track || !el) return;
    el.classList.add("board-h-dragging");
    track.setPointerCapture(event.pointerId);
    jumpToRatio(event.clientX);
  };

  const onTrackPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    scrollerRef.current?.classList.remove("board-h-dragging");
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const onTrackPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    jumpToRatio(event.clientX);
  };

  const thumbWidth = Math.min(
    100,
    Math.max(14, (state.client / Math.max(state.width, 1)) * 100),
  );
  const thumbLeft =
    state.max > 0 ? (state.left / state.max) * (100 - thumbWidth) : 0;

  return (
    <div className="relative">
      <div
        ref={scrollerRef}
        role="region"
        aria-label={label}
        tabIndex={state.overflow ? 0 : undefined}
        className={`board-h-scroll-pane board-h-scroll ${className}`}
        style={style}
        onWheel={onWheel}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            pan(-1);
          }
          if (event.key === "ArrowRight") {
            event.preventDefault();
            pan(1);
          }
        }}
      >
        {children}
      </div>

      {state.overflow ? (
        <>
          <div
            className={`pointer-events-none absolute inset-y-0 left-0 z-10 w-9 bg-gradient-to-r from-black/35 to-transparent transition-opacity ${
              state.canLeft ? "opacity-100" : "opacity-0"
            }`}
            aria-hidden
          />
          <div
            className={`pointer-events-none absolute inset-y-0 right-0 z-10 w-9 bg-gradient-to-l from-black/35 to-transparent transition-opacity ${
              state.canRight ? "opacity-100" : "opacity-0"
            }`}
            aria-hidden
          />

          <div className="pointer-events-none absolute inset-0 z-20">
            <div className="sticky top-[5.25rem] mt-[3.35rem] flex justify-between px-0.5">
              <PanButton dir="left" disabled={!state.canLeft} onPan={pan} />
              <PanButton dir="right" disabled={!state.canRight} onPan={pan} />
            </div>
          </div>

          <div className="sticky bottom-3 z-20 mt-2 flex items-center justify-center px-1">
            <div className="flex w-full max-w-lg items-center gap-1.5 rounded-full border border-white/18 bg-black/55 px-1.5 py-1 shadow-lg shadow-black/30 backdrop-blur-md">
              <PanButton dir="left" disabled={!state.canLeft} compact onPan={pan} />
              <div
                ref={trackRef}
                role="scrollbar"
                aria-orientation="horizontal"
                aria-valuemin={0}
                aria-valuemax={Math.round(state.max)}
                aria-valuenow={Math.round(state.left)}
                aria-label="Posição das listas"
                className="relative h-7 min-w-0 flex-1 cursor-pointer touch-none py-2"
                onPointerDown={onTrackPointerDown}
                onPointerMove={onTrackPointerMove}
                onPointerUp={onTrackPointerUp}
                onPointerCancel={onTrackPointerUp}
              >
                <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-white/15" />
                <div
                  className="absolute top-1/2 h-2.5 -translate-y-1/2 rounded-full bg-[var(--accent)] shadow-[0_0_12px_rgba(255,209,0,0.45)]"
                  style={{ left: `${thumbLeft}%`, width: `${thumbWidth}%` }}
                />
              </div>
              <PanButton dir="right" disabled={!state.canRight} compact onPan={pan} />
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
