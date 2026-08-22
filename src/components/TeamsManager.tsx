"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Plus, Trash2, UserPlus, Users, X } from "lucide-react";
import { useBoardStore } from "@/lib/store";
import { labelStyles } from "@/lib/utils";
import type { LabelColor } from "@/lib/types";

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

  const teamList = useMemo(
    () => Object.values(teams).sort((a, b) => a.name.localeCompare(b.name)),
    [teams],
  );

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState<LabelColor>("teal");
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null);
  const [memberName, setMemberName] = useState("");
  const [memberEmail, setMemberEmail] = useState("");

  const activeTeam = activeTeamId ? teams[activeTeamId] : null;

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
                  onClick={() => setActiveTeamId(team.id)}
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
                  if (
                    confirm(
                      `Excluir a equipe "${activeTeam.name}"? Os boards vinculados ficam sem equipe.`,
                    )
                  ) {
                    deleteTeam(activeTeam.id);
                    setActiveTeamId(null);
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/30 px-3 py-2 text-xs text-rose-300 hover:bg-rose-500/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Excluir
              </button>
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
    </div>
  );
}
