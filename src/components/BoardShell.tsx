"use client";

import { useMemo, useState } from "react";
import { Bot, Plus, RotateCcw, Sparkles, Video } from "lucide-react";
import { useBoardStore } from "@/lib/store";
import { BoardCanvas } from "@/components/BoardCanvas";
import { AiPanel } from "@/components/AiPanel";
import { MeetingsPanel } from "@/components/MeetingsPanel";
import { MeetingRoom } from "@/components/MeetingRoom";
import { AuthButton } from "@/components/AuthButton";
import { ManagerPanel } from "@/components/ManagerPanel";

type SidePanel = "manager" | "meetings" | "ai" | null;

export function BoardShell({ googleConfigured = false }: { googleConfigured?: boolean }) {
  const boards = useBoardStore((s) => s.boards);
  const activeBoardId = useBoardStore((s) => s.activeBoardId);
  const setActiveBoard = useBoardStore((s) => s.setActiveBoard);
  const createBoard = useBoardStore((s) => s.createBoard);
  const renameBoard = useBoardStore((s) => s.renameBoard);
  const resetDemo = useBoardStore((s) => s.resetDemo);
  const meetings = useBoardStore((s) => s.meetings);
  const createMeeting = useBoardStore((s) => s.createMeeting);
  const standups = useBoardStore((s) => s.standups);
  const managers = useBoardStore((s) => s.managers);

  const [panel, setPanel] = useState<SidePanel>("manager");
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

  const openStandup = useMemo(() => {
    if (!board) return false;
    const today = new Date().toISOString().slice(0, 10);
    return Object.values(standups).some(
      (s) => s.boardId === board.id && s.date === today && s.status === "open",
    );
  }, [standups, board]);

  const toggle = (next: SidePanel) => {
    setPanel((cur) => (cur === next ? null : next));
  };

  return (
    <div className="flex h-dvh max-h-dvh flex-col overflow-hidden">
      <MeetingRoom />

      <header className="z-30 shrink-0 border-b border-[var(--line)] bg-[var(--panel-strong)]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-2 px-3 sm:h-[3.75rem] sm:gap-3 sm:px-4 lg:px-6">
          <div className="min-w-0 shrink">
            <p className="font-[family-name:var(--font-display)] text-lg leading-tight tracking-tight text-white sm:text-xl">
              Trello<span className="text-[var(--accent)]">AI</span>
            </p>
            <p className="hidden truncate text-[11px] text-[var(--muted)] md:block">
              Kanban · Maya · reuniões
            </p>
          </div>

          <div className="ml-auto flex min-w-0 items-center gap-1.5 sm:gap-2">
            <div className="hidden items-center gap-2 lg:flex">
              <select
                className="max-w-[10rem] rounded-lg border border-[var(--line)] bg-[var(--ink-2)] px-2.5 py-1.5 text-sm outline-none focus:border-[var(--accent)] xl:max-w-[14rem]"
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
                className="flex items-center gap-1.5"
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
                  className="w-28 rounded-lg border border-[var(--line)] bg-[var(--ink-2)] px-2.5 py-1.5 text-sm outline-none placeholder:text-[var(--muted)] focus:border-[var(--accent)] xl:w-36"
                />
                <button
                  type="submit"
                  className="inline-flex items-center gap-1 rounded-lg bg-[var(--accent)] px-2.5 py-1.5 text-sm font-medium text-teal-950 transition hover:brightness-110"
                >
                  <Plus className="h-4 w-4" />
                  <span className="hidden xl:inline">Criar</span>
                </button>
              </form>
            </div>

            <AuthButton googleConfigured={googleConfigured} />

            <div className="flex items-center gap-0.5 rounded-xl border border-[var(--line)] bg-black/20 p-0.5 sm:gap-1 sm:rounded-2xl sm:p-1">
              <button
                type="button"
                onClick={() => toggle("manager")}
                className={`relative inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm transition sm:rounded-xl sm:px-2.5 sm:py-2 ${
                  panel === "manager"
                    ? "bg-[var(--accent)] font-semibold text-teal-950"
                    : "text-[var(--muted)] hover:text-white"
                }`}
              >
                <Bot className="h-4 w-4" />
                <span className="hidden sm:inline">Maya</span>
                {openStandup ? (
                  <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[var(--accent-2)] ring-2 ring-[var(--ink)]" />
                ) : null}
              </button>
              <button
                type="button"
                onClick={() => toggle("meetings")}
                className={`relative inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm transition sm:rounded-xl sm:px-2.5 sm:py-2 ${
                  panel === "meetings"
                    ? "bg-[var(--accent-2)] font-semibold text-slate-950"
                    : "text-[var(--muted)] hover:text-white"
                }`}
              >
                <Video className="h-4 w-4" />
                <span className="hidden sm:inline">Equipe</span>
                {liveCount > 0 ? (
                  <span className="ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                    {liveCount}
                  </span>
                ) : null}
              </button>
              <button
                type="button"
                onClick={() => toggle("ai")}
                className={`inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm transition sm:rounded-xl sm:px-2.5 sm:py-2 ${
                  panel === "ai"
                    ? "bg-white font-semibold text-slate-900"
                    : "text-[var(--muted)] hover:text-white"
                }`}
              >
                <Sparkles className="h-4 w-4" />
                <span className="hidden sm:inline">IA</span>
              </button>
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
                className="hidden items-center gap-1.5 rounded-xl bg-rose-500/90 px-2.5 py-1.5 text-sm font-medium text-white transition hover:brightness-110 xl:inline-flex"
              >
                <Video className="h-4 w-4" />
                Ao vivo
              </button>
            ) : null}

            <button
              type="button"
              onClick={resetDemo}
              title="Resetar demo"
              className="rounded-xl border border-[var(--line)] p-1.5 text-[var(--muted)] transition hover:text-white sm:p-2"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="relative mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 overflow-hidden px-2 py-2 sm:px-4 sm:py-3 lg:gap-3 lg:px-6">
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {board ? (
            <>
              <div className="mb-2 flex shrink-0 flex-wrap items-center gap-2 sm:mb-3 sm:gap-3">
                <div className="min-w-0 flex-1">
                  <input
                    value={board.title}
                    onChange={(e) => renameBoard(board.id, e.target.value)}
                    className="w-full max-w-xl truncate bg-transparent font-[family-name:var(--font-display)] text-xl text-white outline-none sm:text-2xl"
                  />
                  <p className="mt-0.5 hidden truncate text-xs text-[var(--muted)] sm:block">
                    {board.description}
                    {managers[board.id] ? ` · ${managers[board.id].name}` : ""}
                  </p>
                </div>

                <div className="flex items-center gap-2 lg:hidden">
                  <select
                    className="max-w-[9rem] rounded-lg border border-[var(--line)] bg-[var(--ink-2)] px-2 py-1.5 text-xs outline-none focus:border-[var(--accent)] sm:max-w-[12rem] sm:text-sm"
                    value={activeBoardId ?? ""}
                    onChange={(e) => setActiveBoard(e.target.value)}
                    aria-label="Selecionar board"
                  >
                    {boardList.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.title}
                      </option>
                    ))}
                  </select>
                  <form
                    className="flex items-center gap-1"
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
                      placeholder="Novo"
                      className="w-20 rounded-lg border border-[var(--line)] bg-[var(--ink-2)] px-2 py-1.5 text-xs outline-none placeholder:text-[var(--muted)] focus:border-[var(--accent)] sm:w-28 sm:text-sm"
                    />
                    <button
                      type="submit"
                      className="rounded-lg bg-[var(--accent)] p-1.5 text-teal-950"
                      aria-label="Criar board"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </form>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-hidden">
                <BoardCanvas boardId={board.id} />
              </div>
            </>
          ) : (
            <div className="flex h-full items-center justify-center rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-6 text-[var(--muted)]">
              Nenhum board ativo. Crie um novo para começar.
            </div>
          )}
        </main>

        {panel && board ? (
          <>
            <button
              type="button"
              aria-label="Fechar painel"
              className="fixed inset-0 z-40 bg-black/55 backdrop-blur-[1px] lg:hidden"
              onClick={() => setPanel(null)}
            />
            <div
              className={`
                fixed inset-x-0 bottom-0 z-50 flex max-h-[min(90dvh,720px)] flex-col
                sm:inset-y-3 sm:right-3 sm:left-auto sm:max-h-none sm:w-[min(100vw-1.5rem,420px)]
                lg:static lg:z-auto lg:flex lg:h-full lg:max-h-none lg:w-[min(38vw,400px)] lg:shrink-0
                xl:w-[420px]
              `}
            >
              {panel === "manager" ? (
                <ManagerPanel boardId={board.id} onClose={() => setPanel(null)} />
              ) : null}
              {panel === "meetings" ? (
                <MeetingsPanel boardId={board.id} onClose={() => setPanel(null)} />
              ) : null}
              {panel === "ai" ? (
                <AiPanel boardId={board.id} onClose={() => setPanel(null)} />
              ) : null}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
