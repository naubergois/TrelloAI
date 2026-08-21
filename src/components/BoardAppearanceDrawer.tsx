"use client";

import { Palette, X } from "lucide-react";
import { useBoardStore } from "@/lib/store";
import {
  BOARD_BACKGROUNDS,
  BOARD_DESIGNS,
  DEFAULT_BACKGROUND_ID,
  DEFAULT_DESIGN_ID,
  type BoardBackgroundId,
  type BoardDesignId,
} from "@/lib/board-themes";

export function BoardAppearanceDrawer({
  boardId,
  onClose,
}: {
  boardId: string;
  onClose: () => void;
}) {
  const board = useBoardStore((s) => s.boards[boardId]);
  const updateBoardAppearance = useBoardStore((s) => s.updateBoardAppearance);

  if (!board) return null;

  const bgId = (board.backgroundId as BoardBackgroundId) || DEFAULT_BACKGROUND_ID;
  const designId = (board.designId as BoardDesignId) || DEFAULT_DESIGN_ID;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/55 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-[var(--line)] bg-[var(--panel-strong)] sm:rounded-3xl">
        <header className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
          <div className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-[var(--accent)]" />
            <div>
              <p className="font-[family-name:var(--font-display)] text-white">
                Aparência do board
              </p>
              <p className="text-xs text-[var(--muted)]">{board.title}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-[var(--muted)] hover:text-white"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="board-scroll space-y-4 overflow-y-auto p-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Fundo
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {BOARD_BACKGROUNDS.map((bg) => (
                <button
                  key={bg.id}
                  type="button"
                  onClick={() =>
                    updateBoardAppearance(boardId, { backgroundId: bg.id })
                  }
                  className={`overflow-hidden rounded-xl border text-left ${
                    bg.id === bgId
                      ? "border-[var(--accent)] ring-2 ring-[var(--accent)]/40"
                      : "border-[var(--line)]"
                  }`}
                >
                  <div className="h-14" style={{ backgroundImage: bg.preview }} />
                  <p className="truncate bg-black/30 px-2 py-1.5 text-[11px] text-white">
                    {bg.name}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Design
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {BOARD_DESIGNS.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => updateBoardAppearance(boardId, { designId: d.id })}
                  className={`rounded-xl border px-3 py-2.5 text-left ${
                    d.id === designId
                      ? "border-[var(--accent)] bg-[var(--accent)]/10"
                      : "border-[var(--line)]"
                  }`}
                >
                  <p className="text-sm font-medium text-white">{d.name}</p>
                  <p className="text-[11px] text-[var(--muted)]">{d.description}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        <footer className="border-t border-[var(--line)] p-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-[var(--accent)] px-3 py-2.5 text-sm font-semibold text-teal-950"
          >
            Pronto
          </button>
        </footer>
      </div>
    </div>
  );
}
