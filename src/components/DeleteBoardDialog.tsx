"use client";

import { Loader2, Trash2, X } from "lucide-react";
import { ASESI_BOARD_ID } from "@/lib/constants";

export function DeleteBoardDialog({
  title,
  boardId,
  listCount,
  cardCount,
  childCount,
  busy,
  onCancel,
  onConfirm,
}: {
  title: string;
  boardId: string;
  listCount: number;
  cardCount: number;
  childCount: number;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const official = boardId === ASESI_BOARD_ID;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/65 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-labelledby="delete-board-title"
        aria-modal="true"
        className="w-full max-w-md overflow-hidden rounded-t-3xl border border-[var(--line)] bg-[var(--panel-strong)] sm:rounded-3xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-[var(--line)] px-4 py-3">
          <div>
            <p
              id="delete-board-title"
              className="font-[family-name:var(--font-display)] text-lg text-white"
            >
              Excluir este board?
            </p>
            <p className="mt-1 text-sm text-[var(--muted)]">{title}</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-lg p-2 text-[var(--muted)] hover:text-white disabled:opacity-40"
            aria-label="Cancelar"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="space-y-3 px-4 py-4 text-sm leading-relaxed text-[var(--muted)]">
          <p>
            Listas, cards, dailies e requisitos deste kanban serão apagados. Esta ação{" "}
            <strong className="text-white">não pode ser desfeita</strong>.
          </p>
          <p className="text-xs">
            {listCount} lista(s) · {cardCount} card(s)
            {childCount > 0
              ? ` · ${childCount} board(s) filho(s) ficam sem este superior`
              : ""}
          </p>
          {official ? (
            <p className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
              Este é o board oficial da ASESI. Ele só volta se o ambiente estiver vazio.
            </p>
          ) : null}
        </div>

        <footer className="flex gap-2 border-t border-[var(--line)] p-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="flex-1 rounded-xl border border-[var(--line)] px-3 py-2.5 text-sm text-[var(--muted)] hover:text-white disabled:opacity-40"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-rose-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Excluir board
          </button>
        </footer>
      </div>
    </div>
  );
}
