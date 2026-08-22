"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  CalendarPlus,
  Copy,
  Trash2,
  UserPlus,
  Video,
  X,
  Radio,
} from "lucide-react";
import { useBoardStore } from "@/lib/store";
import { labelStyles } from "@/lib/utils";
import type { MeetingStatus } from "@/lib/types";

function statusLabel(status: MeetingStatus) {
  if (status === "live") return "Ao vivo";
  if (status === "ended") return "Encerrada";
  return "Agendada";
}

function statusClass(status: MeetingStatus) {
  if (status === "live") return "bg-rose-500/20 text-rose-300 ring-rose-500/30";
  if (status === "ended") return "bg-white/5 text-[var(--muted)] ring-white/10";
  return "bg-amber-500/15 text-amber-300 ring-amber-500/30";
}

function formatWhen(iso: string | null) {
  if (!iso) return "Sem horário";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function MeetingsPanel({
  boardId,
  onClose,
}: {
  boardId: string;
  onClose: () => void;
}) {
  const board = useBoardStore((s) => s.boards[boardId]);
  const members = useBoardStore((s) => s.members);
  const teams = useBoardStore((s) => s.teams);
  const meetings = useBoardStore((s) => s.meetings);
  const currentUserId = useBoardStore((s) => s.currentUserId);
  const addTeamMember = useBoardStore((s) => s.addTeamMember);
  const removeTeamMember = useBoardStore((s) => s.removeTeamMember);
  const assignTeamToBoard = useBoardStore((s) => s.assignTeamToBoard);
  const createTeam = useBoardStore((s) => s.createTeam);
  const setCurrentUserName = useBoardStore((s) => s.setCurrentUserName);
  const createMeeting = useBoardStore((s) => s.createMeeting);
  const joinMeeting = useBoardStore((s) => s.joinMeeting);
  const deleteMeeting = useBoardStore((s) => s.deleteMeeting);

  const [memberName, setMemberName] = useState("");
  const [memberEmail, setMemberEmail] = useState("");
  const [meetingTitle, setMeetingTitle] = useState("Sync da equipe");
  const [meetingWhen, setMeetingWhen] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [creatingTeam, setCreatingTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamDescription, setNewTeamDescription] = useState("");

  const team = useMemo(() => {
    if (!board) return [];
    return (board.memberIds ?? [])
      .map((id) => members[id])
      .filter(Boolean);
  }, [board, members]);

  const teamOptions = useMemo(
    () => Object.values(teams).sort((a, b) => a.name.localeCompare(b.name)),
    [teams],
  );

  const assignedTeam = board?.teamId ? teams[board.teamId] : null;

  const boardMeetings = useMemo(() => {
    return Object.values(meetings)
      .filter((m) => m.boardId === boardId)
      .sort((a, b) => {
        const aTime = a.scheduledAt || a.createdAt;
        const bTime = b.scheduledAt || b.createdAt;
        return bTime.localeCompare(aTime);
      });
  }, [meetings, boardId]);

  const me = currentUserId ? members[currentUserId] : null;

  if (!board) return null;

  const onAddMember = (e: FormEvent) => {
    e.preventDefault();
    if (!memberName.trim()) return;
    addTeamMember(boardId, {
      name: memberName.trim(),
      email: memberEmail.trim(),
    });
    setMemberName("");
    setMemberEmail("");
  };

  const onCreateTeam = (e: FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;
    const existingMemberIds = board.memberIds?.length
      ? [...board.memberIds]
      : currentUserId
        ? [currentUserId]
        : [];
    const id = createTeam({
      name: newTeamName.trim(),
      description: newTeamDescription.trim(),
      memberIds: existingMemberIds,
    });
    assignTeamToBoard(boardId, id);
    setNewTeamName("");
    setNewTeamDescription("");
    setCreatingTeam(false);
  };

  const onSchedule = (e: FormEvent) => {
    e.preventDefault();
    createMeeting({
      boardId,
      title: meetingTitle,
      scheduledAt: meetingWhen ? new Date(meetingWhen).toISOString() : null,
      startNow: false,
    });
    setMeetingTitle("Sync da equipe");
    setMeetingWhen("");
  };

  const copyLink = async (roomSlug: string, meetingId: string) => {
    const url = `https://meet.jit.si/${encodeURIComponent(roomSlug)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(meetingId);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      window.prompt("Copie o link da reunião:", url);
    }
  };

  return (
    <aside className="anim-rise flex h-full min-h-0 w-full flex-col overflow-hidden rounded-t-3xl border border-[var(--line)] bg-[var(--panel-strong)] sm:rounded-2xl">
      <header className="flex shrink-0 items-center justify-between border-b border-[var(--line)] px-4 py-3">
        <div className="flex items-center gap-2">
          <Video className="h-4 w-4 text-[var(--accent-2)]" />
          <div>
            <p className="text-sm font-semibold text-white">Reuniões & equipe</p>
            <p className="text-xs text-[var(--muted)]">Salas virtuais no board</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-[var(--muted)] hover:bg-white/5 hover:text-white"
          aria-label="Fechar painel"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="board-scroll min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Seu nome na reunião
          </h3>
          <input
            value={me?.name ?? ""}
            onChange={(e) => setCurrentUserName(e.target.value)}
            className="w-full rounded-lg border border-[var(--line)] bg-[var(--ink)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            placeholder="Como você aparece no vídeo"
          />
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Equipe do board ({team.length})
            </h3>
            {!creatingTeam ? (
              <button
                type="button"
                onClick={() => setCreatingTeam(true)}
                className="rounded-lg border border-[var(--line)] px-2 py-1 text-[11px] text-[var(--accent)] hover:bg-[var(--accent)]/10"
              >
                + Cadastrar time
              </button>
            ) : null}
          </div>

          {creatingTeam ? (
            <form
              onSubmit={onCreateTeam}
              className="mb-3 space-y-2 rounded-xl border border-[var(--accent)]/40 bg-[var(--accent)]/5 p-3"
            >
              <p className="text-xs font-medium text-white">Nova equipe neste board</p>
              <input
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                placeholder="Nome do time (ex.: ASESI)"
                className="w-full rounded-lg border border-[var(--line)] bg-[var(--ink)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                autoFocus
                required
              />
              <input
                value={newTeamDescription}
                onChange={(e) => setNewTeamDescription(e.target.value)}
                placeholder="Descrição (opcional)"
                className="w-full rounded-lg border border-[var(--line)] bg-[var(--ink)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
              />
              <p className="text-[11px] text-[var(--muted)]">
                Os membros atuais do board entram automaticamente na nova equipe.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCreatingTeam(false);
                    setNewTeamName("");
                    setNewTeamDescription("");
                  }}
                  className="flex-1 rounded-lg border border-[var(--line)] px-3 py-2 text-sm text-[var(--muted)] hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-[var(--accent-on)]"
                >
                  Criar e vincular
                </button>
              </div>
            </form>
          ) : null}

          <label className="mb-3 block text-[11px] text-[var(--muted)]">
            Equipe vinculada
            <select
              value={board.teamId ?? ""}
              onChange={(e) => assignTeamToBoard(boardId, e.target.value || null)}
              className="mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--ink)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            >
              <option value="">Sem equipe (membros manuais)</option>
              {teamOptions.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.memberIds.length})
                </option>
              ))}
            </select>
          </label>
          {assignedTeam ? (
            <p className="mb-3 text-[11px] text-[var(--muted)]">
              Usando <strong className="text-white">{assignedTeam.name}</strong>. Novos
              membros adicionados aqui também entram na equipe.
            </p>
          ) : teamOptions.length === 0 ? (
            <p className="mb-3 text-[11px] text-[var(--muted)]">
              Nenhuma equipe cadastrada. Use <strong className="text-white">+ Cadastrar time</strong>{" "}
              para criar e vincular ao board.
            </p>
          ) : null}

          <ul className="mb-3 space-y-2">
            {team.map((member) => (
              <li
                key={member.id}
                className="flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--ink)]/50 px-2.5 py-2"
              >
                {member.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={member.image}
                    alt=""
                    className="h-8 w-8 rounded-full object-cover ring-1 ring-[var(--line)]"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${labelStyles[member.color]}`}
                  >
                    {member.name.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-white">
                    {member.name}
                    {member.id === currentUserId ? " (você)" : ""}
                  </p>
                  <p className="truncate text-[11px] text-[var(--muted)]">
                    {member.email} · {member.role === "owner" ? "owner" : "membro"}
                  </p>
                </div>
                {member.id !== currentUserId ? (
                  <button
                    type="button"
                    onClick={() => removeTeamMember(boardId, member.id)}
                    className="rounded p-1 text-[var(--muted)] hover:text-rose-300"
                    aria-label={`Remover ${member.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
          <form onSubmit={onAddMember} className="space-y-2">
            <input
              value={memberName}
              onChange={(e) => setMemberName(e.target.value)}
              placeholder="Nome do membro"
              className="w-full rounded-lg border border-[var(--line)] bg-[var(--ink)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            />
            <input
              value={memberEmail}
              onChange={(e) => setMemberEmail(e.target.value)}
              placeholder="Email"
              type="email"
              className="w-full rounded-lg border border-[var(--line)] bg-[var(--ink)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            />
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--line)] px-3 py-2 text-sm text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-white"
            >
              <UserPlus className="h-4 w-4" />
              Adicionar à equipe
            </button>
          </form>
        </section>

        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Nova reunião
          </h3>
          <button
            type="button"
            onClick={() =>
              createMeeting({
                boardId,
                title: `Reunião ao vivo — ${board.title}`,
                startNow: true,
              })
            }
            className="mb-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-3 py-2.5 text-sm font-semibold text-[var(--accent-on)] transition hover:brightness-110"
          >
            <Radio className="h-4 w-4" />
            Iniciar reunião agora
          </button>
          <form onSubmit={onSchedule} className="space-y-2">
            <input
              value={meetingTitle}
              onChange={(e) => setMeetingTitle(e.target.value)}
              placeholder="Título da reunião"
              className="w-full rounded-lg border border-[var(--line)] bg-[var(--ink)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            />
            <input
              type="datetime-local"
              value={meetingWhen}
              onChange={(e) => setMeetingWhen(e.target.value)}
              className="w-full rounded-lg border border-[var(--line)] bg-[var(--ink)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            />
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--accent-2)]/40 bg-[var(--accent-2)]/10 px-3 py-2 text-sm text-[var(--accent-2)] transition hover:bg-[var(--accent-2)]/20"
            >
              <CalendarPlus className="h-4 w-4" />
              Agendar reunião
            </button>
          </form>
        </section>

        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Reuniões do board
          </h3>
          {boardMeetings.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              Nenhuma reunião ainda. Inicie uma agora ou agende.
            </p>
          ) : (
            <ul className="space-y-2">
              {boardMeetings.map((meeting) => (
                <li
                  key={meeting.id}
                  className="rounded-xl border border-[var(--line)] bg-[var(--ink)]/40 p-3"
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">
                        {meeting.title}
                      </p>
                      <p className="text-[11px] text-[var(--muted)]">
                        {formatWhen(meeting.scheduledAt)} ·{" "}
                        {meeting.participantIds.length} participantes
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${statusClass(meeting.status)}`}
                    >
                      {statusLabel(meeting.status)}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {meeting.status !== "ended" ? (
                      <button
                        type="button"
                        onClick={() => joinMeeting(meeting.id)}
                        className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1.5 text-xs text-white transition hover:bg-[var(--accent)] hover:text-[var(--accent-on)]"
                      >
                        <Video className="h-3.5 w-3.5" />
                        Entrar
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void copyLink(meeting.roomSlug, meeting.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-[var(--line)] px-2.5 py-1.5 text-xs text-[var(--muted)] hover:text-white"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      {copiedId === meeting.id ? "Copiado" : "Link"}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteMeeting(meeting.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-[var(--line)] px-2.5 py-1.5 text-xs text-[var(--muted)] hover:text-rose-300"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remover
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </aside>
  );
}
