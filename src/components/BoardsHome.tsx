"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutGrid,
  LayoutTemplate,
  Palette,
  Pencil,
  Plus,
  Search,
  Settings2,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useBoardStore } from "@/lib/store";
import { ASESI_BOARD_ID } from "@/lib/constants";
import { AuthButton } from "@/components/AuthButton";
import { TeamsManager } from "@/components/TeamsManager";
import { InvitePanel } from "@/components/InvitePanel";
import {
  BOARD_BACKGROUNDS,
  BOARD_DESIGNS,
  DEFAULT_BACKGROUND_ID,
  DEFAULT_DESIGN_ID,
  getBackground,
  getDesign,
  type BoardBackgroundId,
  type BoardDesignId,
} from "@/lib/board-themes";

type HomeTab = "boards" | "teams";

export function BoardsHome({ googleConfigured = false }: { googleConfigured?: boolean }) {
  const router = useRouter();
  const boards = useBoardStore((s) => s.boards);
  const teams = useBoardStore((s) => s.teams);
  const lists = useBoardStore((s) => s.lists);
  const members = useBoardStore((s) => s.members);
  const currentUserId = useBoardStore((s) => s.currentUserId);
  const hydrated = useBoardStore((s) => s.hydrated);
  const createBoard = useBoardStore((s) => s.createBoard);
  const setActiveBoard = useBoardStore((s) => s.setActiveBoard);
  const updateBoardAppearance = useBoardStore((s) => s.updateBoardAppearance);
  const renameBoard = useBoardStore((s) => s.renameBoard);
  const updateBoardDescription = useBoardStore((s) => s.updateBoardDescription);
  const assignTeamToBoard = useBoardStore((s) => s.assignTeamToBoard);
  const createTeam = useBoardStore((s) => s.createTeam);
  const deleteBoard = useBoardStore((s) => s.deleteBoard);
  const ensureAsesiBoard = useBoardStore((s) => s.ensureAsesiBoard);

  const me = currentUserId ? members[currentUserId] : null;

  useEffect(() => {
    if (hydrated) ensureAsesiBoard();
  }, [hydrated, ensureAsesiBoard]);

  const boardList = useMemo(
    () => Object.values(boards).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [boards],
  );

  const asesiBoard = boards[ASESI_BOARD_ID] ?? null;

  const teamOptions = useMemo(
    () => Object.values(teams).sort((a, b) => a.name.localeCompare(b.name)),
    [teams],
  );

  const [tab, setTab] = useState<HomeTab>("boards");
  const [creating, setCreating] = useState(false);
  const [boardQuery, setBoardQuery] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [bgId, setBgId] = useState<BoardBackgroundId>(DEFAULT_BACKGROUND_ID);
  const [designId, setDesignId] = useState<BoardDesignId>(DEFAULT_DESIGN_ID);
  const [teamId, setTeamId] = useState<string>("");
  const [newTeamName, setNewTeamName] = useState("");
  const [customizeId, setCustomizeId] = useState<string | null>(null);
  const [inviteBoardId, setInviteBoardId] = useState<string | null>(null);
  const [customizeNewTeam, setCustomizeNewTeam] = useState("");

  const customizeBoard = customizeId ? boards[customizeId] : null;

  const filteredBoards = useMemo(() => {
    const q = boardQuery.trim().toLowerCase();
    if (!q) return boardList;
    return boardList.filter((b) => {
      const teamName = b.teamId ? teams[b.teamId]?.name ?? "" : "";
      return (
        b.title.toLowerCase().includes(q) ||
        (b.description || "").toLowerCase().includes(q) ||
        teamName.toLowerCase().includes(q)
      );
    });
  }, [boardList, boardQuery, teams]);

  const openBoard = (boardId: string) => {
    setActiveBoard(boardId);
    router.push(`/board/${boardId}`);
  };

  const onCreate = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    let linkedTeamId = teamId || null;
    if (!linkedTeamId && newTeamName.trim()) {
      linkedTeamId = createTeam({
        name: newTeamName.trim(),
        memberIds: currentUserId ? [currentUserId] : [],
      });
    }
    const id = createBoard(title.trim(), description.trim(), {
      backgroundId: bgId,
      designId,
      teamId: linkedTeamId,
    });
    setTitle("");
    setDescription("");
    setTeamId("");
    setNewTeamName("");
    setCreating(false);
    openBoard(id);
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="app-bar shrink-0 border-b backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:h-16 sm:px-6">
          <div className="min-w-0 flex-1">
            <p className="font-[family-name:var(--font-display)] text-xl tracking-tight text-white sm:text-2xl">
              Trello<span className="text-[var(--accent)]">AI</span>
            </p>
            <p className="truncate text-xs text-[var(--muted)]">
              {me ? `Olá, ${me.name.split(" ")[0]}` : "Seus boards"}
            </p>
          </div>
          <AuthButton googleConfigured={googleConfigured} />
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1.5 rounded-xl btn-accent px-3 py-2 text-sm font-semibold"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Novo board</span>
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-xl">
            <h1 className="font-[family-name:var(--font-display)] text-2xl text-white sm:text-3xl">
              {tab === "boards" ? "Seus boards" : "Equipes"}
            </h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {tab === "boards"
                ? "Kanban com Maya, convites da equipe e validação ASESI."
                : "Crie equipes e vincule-as a cada board."}
            </p>
          </div>

          <div className="flex rounded-xl border border-[var(--line)] bg-black/20 p-1">
            <button
              type="button"
              onClick={() => setTab("boards")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition ${
                tab === "boards"
                  ? "bg-[var(--accent)] font-semibold text-[var(--accent-on)]"
                  : "text-[var(--muted)] hover:text-white"
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
              Boards
            </button>
            <button
              type="button"
              onClick={() => setTab("teams")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition ${
                tab === "teams"
                  ? "bg-[var(--accent)] font-semibold text-[var(--accent-on)]"
                  : "text-[var(--muted)] hover:text-white"
              }`}
            >
              <Users className="h-4 w-4" />
              Equipes
            </button>
          </div>
        </div>

        {tab === "teams" ? <TeamsManager /> : null}

        {tab === "boards" && asesiBoard ? (
          <section className="mb-6 overflow-hidden rounded-3xl border border-[var(--accent)]/30 bg-gradient-to-br from-[var(--accent)]/15 via-black/20 to-sky-500/10 p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-xl">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">
                  Board oficial
                </p>
                <h2 className="mt-1 font-[family-name:var(--font-display)] text-2xl text-white">
                  {asesiBoard.title}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
                  {asesiBoard.description}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => openBoard(ASESI_BOARD_ID)}
                  className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[var(--accent-on)] transition hover:brightness-110"
                >
                  Abrir ASESI
                </button>
                <button
                  type="button"
                  onClick={() => setInviteBoardId(ASESI_BOARD_ID)}
                  className="inline-flex items-center gap-2 rounded-xl border border-[var(--line)] px-4 py-2.5 text-sm text-white transition hover:border-[var(--accent)]"
                >
                  <UserPlus className="h-4 w-4" />
                  Convidar equipe
                </button>
              </div>
            </div>
          </section>
        ) : null}

        {tab === "boards" ? (
          <div className="mb-4">
            <div className="relative max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
              <input
                value={boardQuery}
                onChange={(e) => setBoardQuery(e.target.value)}
                placeholder="Buscar boards ou times…"
                className="w-full rounded-2xl border border-[var(--line)] bg-black/25 py-2.5 pl-10 pr-3 text-sm text-white outline-none focus:border-[var(--accent)]"
              />
            </div>
          </div>
        ) : null}

        {tab === "boards" ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex min-h-[132px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/35 bg-white/10 p-6 text-white/80 transition hover:border-white/55 hover:bg-white/15 hover:text-white"
          >
            <Plus className="h-8 w-8 text-[var(--accent)]" />
            <span className="text-sm font-medium">Criar board</span>
          </button>

          {filteredBoards.map((board) => {
            const bg = getBackground(board.backgroundId);
            const design = getDesign(board.designId);
            const team = board.teamId ? teams[board.teamId] : null;
            const listCount = board.listIds.length;
            const cardCount = board.listIds.reduce(
              (n, lid) => n + (lists[lid]?.cardIds.length ?? 0),
              0,
            );
            const memberCount = board.memberIds?.length ?? 0;

            return (
              <article
                key={board.id}
                className="group relative flex min-h-[132px] flex-col overflow-hidden rounded-xl border border-white/20 shadow-[0_8px_20px_rgba(9,30,66,0.22)] transition hover:border-white/40 hover:shadow-[0_12px_28px_rgba(9,30,66,0.28)]"
              >
                <button
                  type="button"
                  onClick={() => openBoard(board.id)}
                  className="flex min-h-[132px] flex-1 flex-col text-left"
                >
                  <div
                    className="relative flex flex-1 flex-col justify-end p-4"
                    style={{ backgroundImage: bg.preview }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/10 to-transparent" />
                    <div className="relative z-[1]">
                      <h2 className="font-[family-name:var(--font-display)] text-lg leading-snug text-white drop-shadow-sm">
                        {board.title}
                      </h2>
                      {board.description ? (
                        <p className="mt-1 line-clamp-2 text-xs text-white/85">
                          {board.description}
                        </p>
                      ) : null}
                      <p className="mt-2 text-[11px] text-white/75">
                        {team ? `${team.name} · ` : ""}
                        {listCount} listas · {cardCount} cards · {memberCount} membros
                      </p>
                      <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-white/65">
                        {bg.name} · {design.name}
                      </p>
                    </div>
                  </div>
                </button>

                <div className="absolute right-2 top-2 flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                  <button
                    type="button"
                    title="Convidar para o board"
                    onClick={(e) => {
                      e.stopPropagation();
                      setInviteBoardId(board.id);
                    }}
                    className="rounded-lg border border-white/15 bg-black/45 p-2 text-white backdrop-blur hover:bg-black/65"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    title="Renomear / personalizar"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCustomizeId(board.id);
                    }}
                    className="rounded-lg border border-white/15 bg-black/45 p-2 text-white backdrop-blur hover:bg-black/65"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    title="Fundo e design"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCustomizeId(board.id);
                    }}
                    className="rounded-lg border border-white/15 bg-black/45 p-2 text-white backdrop-blur hover:bg-black/65"
                  >
                    <Palette className="h-3.5 w-3.5" />
                  </button>
                </div>
              </article>
            );
          })}
          {boardQuery.trim() && filteredBoards.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-dashed border-[var(--line)] bg-black/15 px-6 py-12 text-center">
              <p className="text-sm text-white">Nenhum board encontrado</p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Tente outro termo de busca.
              </p>
            </div>
          ) : null}
        </div>
        ) : null}
      </main>

      {creating ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <form
            onSubmit={onCreate}
            className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-[var(--line)] bg-[var(--panel-strong)] sm:rounded-3xl"
          >
            <header className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
              <div>
                <p className="font-[family-name:var(--font-display)] text-lg text-white">
                  Novo board
                </p>
                <p className="text-xs text-[var(--muted)]">Nome, equipe, fundo e design</p>
              </div>
              <button
                type="button"
                onClick={() => setCreating(false)}
                className="rounded-lg p-2 text-[var(--muted)] hover:text-white"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="board-scroll space-y-4 overflow-y-auto p-4">
              <label className="block text-xs text-[var(--muted)]">
                Título
                <input
                  autoFocus
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[var(--line)] bg-[var(--ink)] px-3 py-2.5 text-sm text-white outline-none focus:border-[var(--accent)]"
                  placeholder="Ex.: Sprint Q3"
                />
              </label>
              <label className="block text-xs text-[var(--muted)]">
                Descrição
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[var(--line)] bg-[var(--ink)] px-3 py-2.5 text-sm text-white outline-none focus:border-[var(--accent)]"
                  placeholder="Opcional"
                />
              </label>

              <label className="block text-xs text-[var(--muted)]">
                Equipe do kanban
                <select
                  value={teamId}
                  onChange={(e) => {
                    setTeamId(e.target.value);
                    if (e.target.value) setNewTeamName("");
                  }}
                  className="mt-1 w-full rounded-xl border border-[var(--line)] bg-[var(--ink)] px-3 py-2.5 text-sm text-white outline-none focus:border-[var(--accent)]"
                >
                  <option value="">Sem equipe / criar nova abaixo</option>
                  {teamOptions.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.memberIds.length} membros)
                    </option>
                  ))}
                </select>
              </label>

              {!teamId ? (
                <label className="block text-xs text-[var(--muted)]">
                  Ou cadastrar novo time
                  <input
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-[var(--line)] bg-[var(--ink)] px-3 py-2.5 text-sm text-white outline-none focus:border-[var(--accent)]"
                    placeholder="Nome da equipe (ex.: Produto)"
                  />
                </label>
              ) : null}

              <AppearancePicker
                bgId={bgId}
                designId={designId}
                onBg={setBgId}
                onDesign={setDesignId}
              />
            </div>

            <footer className="flex gap-2 border-t border-[var(--line)] p-4">
              <button
                type="button"
                onClick={() => setCreating(false)}
                className="flex-1 rounded-xl border border-[var(--line)] px-3 py-2.5 text-sm text-[var(--muted)] hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!title.trim()}
                className="flex-1 rounded-xl bg-[var(--accent)] px-3 py-2.5 text-sm font-semibold text-[var(--accent-on)] disabled:opacity-40"
              >
                Criar e abrir
              </button>
            </footer>
          </form>
        </div>
      ) : null}

      {customizeBoard ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-[var(--line)] bg-[var(--panel-strong)] sm:rounded-3xl">
            <header className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
              <div className="flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-[var(--accent)]" />
                <div>
                  <p className="font-[family-name:var(--font-display)] text-lg text-white">
                    Personalizar
                  </p>
                  <p className="text-xs text-[var(--muted)]">{customizeBoard.title}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCustomizeId(null)}
                className="rounded-lg p-2 text-[var(--muted)] hover:text-white"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="board-scroll space-y-4 overflow-y-auto p-4">
              <label className="block text-xs text-[var(--muted)]">
                Título
                <input
                  value={customizeBoard.title}
                  onChange={(e) => renameBoard(customizeBoard.id, e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[var(--line)] bg-[var(--ink)] px-3 py-2.5 text-sm text-white outline-none focus:border-[var(--accent)]"
                />
              </label>
              <label className="block text-xs text-[var(--muted)]">
                Descrição
                <input
                  value={customizeBoard.description}
                  onChange={(e) =>
                    updateBoardDescription(customizeBoard.id, e.target.value)
                  }
                  className="mt-1 w-full rounded-xl border border-[var(--line)] bg-[var(--ink)] px-3 py-2.5 text-sm text-white outline-none focus:border-[var(--accent)]"
                />
              </label>

              <label className="block text-xs text-[var(--muted)]">
                Equipe atribuída
                <select
                  value={customizeBoard.teamId ?? ""}
                  onChange={(e) => {
                    assignTeamToBoard(customizeBoard.id, e.target.value || null);
                    if (e.target.value) setCustomizeNewTeam("");
                  }}
                  className="mt-1 w-full rounded-xl border border-[var(--line)] bg-[var(--ink)] px-3 py-2.5 text-sm text-white outline-none focus:border-[var(--accent)]"
                >
                  <option value="">Sem equipe</option>
                  {teamOptions.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.memberIds.length} membros)
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex gap-2">
                <input
                  value={customizeNewTeam}
                  onChange={(e) => setCustomizeNewTeam(e.target.value)}
                  className="min-w-0 flex-1 rounded-xl border border-[var(--line)] bg-[var(--ink)] px-3 py-2.5 text-sm text-white outline-none focus:border-[var(--accent)]"
                  placeholder="Cadastrar novo time neste board"
                />
                <button
                  type="button"
                  disabled={!customizeNewTeam.trim()}
                  onClick={() => {
                    const name = customizeNewTeam.trim();
                    if (!name || !customizeBoard) return;
                    const id = createTeam({
                      name,
                      memberIds: customizeBoard.memberIds?.length
                        ? [...customizeBoard.memberIds]
                        : currentUserId
                          ? [currentUserId]
                          : [],
                    });
                    assignTeamToBoard(customizeBoard.id, id);
                    setCustomizeNewTeam("");
                  }}
                  className="shrink-0 rounded-xl bg-[var(--accent)] px-3 py-2.5 text-sm font-semibold text-[var(--accent-on)] disabled:opacity-40"
                >
                  Criar
                </button>
              </div>

              <AppearancePicker
                bgId={
                  (customizeBoard.backgroundId as BoardBackgroundId) ||
                  DEFAULT_BACKGROUND_ID
                }
                designId={
                  (customizeBoard.designId as BoardDesignId) || DEFAULT_DESIGN_ID
                }
                onBg={(id) =>
                  updateBoardAppearance(customizeBoard.id, { backgroundId: id })
                }
                onDesign={(id) =>
                  updateBoardAppearance(customizeBoard.id, { designId: id })
                }
              />
            </div>

            <footer className="flex flex-wrap gap-2 border-t border-[var(--line)] p-4">
              <button
                type="button"
                onClick={() => {
                  if (
                    confirm(
                      `Excluir o board "${customizeBoard.title}"? Esta ação não pode ser desfeita.`,
                    )
                  ) {
                    deleteBoard(customizeBoard.id);
                    setCustomizeId(null);
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/30 px-3 py-2.5 text-sm text-rose-300 hover:bg-rose-500/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Excluir
              </button>
              <div className="ml-auto flex gap-2">
                <button
                  type="button"
                  onClick={() => setCustomizeId(null)}
                  className="rounded-xl border border-[var(--line)] px-3 py-2.5 text-sm text-[var(--muted)] hover:text-white"
                >
                  Fechar
                </button>
                <button
                  type="button"
                  onClick={() => openBoard(customizeBoard.id)}
                  className="rounded-xl bg-[var(--accent)] px-3 py-2.5 text-sm font-semibold text-[var(--accent-on)]"
                >
                  Abrir board
                </button>
              </div>
            </footer>
          </div>
        </div>
      ) : null}

      {inviteBoardId ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={() => setInviteBoardId(null)}
        >
          <div
            className="w-full max-w-md rounded-t-3xl border border-[var(--line)] bg-[var(--ink-2)] p-5 shadow-2xl sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <InvitePanel boardId={inviteBoardId} onClose={() => setInviteBoardId(null)} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AppearancePicker({
  bgId,
  designId,
  onBg,
  onDesign,
}: {
  bgId: BoardBackgroundId;
  designId: BoardDesignId;
  onBg: (id: BoardBackgroundId) => void;
  onDesign: (id: BoardDesignId) => void;
}) {
  return (
    <>
      <div>
        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          <Palette className="h-3.5 w-3.5" />
          Fundo
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {BOARD_BACKGROUNDS.map((bg) => {
            const active = bg.id === bgId;
            return (
              <button
                key={bg.id}
                type="button"
                onClick={() => onBg(bg.id)}
                className={`overflow-hidden rounded-xl border text-left transition ${
                  active
                    ? "border-[var(--accent)] ring-2 ring-[var(--accent)]/40"
                    : "border-[var(--line)] hover:border-white/30"
                }`}
              >
                <div className="h-14 w-full" style={{ backgroundImage: bg.preview }} />
                <p className="truncate bg-black/30 px-2 py-1.5 text-[11px] text-white">
                  {bg.name}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          <LayoutTemplate className="h-3.5 w-3.5" />
          Design
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {BOARD_DESIGNS.map((d) => {
            const active = d.id === designId;
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => onDesign(d.id)}
                className={`rounded-xl border px-3 py-2.5 text-left transition ${
                  active
                    ? "border-[var(--accent)] bg-[var(--accent)]/10"
                    : "border-[var(--line)] hover:border-white/25"
                }`}
              >
                <p className="text-sm font-medium text-white">{d.name}</p>
                <p className="text-[11px] text-[var(--muted)]">{d.description}</p>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
