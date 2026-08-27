"use client";

import { useMemo, useState } from "react";
import { History } from "lucide-react";
import { buildCardTimeline, type CardTimelineKind } from "@/lib/card-timeline";
import { useBoardStore } from "@/lib/store";
import {
  attachmentsByIds,
  CardAttachmentMedia,
} from "@/components/CardAttachmentMedia";
import type { Card, TeamMember } from "@/lib/types";

const KIND_LABEL: Record<CardTimelineKind, string> = {
  created: "Criação",
  comment: "Comentário",
  note: "Observação",
  attachment: "Documento",
  move: "Movimentação",
  update: "Atualização",
  archive: "Arquivo",
  delete: "Exclusão",
};

export function CardTimeline({
  card,
  members,
}: {
  card: Card;
  members: Record<string, TeamMember>;
}) {
  const activities = useBoardStore((s) => s.activities);
  const addCardComment = useBoardStore((s) => s.addCardComment);
  const [newComment, setNewComment] = useState("");

  const items = useMemo(
    () =>
      buildCardTimeline({
        card,
        activities: Object.values(activities || {}),
      }),
    [card, activities],
  );

  return (
    <div className="rounded-2xl border border-[var(--line)] bg-black/15 p-4 md:col-span-2">
      <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-[var(--muted)] sm:text-sm">
        <History className="h-3.5 w-3.5" />
        Linha do tempo
      </p>
      <p className="mb-3 text-[11px] text-[var(--muted)]">
        Criação, observações, figuras, documentos, comentários e movimentações deste card.
      </p>

      <div className="relative">
        {items.length > 0 ? (
          <div className="absolute bottom-2 left-[7px] top-2 w-px bg-[var(--line)]" />
        ) : null}
        <ul className="space-y-3">
          {items.map((item) => {
            const member = item.memberId ? members[item.memberId] : null;
            const media = attachmentsByIds(card.attachments, item.attachmentIds);
            return (
              <li key={item.id} className="relative pl-7">
                <span className="absolute left-0 top-2 h-3.5 w-3.5 rounded-full border-2 border-[var(--accent)] bg-[var(--ink-2)]" />
                <div className="rounded-xl border border-[var(--line)] bg-black/20 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-white/50">
                    {KIND_LABEL[item.kind]}
                  </p>
                  <p className="text-sm text-white">{item.label}</p>
                  <p className="text-[10px] text-[var(--muted)]">
                    {new Date(item.at).toLocaleString("pt-BR")}
                    {member?.name ? ` · ${member.name}` : ""}
                  </p>
                  {item.detail ? (
                    <p className="mt-1 whitespace-pre-wrap text-sm text-white/90">{item.detail}</p>
                  ) : null}
                  {media.length > 0 ? (
                    <div className="mt-2">
                      <CardAttachmentMedia
                        attachments={media}
                        compact={item.kind !== "note"}
                      />
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="mt-4 flex gap-2">
        <input
          className="min-w-0 flex-1 rounded-xl border border-[var(--line)] bg-[var(--ink)] px-3 py-2.5 text-sm text-white outline-none focus:border-[var(--accent)]"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Comentar na linha do tempo…"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              const text = newComment.trim();
              if (!text) return;
              addCardComment(card.id, text);
              setNewComment("");
            }
          }}
        />
        <button
          type="button"
          onClick={() => {
            const text = newComment.trim();
            if (!text) return;
            addCardComment(card.id, text);
            setNewComment("");
          }}
          className="rounded-xl border border-[var(--line)] px-3 py-2.5 text-sm text-white hover:bg-white/5"
        >
          Enviar
        </button>
      </div>
    </div>
  );
}
