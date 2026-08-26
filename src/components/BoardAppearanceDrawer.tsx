"use client";

import { useMemo, useState } from "react";
import { ImagePlus, Palette, Search, X } from "lucide-react";
import { useBoardStore } from "@/lib/store";
import {
  BOARD_BACKGROUNDS,
  BOARD_CARD_THEMES,
  BOARD_DESIGNS,
  DEFAULT_BACKGROUND_ID,
  DEFAULT_BACKGROUND_TINT,
  DEFAULT_CARD_THEME_ID,
  DEFAULT_DESIGN_ID,
  type BoardBackgroundId,
  type BoardCardThemeId,
  type BoardDesignId,
} from "@/lib/board-themes";
import { boardPhotoCatalog, isUsableBackgroundUrl, type BoardPhoto } from "@/lib/board-photos";

const PAGE_SIZE = 36;

export type AppearancePatch = {
  backgroundId?: BoardBackgroundId;
  designId?: BoardDesignId;
  cardThemeId?: BoardCardThemeId;
  backgroundImageUrl?: string | null;
  backgroundTint?: number;
};

export function BoardAppearanceEditor({
  backgroundId,
  designId,
  cardThemeId,
  backgroundImageUrl,
  backgroundTint,
  onChange,
}: {
  backgroundId?: string | null;
  designId?: string | null;
  cardThemeId?: string | null;
  backgroundImageUrl?: string | null;
  backgroundTint?: number | null;
  onChange: (patch: AppearancePatch) => void;
}) {
  const [tab, setTab] = useState<"cores" | "imagens" | "cards" | "design">("cores");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [urlDraft, setUrlDraft] = useState(backgroundImageUrl || "");
  const [broken, setBroken] = useState<Record<string, true>>({});

  const bgId = (backgroundId as BoardBackgroundId) || DEFAULT_BACKGROUND_ID;
  const dId = (designId as BoardDesignId) || DEFAULT_DESIGN_ID;
  const cId = (cardThemeId as BoardCardThemeId) || DEFAULT_CARD_THEME_ID;
  const tint = typeof backgroundTint === "number" ? backgroundTint : DEFAULT_BACKGROUND_TINT;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return boardPhotoCatalog().filter((photo) => {
      if (broken[photo.id]) return false;
      if (!q) return true;
      return (
        photo.author.toLowerCase().includes(q) ||
        photo.category.toLowerCase().includes(q) ||
        photo.id.toLowerCase().includes(q)
      );
    });
  }, [query, broken]);

  const visible = filtered.slice(0, page * PAGE_SIZE);
  const hasMore = visible.length < filtered.length;

  const applyPhoto = (photo: BoardPhoto) => {
    onChange({ backgroundImageUrl: photo.full, backgroundTint: tint });
    setUrlDraft(photo.full);
  };

  const applyUrl = () => {
    const url = urlDraft.trim();
    if (!isUsableBackgroundUrl(url)) return;
    onChange({ backgroundImageUrl: url, backgroundTint: tint });
  };

  const onUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    const dataUrl = await compressImage(file);
    if (!dataUrl) return;
    onChange({ backgroundImageUrl: dataUrl, backgroundTint: tint });
    setUrlDraft("");
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-xl bg-black/25 p-1">
        {(
          [
            ["cores", "Cores"],
            ["imagens", "Imagens"],
            ["cards", "Cards"],
            ["design", "Design"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition ${
              tab === id
                ? "bg-[var(--accent)] text-[var(--accent-on)]"
                : "text-[var(--muted)] hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "cores" ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {BOARD_BACKGROUNDS.map((bg) => {
            const active = !backgroundImageUrl && bg.id === bgId;
            return (
              <button
                key={bg.id}
                type="button"
                onClick={() => onChange({ backgroundId: bg.id, backgroundImageUrl: null })}
                className={`overflow-hidden rounded-xl border text-left ${
                  active
                    ? "border-[var(--accent)] ring-2 ring-[var(--accent)]/40"
                    : "border-[var(--line)] hover:border-white/30"
                }`}
              >
                <div className="h-14 w-full" style={{ backgroundImage: bg.preview }} />
                <p className="truncate bg-black/30 px-2 py-1.5 text-[11px] text-white">{bg.name}</p>
              </button>
            );
          })}
        </div>
      ) : null}

      {tab === "imagens" ? (
        <div className="space-y-3">
          <p className="text-[11px] text-[var(--muted)]">
            {boardPhotoCatalog().length} fotos na galeria. Cole uma URL, envie um arquivo ou escolha abaixo.
          </p>
          <div className="flex gap-2">
            <input
              value={urlDraft}
              onChange={(e) => setUrlDraft(e.target.value)}
              placeholder="https://…/foto.jpg"
              className="min-w-0 flex-1 rounded-xl border border-[var(--line)] bg-[var(--ink)] px-3 py-2 text-xs text-white outline-none focus:border-[var(--accent)]"
            />
            <button
              type="button"
              disabled={!isUsableBackgroundUrl(urlDraft)}
              onClick={applyUrl}
              className="shrink-0 rounded-xl bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-[var(--accent-on)] disabled:opacity-40"
            >
              Usar URL
            </button>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[var(--line)] px-3 py-2 text-xs text-[var(--muted)] hover:text-white">
            <ImagePlus className="h-3.5 w-3.5" />
            Enviar imagem
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void onUpload(file);
                e.target.value = "";
              }}
            />
          </label>
          {backgroundImageUrl ? (
            <button
              type="button"
              onClick={() => {
                onChange({ backgroundImageUrl: null });
                setUrlDraft("");
              }}
              className="inline-flex items-center gap-1 text-[11px] text-rose-300 hover:text-rose-200"
            >
              <X className="h-3 w-3" />
              Remover foto e voltar ao degradê
            </button>
          ) : null}
          <label className="block text-[11px] text-[var(--muted)]">
            Escurecer foto ({tint}%)
            <input
              type="range"
              min={0}
              max={80}
              value={tint}
              onChange={(e) => onChange({ backgroundTint: Number(e.target.value) })}
              className="mt-1 w-full"
            />
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted)]" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Buscar na galeria…"
              className="w-full rounded-xl border border-[var(--line)] bg-[var(--ink)] py-2 pl-8 pr-3 text-xs text-white outline-none focus:border-[var(--accent)]"
            />
          </div>
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
            {visible.map((photo) => {
              const active = backgroundImageUrl === photo.full;
              return (
                <button
                  key={photo.id}
                  type="button"
                  title={photo.author}
                  onClick={() => applyPhoto(photo)}
                  className={`overflow-hidden rounded-lg border ${
                    active
                      ? "border-[var(--accent)] ring-2 ring-[var(--accent)]/40"
                      : "border-[var(--line)] hover:border-white/40"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.thumb}
                    alt={photo.author}
                    loading="lazy"
                    className="h-16 w-full object-cover"
                    onError={() => setBroken((prev) => ({ ...prev, [photo.id]: true }))}
                  />
                </button>
              );
            })}
          </div>
          {hasMore ? (
            <button
              type="button"
              onClick={() => setPage((n) => n + 1)}
              className="w-full rounded-xl border border-[var(--line)] px-3 py-2 text-xs text-[var(--muted)] hover:text-white"
            >
              Ver mais imagens ({filtered.length - visible.length} restantes)
            </button>
          ) : null}
        </div>
      ) : null}

      {tab === "cards" ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {BOARD_CARD_THEMES.map((theme) => (
            <button
              key={theme.id}
              type="button"
              onClick={() => onChange({ cardThemeId: theme.id })}
              className={`rounded-xl border px-2 py-2.5 text-left ${
                theme.id === cId
                  ? "border-[var(--accent)] ring-2 ring-[var(--accent)]/40"
                  : "border-[var(--line)] hover:border-white/30"
              }`}
            >
              <span
                className="mb-1.5 block h-8 w-full rounded-lg border border-white/20"
                style={{ background: theme.swatch }}
              />
              <p className="text-[11px] text-white">{theme.name}</p>
            </button>
          ))}
        </div>
      ) : null}

      {tab === "design" ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {BOARD_DESIGNS.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => onChange({ designId: d.id })}
              className={`rounded-xl border px-3 py-2.5 text-left ${
                d.id === dId
                  ? "border-[var(--accent)] bg-[var(--accent)]/10"
                  : "border-[var(--line)]"
              }`}
            >
              <p className="text-sm font-medium text-white">{d.name}</p>
              <p className="text-[11px] text-[var(--muted)]">{d.description}</p>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

async function compressImage(file: File): Promise<string | null> {
  const bitmap = await createImageBitmap(file);
  const max = 1920;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(bitmap, 0, 0, width, height);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.72);
  if (dataUrl.length > 450_000) {
    const tighter = canvas.toDataURL("image/jpeg", 0.55);
    if (tighter.length > 450_000) return null;
    return tighter;
  }
  return dataUrl;
}

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

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/55 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-[var(--line)] bg-[var(--panel-strong)] sm:rounded-3xl">
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
        <div className="board-scroll min-h-0 flex-1 overflow-y-auto p-4">
          <BoardAppearanceEditor
            backgroundId={board.backgroundId}
            designId={board.designId}
            cardThemeId={board.cardThemeId}
            backgroundImageUrl={board.backgroundImageUrl}
            backgroundTint={board.backgroundTint}
            onChange={(patch) => updateBoardAppearance(boardId, patch)}
          />
        </div>
        <footer className="border-t border-[var(--line)] p-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-[var(--accent)] px-3 py-2.5 text-sm font-semibold text-[var(--accent-on)]"
          >
            Pronto
          </button>
        </footer>
      </div>
    </div>
  );
}
