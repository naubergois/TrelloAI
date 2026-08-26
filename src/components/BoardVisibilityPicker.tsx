"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Eye, Loader2, Search, X } from "lucide-react";
import {
  BOARD_LEVEL_LABELS,
  BOARD_LEVEL_STYLES,
} from "@/lib/board-hierarchy";
import {
  catalogDepth,
  isFeaturedHomeBoard,
  orderedCatalog,
  type BoardCatalogItem,
} from "@/lib/board-visibility";
import { saveVisibleBoards } from "@/lib/board-sync";
import { useToast } from "@/components/Toast";

export function BoardVisibilityPicker({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<BoardCatalogItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setQuery("");
    fetch("/api/boards/catalog", { credentials: "include" })
      .then(async (res) => {
        const data = (await res.json()) as { boards?: BoardCatalogItem[]; error?: string };
        if (!res.ok) throw new Error(data.error || "Não foi possível listar os boards.");
        if (cancelled) return;
        const boards = data.boards ?? [];
        setItems(boards);
        setSelected(
          new Set([
            ...boards.filter((b) => b.selected).map((b) => b.id),
            ...boards.filter((b) => isFeaturedHomeBoard(b.id)).map((b) => b.id),
          ]),
        );
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Erro ao carregar boards.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const ordered = useMemo(() => orderedCatalog(items), [items]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ordered;
    return ordered.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        b.description.toLowerCase().includes(q) ||
        BOARD_LEVEL_LABELS[b.level].toLowerCase().includes(q),
    );
  }, [ordered, query]);

  const toggle = (id: string) => {
    setSelected((cur) => {
      if (isFeaturedHomeBoard(id) && cur.has(id)) return cur;
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await saveVisibleBoards([...selected]);
      setSaving(false);
      toast(
        selected.size === 0
          ? "Nenhum board selecionado. Você pode escolher de novo quando quiser."
          : `${selected.size} board${selected.size === 1 ? "" : "s"} na sua home.`,
      );
      onClose();
    } catch (err) {
      setSaving(false);
      setError(err instanceof Error ? err.message : "Não foi possível salvar a escolha.");
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-[var(--line)] bg-[var(--panel-strong)] sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-[var(--accent)]" />
            <div>
              <p className="font-[family-name:var(--font-display)] text-lg text-white">
                Boards visíveis
              </p>
              <p className="text-xs text-[var(--muted)]">
                Marque os kanbans da sua equipe que devem aparecer na home. O board da
                organização e o do time ficam sempre no destaque.
              </p>
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

        <div className="border-b border-[var(--line)] px-4 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar board…"
              className="w-full rounded-xl border border-[var(--line)] bg-[var(--ink)] py-2.5 pl-10 pr-3 text-sm text-white outline-none focus:border-[var(--accent)]"
            />
          </div>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => setSelected(new Set(items.map((b) => b.id)))}
              className="text-xs text-[var(--accent)] hover:underline"
            >
              Marcar todos
            </button>
            <span className="text-[var(--muted)]">·</span>
            <button
              type="button"
              onClick={() =>
                setSelected(
                  new Set(items.filter((b) => isFeaturedHomeBoard(b.id)).map((b) => b.id)),
                )
              }
              className="text-xs text-[var(--muted)] hover:text-white"
            >
              Limpar
            </button>
            <span className="ml-auto text-xs text-[var(--muted)]">
              {selected.size} de {items.length}
            </span>
          </div>
        </div>

        <div className="board-scroll flex-1 overflow-y-auto p-2">
          {loading ? (
            <p className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-[var(--muted)]">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando…
            </p>
          ) : error && items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-rose-200">{error}</p>
          ) : visible.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-[var(--muted)]">
              {items.length === 0
                ? "Não há boards da sua equipe ainda. Feche e use Novo board, ou peça um convite."
                : "Nenhum board com esse termo."}
            </p>
          ) : (
            <ul className="space-y-1">
              {visible.map((board) => {
                const depth = catalogDepth(board, items);
                const on = selected.has(board.id);
                const locked = isFeaturedHomeBoard(board.id);
                return (
                  <li key={board.id}>
                    <button
                      type="button"
                      onClick={() => toggle(board.id)}
                      style={{ paddingLeft: `${12 + depth * 16}px` }}
                      className={`flex w-full items-start gap-3 rounded-xl py-2.5 pr-3 text-left transition ${
                        on ? "bg-[var(--accent)]/10" : "hover:bg-white/5"
                      } ${locked ? "cursor-default" : ""}`}
                    >
                      <span
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                          on
                            ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-on)]"
                            : "border-[var(--line)] text-transparent"
                        }`}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm text-white">{board.title}</span>
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${BOARD_LEVEL_STYLES[board.level]}`}
                          >
                            {BOARD_LEVEL_LABELS[board.level]}
                          </span>
                          {locked ? (
                            <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[var(--accent)]">
                              Destaque
                            </span>
                          ) : null}
                        </span>
                        {board.description ? (
                          <span className="mt-0.5 line-clamp-2 block text-xs text-[var(--muted)]">
                            {board.description}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {error && items.length > 0 ? (
          <p className="border-t border-rose-500/20 px-4 py-2 text-sm text-rose-200">{error}</p>
        ) : null}

        <footer className="flex gap-2 border-t border-[var(--line)] p-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-[var(--line)] px-3 py-2.5 text-sm text-[var(--muted)] hover:text-white"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={saving || loading}
            onClick={() => void save()}
            className="flex-1 rounded-xl bg-[var(--accent)] px-3 py-2.5 text-sm font-semibold text-[var(--accent-on)] disabled:opacity-40"
          >
            {saving ? "Salvando…" : "Salvar escolha"}
          </button>
        </footer>
      </div>
    </div>
  );
}
