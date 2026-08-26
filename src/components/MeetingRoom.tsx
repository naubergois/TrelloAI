"use client";

import { ExternalLink, PhoneOff, Video } from "lucide-react";
import { useBoardStore } from "@/lib/store";

function jitsiEmbedUrl(roomSlug: string, displayName: string) {
  const hash = [
    `userInfo.displayName="${encodeURIComponent(displayName)}"`,
    "config.prejoinConfig.enabled=true",
    "config.startWithAudioMuted=false",
    "config.startWithVideoMuted=false",
  ].join("&");
  return `https://meet.jit.si/${encodeURIComponent(roomSlug)}#${hash}`;
}

export function MeetingRoom() {
  const activeMeetingId = useBoardStore((s) => s.activeMeetingId);
  const meeting = useBoardStore((s) =>
    activeMeetingId ? s.meetings[activeMeetingId] : null,
  );
  const currentUserId = useBoardStore((s) => s.currentUserId);
  const members = useBoardStore((s) => s.members);
  const leaveMeeting = useBoardStore((s) => s.leaveMeeting);
  const endMeeting = useBoardStore((s) => s.endMeeting);

  if (!meeting) return null;

  const me = currentUserId ? members[currentUserId] : null;
  const displayName = me?.name || "Participante";
  const embedUrl = jitsiEmbedUrl(meeting.roomSlug, displayName);
  const openUrl = `https://meet.jit.si/${encodeURIComponent(meeting.roomSlug)}`;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#050b14]">
      <header className="flex shrink-0 flex-col gap-3 border-b border-[var(--line)] bg-[var(--panel-strong)] px-3 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:flex-row sm:items-center sm:justify-between sm:px-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-2 w-2 shrink-0 animate-pulse rounded-full bg-rose-400" />
            <p className="truncate font-[family-name:var(--font-display)] text-base text-white sm:text-lg">
              {meeting.title}
            </p>
          </div>
          <p className="truncate text-xs text-[var(--muted)]">
            Sala · {meeting.roomSlug} · você entra como {displayName}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={openUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border border-[var(--line)] px-3 py-2 text-sm text-[var(--muted)] transition hover:text-white sm:flex-none"
          >
            <ExternalLink className="h-4 w-4" />
            <span className="sm:hidden">Nova aba</span>
            <span className="hidden sm:inline">Abrir em nova aba</span>
          </a>
          <button
            type="button"
            onClick={() => leaveMeeting()}
            className="min-h-10 flex-1 rounded-lg border border-[var(--line)] px-3 py-2 text-sm text-[var(--muted)] transition hover:text-white sm:flex-none"
          >
            Voltar
          </button>
          <button
            type="button"
            onClick={() => endMeeting(meeting.id)}
            className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-rose-500 px-3 py-2 text-sm font-medium text-white transition hover:brightness-110 sm:flex-none"
          >
            <PhoneOff className="h-4 w-4" />
            Encerrar
          </button>
        </div>
      </header>

      <div className="relative min-h-0 flex-1">
        <iframe
          title={`Reunião ${meeting.title}`}
          src={embedUrl}
          allow="camera; microphone; fullscreen; display-capture; autoplay"
          className="h-full w-full border-0"
          allowFullScreen
        />
        <div className="pointer-events-none absolute bottom-4 left-4 inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-black/50 px-3 py-1.5 text-xs text-[var(--muted)] backdrop-blur">
          <Video className="h-3.5 w-3.5 text-[var(--accent)]" />
          Powered by Jitsi Meet · áudio/vídeo peer-to-peer
        </div>
      </div>
    </div>
  );
}
