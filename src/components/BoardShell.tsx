"use client";

import { useMemo, useState } from "react";
import { Plus, RotateCcw, Sparkles, Video } from "lucide-react";
import { useBoardStore } from "@/lib/store";
import { BoardCanvas } from "@/components/BoardCanvas";
import { AiPanel } from "@/components/AiPanel";
import { MeetingsPanel } from "@/components/MeetingsPanel";
import { MeetingRoom } from "@/components/MeetingRoom";

export function BoardShell() {
  const boards = useBoardStore((s) => s.boards);
  const activeBoardId = useBoardStore((s) => s.activeBoardId);
  const setActiveBoard = useBoardStore((s) => s.setActiveBoard);
  const createBoard = useBoardStore((s) => s.createBoard);
  const renameBoard = useBoardStore((s) => s.renameBoard);
  const resetDemo = useBoardStore((s) => s.resetDemo);
  const meetings = useBoardStore((s) => s.meetings);
  const createMeeting = useBoardStore((s) => s.createMeeting);

  const [aiOpen, setAiOpen] = useState(false);
  const [meetingsOpen, setMeetingsOpen] = useState(true);
  const [newTitle, setNewTitle] = useState("");

  const boardList = useMemo(
    () => Object.values(boards).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [boards],
  );

  const board = activeBoardId ? boards[activeBoardId] : null;

  const liveCount = useMemo(() => {
    if (!board) return 0;
    return Object.values(meetings).filter(
      (m) => m.boardId === board.id && m.status === "live",
    ).length;
  }, [meetings, board]);

  return (
    <div className="flex min-h-screen flex-col">
      <MeetingRoom />

      <header className="anim-rise sticky top-0 z-30 border-b border-[var(--line)] bg-[var(--panel-strong)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1600px] items-center gap-4 px-4 py-3 sm:px-6">
          <div className="min-w-0 flex-1">
            <p className="font-[family-name:var(--font-display)] text-xl tracking-tight text-white sm:text-2xl">
              Trello<span className="text-[var(--accent)]">AI</span>
            </p>
            <p className="truncate text-xs text-[var(--muted)] sm:text-sm">
              Kanban, IA e reuniões virtuais com a equipe
            </p>
          </div>

          <div className="hidden items-center gap-2 md:flex">
            <select
              className="rounded-lg border border-[var(--line)] bg-[var(--ink-2)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
              value={activeBoardId ?? ""}
              onChange={(e) => setActiveBoard(e.target.value)}
            >
              {boardList.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title}
                </option>
              ))}
            </select>
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!newTitle.trim()) return;
                createBoard(newTitle.trim());
                setNewTitle("");
              }}
            >
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Novo board"
                className="w-36 rounded-lg border border-[var(--line)] bg-[var(--ink-2)] px-3 py-2 text-sm outline-none placeholder:text-[var(--muted)] focus:border-[var(--accent)]"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1 rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-medium text-teal-950 transition hover:brightness-110"
              >
                <Plus className="h-4 w-4" />
                Criar
              </button>
            </form>
          </div>

          {board ? (
            <button
              type="button"
              onClick={() =>
                createMeeting({
                  boardId: board.id,
                  title: `Reunião ao vivo — ${board.title}`,
                  startNow: true,
                })
              }
              className="hidden items-center gap-2 rounded-lg bg-rose-500/90 px-3 py-2 text-sm font-medium text-white transition hover:brightness-110 sm:inline-flex"
            >
              <Video className="h-4 w-4" />
              Ao vivo
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => {
              setMeetingsOpen((v) => !v);
              if (!meetingsOpen) setAiOpen(false);
            }}
            className="relative inline-flex items-center gap-2 rounded-lg border border-[var(--accent-2)]/40 bg-[var(--accent-2)]/10 px-3 py-2 text-sm text-[var(--accent-2)] transition hover:bg-[var(--accent-2)]/20"
          >
            <Video className="h-4 w-4" />
            Equipe
            {liveCount > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                {liveCount}
              </span>
            ) : null}
          </button>

          <button
            type="button"
            onClick={() => {
              setAiOpen((v) => !v);
              if (!aiOpen) setMeetingsOpen(false);
            }}
            className="anim-glow inline-flex items-center gap-2 rounded-lg border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-3 py-2 text-sm text-[var(--accent)] transition hover:bg-[var(--accent)]/20"
          >
            <Sparkles className="h-4 w-4" />
            IA
          </button>
          <button
            type="button"
            onClick={resetDemo}
            title="Resetar demo"
            className="rounded-lg border border-[var(--line)] p-2 text-[var(--muted)] transition hover:text-white"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row">
        <main className="min-w-0 flex-1">
          {board ? (
            <>
              <div className="anim-rise mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <input
                    value={board.title}
                    onChange={(e) => renameBoard(board.id, e.target.value)}
                    className="w-full max-w-xl bg-transparent font-[family-name:var(--font-display)] text-2xl text-white outline-none sm:text-3xl"
                  />
                  <p className="mt-1 text-sm text-[var(--muted)]">{board.description}</p>
                </div>
              </div>
              <BoardCanvas boardId={board.id} />
            </>
          ) : (
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-8 text-[var(--muted)]">
              Nenhum board ativo. Crie um novo para começar.
            </div>
          )}
        </main>

        {meetingsOpen && board ? (
          <MeetingsPanel boardId={board.id} onClose={() => setMeetingsOpen(false)} />
        ) : null}
        {aiOpen && board ? <AiPanel boardId={board.id} onClose={() => setAiOpen(false)} /> : null}
      </div>
    </div>
  );
}
