"use client";

import { useMemo } from "react";
import { X, History } from "lucide-react";
import { useBoardStore } from "@/lib/store";
import { activityKindLabel } from "@/lib/utils";

export function ActivityPanel({
  boardId,
  onClose,
}: {
  boardId: string;
  onClose: () => void;
}) {
  const activities = useBoardStore((s) => s.activities);
  const members = useBoardStore((s) => s.members);
  const cards = useBoardStore((s) => s.cards);

  const items = useMemo(() => {
    return Object.values(activities || {})
      .filter((a) => a.boardId === boardId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 80);
  }, [activities, boardId]);

  return (
    <aside className="anim-rise panel-glass flex h-full min-h-0 w-full flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--line)] px-4 py-3">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-[var(--accent)]" />
          <h2 className="font-[family-name:var(--font-display)] text-lg text-white">
            Atividade
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-[var(--line)] p-2 text-[var(--muted)] hover:text-white"
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="board-scroll min-h-0 flex-1 overflow-y-auto p-4">
        {items.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            Nenhuma atividade registrada neste board ainda.
          </p>
        ) : (
          <ul className="space-y-2">
            {items.map((act) => {
              const member = members[act.memberId];
              const cardTitle = act.cardId ? cards[act.cardId]?.title : null;
              return (
                <li
                  key={act.id}
                  className="rounded-xl border border-[var(--line)] bg-black/20 px-3 py-2.5"
                >
                  <p className="text-sm text-white">
                    <span className="font-medium">{member?.name ?? "Membro"}</span>
                    {" · "}
                    {activityKindLabel[act.kind]}
                    {cardTitle ? (
                      <span className="text-[var(--muted)]"> — {cardTitle}</span>
                    ) : null}
                  </p>
                  {act.note ? (
                    <p className="mt-1 text-xs text-[var(--muted)] line-clamp-2">{act.note}</p>
                  ) : null}
                  <p className="mt-1 text-[10px] text-[var(--muted)]">
                    {new Date(act.createdAt).toLocaleString("pt-BR")}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
