"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Check, Copy, Link2, Loader2, Plus, Trash2, UserPlus, Users, X } from "lucide-react";
import { useBoardStore } from "@/lib/store";
import { loadServerBoards } from "@/lib/board-sync";
import { useVisibleBoards } from "@/lib/use-visible-boards";
import { labelStyles } from "@/lib/utils";
import type { LabelColor } from "@/lib/types";
import type { BoardSnapshot } from "@/lib/board-snapshot";

const TEAM_COLORS: LabelColor[] = ["teal", "amber", "rose", "sky", "lime", "violet"];

export function TeamsManager() {
  const teams = useBoardStore((s) => s.teams);
  const members = useBoardStore((s) => s.members);
  const boards = useBoardStore((s) => s.boards);
  const createTeam = useBoardStore((s) => s.createTeam);
  const updateTeam = useBoardStore((s) => s.updateTeam);
  const deleteTeam = useBoardStore((s) => s.deleteTeam);
  const addMemberToTeam = useBoardStore((s) => s.addMemberToTeam);
  const removeMemberFromTeam = useBoardStore((s) => s.removeMemberFromTeam);

  const { teamList } = useVisibleBoards();

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState<LabelColor>("teal");
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null);
  const [memberName, setMemberName] = useState("");
  const [memberEmail, setMemberEmail] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const activeTeam =
    activeTeamId && teamList.some((t) => t.id === activeTeamId)
      ? teams[activeTeamId]
      : null;

  const boardsUsingTeam = useMemo(() => {
    if (!activeTeam) return [];
    return Object.values(boards).filter((b) => b.teamId === activeTeam.id);
  }, [boards, activeTeam]);

  const onCreate = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const id = createTeam({
      name: name.trim(),
      description: description.trim(),
      color,
    });
    setName("");
    setDescription("");
    setCreating(false);
    setActiveTeamId(id);
  };

  const onAddMember = (e: FormEvent) => {
    e.preventDefault();
    if (!activeTeam || !memberName.trim()) return;
    addMemberToTeam(activeTeam.id, {
      name: memberName.trim(),
      email: memberEmail.trim(),
    });
    setMemberName("");
    setMemberEmail("");
  };

  function snapshotsForTeam(teamId: string): BoardSnapshot[] {
    const state = useBoardStore.getState();
    const team = state.teams[teamId];
    if (!team) return [];
    const linked = Object.values(state.boards).filter((b) => b.teamId === teamId);
    const source = linked.length > 0 ? linked : Object.values(state.boards);
    return source
      .map((b) => {
        const snap = state.exportBoardSnapshot(b.id);
        if (!snap) return null;
        const members = { ...snap.members };
        for (const memberId of team.memberIds) {
          if (state.members[memberId]) members[memberId] = state.members[memberId];
        }
        return { ...snap, members, teams: { ...snap.teams, [team.id]: team } };
      })
      .filter((s): s is BoardSnapshot => Boolean(s));
  }

  async function onDeleteTeam() {
    if (!activeTeam) return;
    setDeleting(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/teams/${activeTeam.id}`, { method: "DELETE" });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setActionError(data.error || "Não foi possível excluir a equipe no servidor.");
        return;
      }
      const id = activeTeam.id;
      deleteTeam(id);
      setActiveTeamId(null);
      setConfirmDelete(false);
      await loadServerBoards();
      deleteTeam(id);
    } catch {
      setActionError("Erro de rede ao excluir a equipe.");
    } finally {
      setDeleting(false);
    }
  }

  async function onCreateInviteLink() {
    if (!activeTeam) return;
    setInviteBusy(true);
    setInviteCopied(false);
    setActionError(null);
    try {
      const snapshots = snapshotsForTeam(activeTeam.id);
      if (snapshots.length === 0) {
        setActionError("Crie um board no workspace para gerar o link de cadastro.");
        return;
      }
      const res = await fetch(`/api/teams/${activeTeam.id}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ team: activeTeam, snapshots }),
      });
      const data = (await res.json()) as { error?: string; urlPath?: string };
      if (!res.ok || !data.urlPath) {
        setActionError(data.error || "Falha ao gerar o link.");
        return;
      }
      const url = `${window.location.origin}${data.urlPath}`;
      setInviteUrl(url);
      try {
        await navigator.clipboard.writeText(url);
        setInviteCopied(true);
      } catch {
        /* copiar manualmente */
      }
    } catch {
      setActionError("Erro de rede ao gerar o link.");
    } finally {
      setInviteBusy(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Equipes
          </p>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="rounded-lg bg-[var(--accent)] p-1.5 text-[var(--accent-on)]"
            aria-label="Nova equipe"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <ul className="space-y-1">
          {teamList.length === 0 ? (
            <li className="px-2 py-6 text-center text-xs text-[var(--muted)]">
              Nenhuma equipe ainda
            </li>
          ) : (
            teamList.map((team) => (
              <li key={team.id}>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTeamId(team.id);
                    setInviteUrl(null);
                    setInviteCopied(false);
                    setActionError(null);
                    setConfirmDelete(false);
                  }}
                  className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-sm transition ${
                    activeTeamId === team.id
                      ? "bg-[var(--accent)]/15 text-white"
                      : "text-[var(--muted)] hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold ${labelStyles[team.color]}`}
                  >
                    {team.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{team.name}</span>
                  <span className="text-[10px] opacity-70">{team.memberIds.length}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      </aside>

      <section className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5">
        {!activeTeam ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <Users className="h-10 w-10 text-[var(--accent)]" />
            <p className="font-[family-name:var(--font-display)] text-lg text-white">
              Crie equipes e vincule aos boards
            </p>
            <p className="max-w-sm text-sm text-[var(--muted)]">
              Uma equipe pode ser atribuída a vários kanbans. Membros novos na
              equipe entram automaticamente nos boards vinculados.
            </p>
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="mt-2 inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[var(--accent-on)]"
            >
              <Plus className="h-4 w-4" />
              Nova equipe
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-2">
                <input
                  value={activeTeam.name}
                  onChange={(e) =>
                    updateTeam(activeTeam.id, { name: e.target.value })
                  }
                  className="w-full bg-transparent font-[family-name:var(--font-display)] text-xl text-white outline-none"
                />
                <input
                  value={activeTeam.description}
                  onChange={(e) =>
                    updateTeam(activeTeam.id, { description: e.target.value })
                  }
                  placeholder="Descrição da equipe"
                  className="w-full bg-transparent text-sm text-[var(--muted)] outline-none placeholder:text-[var(--muted)]/60"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  setConfirmDelete(true);
                  setActionError(null);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/30 px-3 py-2 text-xs text-rose-300 hover:bg-rose-500/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Excluir
              </button>
            </div>

            {actionError ? (
              <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                {actionError}
              </p>
            ) : null}

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Link de cadastro
              </p>
              <p className="mb-3 text-sm text-[var(--muted)]">
                Envie este link para a pessoa criar uma conta e entrar nesta equipe
                {boardsUsingTeam.length > 0
                  ? " e nos boards vinculados."
                  : ". Vincule a equipe a um kanban para ela cair direto nele."}
              </p>
              <button
                type="button"
                disabled={inviteBusy}
                onClick={() => void onCreateInviteLink()}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[var(--accent-on)] disabled:opacity-60"
              >
                {inviteBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                Gerar link de cadastro
              </button>
              {inviteUrl ? (
                <div className="mt-3 space-y-2 rounded-xl border border-[var(--line)] bg-black/25 p-3">
                  <code className="block break-all text-[11px] text-[var(--accent)]">{inviteUrl}</code>
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard.writeText(inviteUrl).then(
                        () => setInviteCopied(true),
                        () => setActionError("Não foi possível copiar. Copie o link manualmente."),
                      );
                    }}
                    className="inline-flex items-center gap-2 rounded-lg border border-[var(--line)] px-3 py-2 text-sm text-white hover:border-[var(--accent)]"
                  >
                    {inviteCopied ? (
                      <Check className="h-4 w-4 text-[var(--accent)]" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                    {inviteCopied ? "Copiado!" : "Copiar link"}
                  </button>
                </div>
              ) : null}
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Cor
              </p>
              <div className="flex flex-wrap gap-2">
                {TEAM_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => updateTeam(activeTeam.id, { color: c })}
                    className={`h-7 w-7 rounded-full ${labelStyles[c]} ${
                      activeTeam.color === c ? "ring-2 ring-white ring-offset-2 ring-offset-[var(--ink)]" : ""
                    }`}
                    aria-label={c}
                  />
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Boards vinculados ({boardsUsingTeam.length})
              </p>
              {boardsUsingTeam.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">
                  Nenhum board ainda. Atribua esta equipe ao criar ou personalizar um board.
                </p>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {boardsUsingTeam.map((b) => (
                    <li
                      key={b.id}
                      className="rounded-full border border-[var(--line)] bg-black/20 px-3 py-1 text-xs text-white"
                    >
                      {b.title}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Membros ({activeTeam.memberIds.length})
              </p>
              <ul className="mb-3 space-y-2">
                {activeTeam.memberIds.map((id) => {
                  const m = members[id];
                  if (!m) return null;
                  return (
                    <li
                      key={id}
                      className="flex items-center gap-3 rounded-xl border border-[var(--line)] bg-black/20 px-3 py-2"
                    >
                      <span
                        className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${labelStyles[m.color]}`}
                      >
                        {m.name.slice(0, 1).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-white">{m.name}</p>
                        <p className="truncate text-[11px] text-[var(--muted)]">{m.email}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeMemberFromTeam(activeTeam.id, id)}
                        className="rounded-lg p-1.5 text-[var(--muted)] hover:text-rose-300"
                        aria-label={`Remover ${m.name}`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </li>
                  );
                })}
              </ul>

              <form onSubmit={onAddMember} className="flex flex-col gap-2 sm:flex-row">
                <input
                  value={memberName}
                  onChange={(e) => setMemberName(e.target.value)}
                  placeholder="Nome"
                  className="flex-1 rounded-xl border border-[var(--line)] bg-[var(--ink)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                />
                <input
                  value={memberEmail}
                  onChange={(e) => setMemberEmail(e.target.value)}
                  placeholder="Email"
                  className="flex-1 rounded-xl border border-[var(--line)] bg-[var(--ink)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                />
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-[var(--accent-on)]"
                >
                  <UserPlus className="h-4 w-4" />
                  Adicionar
                </button>
              </form>
            </div>
          </div>
        )}
      </section>

      {creating ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <form
            onSubmit={onCreate}
            className="w-full max-w-md rounded-t-3xl border border-[var(--line)] bg-[var(--panel-strong)] sm:rounded-3xl"
          >
            <header className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
              <p className="font-[family-name:var(--font-display)] text-white">Nova equipe</p>
              <button
                type="button"
                onClick={() => setCreating(false)}
                className="rounded-lg p-2 text-[var(--muted)] hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </header>
            <div className="space-y-3 p-4">
              <label className="block text-xs text-[var(--muted)]">
                Nome
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[var(--line)] bg-[var(--ink)] px-3 py-2.5 text-sm text-white outline-none focus:border-[var(--accent)]"
                  placeholder="Ex.: Engenharia"
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
              <div>
                <p className="mb-2 text-xs text-[var(--muted)]">Cor</p>
                <div className="flex flex-wrap gap-2">
                  {TEAM_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`h-7 w-7 rounded-full ${labelStyles[c]} ${
                        color === c ? "ring-2 ring-white ring-offset-2 ring-offset-[var(--ink)]" : ""
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
            <footer className="flex gap-2 border-t border-[var(--line)] p-4">
              <button
                type="button"
                onClick={() => setCreating(false)}
                className="flex-1 rounded-xl border border-[var(--line)] py-2.5 text-sm text-[var(--muted)]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!name.trim()}
                className="flex-1 rounded-xl bg-[var(--accent)] py-2.5 text-sm font-semibold text-[var(--accent-on)] disabled:opacity-40"
              >
                Criar equipe
              </button>
            </footer>
          </form>
        </div>
      ) : null}

      {confirmDelete && activeTeam ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/65 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div
            role="dialog"
            aria-labelledby="delete-team-title"
            aria-modal="true"
            className="w-full max-w-md overflow-hidden rounded-t-3xl border border-[var(--line)] bg-[var(--panel-strong)] sm:rounded-3xl"
          >
            <header className="flex items-start justify-between gap-3 border-b border-[var(--line)] px-4 py-3">
              <div>
                <p
                  id="delete-team-title"
                  className="font-[family-name:var(--font-display)] text-lg text-white"
                >
                  Excluir esta equipe?
                </p>
                <p className="mt-1 text-sm text-[var(--muted)]">{activeTeam.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
                className="rounded-lg p-2 text-[var(--muted)] hover:text-white disabled:opacity-40"
                aria-label="Cancelar"
              >
                <X className="h-4 w-4" />
              </button>
            </header>
            <div className="space-y-3 px-4 py-4 text-sm leading-relaxed text-[var(--muted)]">
              <p>
                A equipe sai de todos os kanbans. Os boards e os membros continuam; só o vínculo
                com esta equipe é removido. Esta ação{" "}
                <strong className="text-white">não pode ser desfeita</strong>.
              </p>
              {boardsUsingTeam.length > 0 ? (
                <p className="text-xs">
                  {boardsUsingTeam.length} board(s) vinculado(s) ficam sem equipe.
                </p>
              ) : null}
            </div>
            <footer className="flex gap-2 border-t border-[var(--line)] p-4">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
                className="flex-1 rounded-xl border border-[var(--line)] px-3 py-2.5 text-sm text-[var(--muted)] hover:text-white disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void onDeleteTeam()}
                disabled={deleting}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-rose-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Excluir equipe
              </button>
            </footer>
          </div>
        </div>
      ) : null}
    </div>
  );
}
