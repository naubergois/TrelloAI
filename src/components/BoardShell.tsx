"use client";

import {
  Bot,
  CalendarDays,
  ClipboardList,
  Home,
  LayoutGrid,
  Palette,
  Pencil,
  RotateCcw,
  Sparkles,
  UserPlus,
  Users,
  Video,
} from "lucide-react";
import { useBoardStore } from "@/lib/store";
import { boardThemeStyle } from "@/lib/board-themes";
import { BoardCanvas } from "@/components/BoardCanvas";
import { AiPanel } from "@/components/AiPanel";
import { MeetingsPanel } from "@/components/MeetingsPanel";
import { MeetingRoom } from "@/components/MeetingRoom";
import { AuthButton } from "@/components/AuthButton";
import { ManagerPanel } from "@/components/ManagerPanel";
import { BoardAppearanceDrawer } from "@/components/BoardAppearanceDrawer";
import { InvitePanel } from "@/components/InvitePanel";
import { RequirementsPanel } from "@/components/RequirementsPanel";
import { TeamCalendarPanel } from "@/components/TeamCalendarPanel";
import { BoardFilterBar } from "@/components/BoardFilterBar";
import {
  EMPTY_BOARD_FILTER,
  cardMatchesFilter,
  type BoardCardFilter,
} from "@/lib/board-filters";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type SidePanel =
  | "manager"
  | "meetings"
  | "ai"
  | "invite"
  | "requirements"
  | "calendar"
  | null;

export function BoardShell({
  boardId,
  googleConfigured = false,
}: {
  boardId: string;
  googleConfigured?: boolean;
}) {
  const router = useRouter();
  const boards = useBoardStore((s) => s.boards);
  const teams = useBoardStore((s) => s.teams);
  const lists = useBoardStore((s) => s.lists);
  const cards = useBoardStore((s) => s.cards);
  const members = useBoardStore((s) => s.members);
  const requirements = useBoardStore((s) => s.requirements);
  const calendarEvents = useBoardStore((s) => s.calendarEvents);
  const setActiveBoard = useBoardStore((s) => s.setActiveBoard);
  const renameBoard = useBoardStore((s) => s.renameBoard);
  const updateBoardDescription = useBoardStore((s) => s.updateBoardDescription);
  const resetDemo = useBoardStore((s) => s.resetDemo);
  const meetings = useBoardStore((s) => s.meetings);
  const createMeeting = useBoardStore((s) => s.createMeeting);
  const standups = useBoardStore((s) => s.standups);
  const managers = useBoardStore((s) => s.managers);

  const [panel, setPanel] = useState<SidePanel>("manager");
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [cardFilter, setCardFilter] = useState<BoardCardFilter>(EMPTY_BOARD_FILTER);
  const titleInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setActiveBoard(boardId);
  }, [boardId, setActiveBoard]);

  useEffect(() => {
    if (!editingTitle) return;
    const t = window.setTimeout(() => {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }, 30);
    return () => window.clearTimeout(t);
  }, [editingTitle]);

  const boardList = useMemo(
    () => Object.values(boards).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [boards],
  );

  const board = boards[boardId] ?? null;
  const assignedTeam = board?.teamId ? teams[board.teamId] : null;

  const boardMembers = useMemo(() => {
    if (!board) return [];
    return (board.memberIds ?? []).map((id) => members[id]).filter(Boolean);
  }, [board, members]);

  const { matchCount, totalCount } = useMemo(() => {
    if (!board) return { matchCount: 0, totalCount: 0 };
    const boardCards = board.listIds.flatMap((listId) =>
      (lists[listId]?.cardIds ?? [])
        .map((id) => cards[id])
        .filter(Boolean),
    );
    return {
      totalCount: boardCards.length,
      matchCount: boardCards.filter((c) => cardMatchesFilter(c, cardFilter))
        .length,
    };
  }, [board, lists, cards, cardFilter]);

  const reqCount = useMemo(
    () =>
      Object.values(requirements || {}).filter((r) => r.boardId === boardId)
        .length,
    [requirements, boardId],
  );

  const calCount = useMemo(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const prefix = `${y}-${m}`;
    return Object.values(calendarEvents || {}).filter(
      (e) => e.boardId === boardId && e.date.startsWith(prefix),
    ).length;
  }, [calendarEvents, boardId]);

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

  const themeStyle = board ? boardThemeStyle(board) : undefined;

  if (!board) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-[var(--muted)]">Board não encontrado.</p>
        <Link
          href="/"
          className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-on)]"
        >
          Voltar aos boards
        </Link>
      </div>
    );
  }

  return (
    <div
      className="board-theme flex h-dvh max-h-dvh flex-col overflow-hidden"
      style={themeStyle}
    >
      <MeetingRoom />

      <header className="board-header-bar z-30 shrink-0 border-b backdrop-blur-md">
        <div className="mx-auto flex min-h-14 max-w-[1600px] flex-wrap items-center gap-2 px-3 py-2 sm:min-h-[3.75rem] sm:gap-3 sm:px-4 lg:px-6">
          <Link
            href="/"
            className="flex min-w-0 shrink items-center gap-2 rounded-xl px-1 py-1 transition hover:bg-white/5"
            title="Todos os boards"
          >
            <Home className="hidden h-4 w-4 text-[var(--accent)] sm:block" />
            <div className="min-w-0">
              <p className="font-[family-name:var(--font-display)] text-lg leading-tight tracking-tight text-white sm:text-xl">
                Trello<span className="text-[var(--accent)]">AI</span>
              </p>
              <p className="hidden truncate text-[11px] text-[var(--muted)] md:block">
                Meus boards
              </p>
            </div>
          </Link>

          <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-1.5 sm:gap-2">
            <div className="hidden items-center gap-2 md:flex">
              <LayoutGrid className="h-4 w-4 text-[var(--muted)]" />
              <select
                className="max-w-[12rem] rounded-lg border border-[var(--line)] bg-[var(--ink-2)] px-2.5 py-1.5 text-sm outline-none focus:border-[var(--accent)] xl:max-w-[16rem]"
                value={boardId}
                onChange={(e) => router.push(`/board/${e.target.value}`)}
                aria-label="Trocar board"
              >
                {boardList.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.title}
                  </option>
                ))}
              </select>
            </div>

            <AuthButton googleConfigured={googleConfigured} />

            <button
              type="button"
              onClick={() => toggle("invite")}
              title="Convidar usuários"
              className={`rounded-xl border p-1.5 transition sm:p-2 ${
                panel === "invite"
                  ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]"
                  : "border-[var(--line)] text-[var(--muted)] hover:text-white"
              }`}
            >
              <UserPlus className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => toggle("requirements")}
              title="Requisitos"
              className={`relative rounded-xl border p-1.5 transition sm:p-2 ${
                panel === "requirements"
                  ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]"
                  : "border-[var(--line)] text-[var(--muted)] hover:text-white"
              }`}
            >
              <ClipboardList className="h-4 w-4" />
              {reqCount > 0 ? (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[9px] font-bold text-[var(--accent-on)]">
                  {reqCount > 99 ? "99+" : reqCount}
                </span>
              ) : null}
            </button>

            <button
              type="button"
              onClick={() => toggle("calendar")}
              title="Calendário do time"
              className={`relative rounded-xl border p-1.5 transition sm:p-2 ${
                panel === "calendar"
                  ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]"
                  : "border-[var(--line)] text-[var(--muted)] hover:text-white"
              }`}
            >
              <CalendarDays className="h-4 w-4" />
              {calCount > 0 ? (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--accent-2)] px-1 text-[9px] font-bold text-slate-950">
                  {calCount > 99 ? "99+" : calCount}
                </span>
              ) : null}
            </button>

            <button
              type="button"
              onClick={() => setAppearanceOpen(true)}
              title="Fundo e design"
              className="rounded-xl border border-[var(--line)] p-1.5 text-[var(--muted)] transition hover:text-white sm:p-2"
            >
              <Palette className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-0.5 rounded-xl border border-[var(--line)] bg-black/20 p-0.5 sm:gap-1 sm:rounded-2xl sm:p-1">
              <button
                type="button"
                onClick={() => toggle("manager")}
                className={`relative inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm transition sm:rounded-xl sm:px-2.5 sm:py-2 ${
                  panel === "manager"
                    ? "bg-[var(--accent)] font-semibold text-[var(--accent-on)]"
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
          <div className="mb-2 flex shrink-0 flex-wrap items-center gap-2 sm:mb-3 sm:gap-3">
            <div className="min-w-0 flex-1">
              {editingTitle ? (
                <div className="space-y-2">
                  <input
                    ref={titleInputRef}
                    value={board.title}
                    onChange={(e) => renameBoard(board.id, e.target.value)}
                    onBlur={() => setEditingTitle(false)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === "Escape") {
                        e.preventDefault();
                        setEditingTitle(false);
                      }
                    }}
                    className="w-full max-w-xl rounded-xl border border-[var(--accent)]/50 bg-black/30 px-3 py-2 font-[family-name:var(--font-display)] text-xl text-white outline-none ring-2 ring-[var(--accent)]/20 sm:text-2xl"
                    aria-label="Nome do board"
                  />
                  <input
                    value={board.description}
                    onChange={(e) => updateBoardDescription(board.id, e.target.value)}
                    placeholder="Descrição do board"
                    className="w-full max-w-xl rounded-lg border border-[var(--line)] bg-black/20 px-3 py-1.5 text-sm text-[var(--muted)] outline-none focus:border-[var(--accent)]"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") setEditingTitle(false);
                    }}
                  />
                  <p className="text-[11px] text-[var(--muted)]">
                    Enter ou clique fora para salvar
                  </p>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setEditingTitle(true)}
                  className="group/title flex max-w-full items-start gap-2 rounded-xl text-left transition hover:bg-white/5"
                >
                  <div className="min-w-0">
                    <p className="truncate font-[family-name:var(--font-display)] text-xl text-white sm:text-2xl">
                      {board.title}
                    </p>
                    <p className="mt-0.5 hidden truncate text-xs text-[var(--muted)] sm:block">
                      {board.description || "Clique para editar nome e descrição"}
                      {managers[board.id] ? ` · ${managers[board.id].name}` : ""}
                    </p>
                  </div>
                  <span className="mt-1.5 shrink-0 rounded-lg border border-[var(--line)] p-1.5 text-[var(--muted)] opacity-100 transition group-hover/title:border-[var(--accent)]/40 group-hover/title:text-[var(--accent)] sm:opacity-70">
                    <Pencil className="h-3.5 w-3.5" />
                  </span>
                </button>
              )}
            </div>

            {assignedTeam ? (
              <button
                type="button"
                onClick={() => setPanel("meetings")}
                title="Equipe do board"
                className="inline-flex max-w-[10rem] items-center gap-1.5 truncate rounded-xl border border-[var(--line)] bg-black/20 px-2.5 py-1.5 text-xs text-[var(--muted)] transition hover:border-[var(--accent)]/40 hover:text-white sm:max-w-[14rem]"
              >
                <Users className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
                <span className="truncate">{assignedTeam.name}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setPanel("meetings")}
                className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-[var(--line)] px-2.5 py-1.5 text-xs text-[var(--muted)] transition hover:border-[var(--accent)]/40 hover:text-white"
              >
                <Users className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Cadastrar time</span>
              </button>
            )}

            <select
              className="max-w-[9rem] rounded-lg border border-[var(--line)] bg-[var(--ink-2)] px-2 py-1.5 text-xs outline-none focus:border-[var(--accent)] md:hidden sm:max-w-[12rem] sm:text-sm"
              value={boardId}
              onChange={(e) => router.push(`/board/${e.target.value}`)}
              aria-label="Trocar board"
            >
              {boardList.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title}
                </option>
              ))}
            </select>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-2 sm:px-3">
            <BoardFilterBar
              filter={cardFilter}
              onChange={setCardFilter}
              members={boardMembers}
              matchCount={matchCount}
              totalCount={totalCount}
            />
            <div className="min-h-0 flex-1 overflow-hidden">
              <BoardCanvas boardId={board.id} filter={cardFilter} />
            </div>
          </div>
        </main>

        {panel && panel !== "requirements" && panel !== "calendar" ? (
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
              {panel === "invite" ? (
                <aside className="anim-rise panel-glass flex h-full min-h-0 w-full flex-col overflow-hidden rounded-t-3xl p-4 sm:rounded-3xl">
                  <InvitePanel boardId={board.id} onClose={() => setPanel(null)} />
                </aside>
              ) : null}
            </div>
          </>
        ) : null}
      </div>

      {panel === "requirements" ? (
        <RequirementsPanel boardId={board.id} onClose={() => setPanel(null)} />
      ) : null}
      {panel === "calendar" ? (
        <TeamCalendarPanel boardId={board.id} onClose={() => setPanel(null)} />
      ) : null}

      {appearanceOpen ? (
        <BoardAppearanceDrawer
          boardId={board.id}
          onClose={() => setAppearanceOpen(false)}
        />
      ) : null}
    </div>
  );
}
