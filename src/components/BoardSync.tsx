"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useBoardStore } from "@/lib/store";
import { loadServerBoards, scheduleBoardSync, scheduleMayaChatSync } from "@/lib/board-sync";

/** Pull cloud boards after login and push local changes while editing. */
export function BoardSync() {
  const { data: session, status } = useSession();
  const hydrated = useBoardStore((s) => s.hydrated);
  const activeBoardId = useBoardStore((s) => s.activeBoardId);

  useEffect(() => {
    if (status !== "authenticated" || !hydrated) return;
    loadServerBoards().catch(() => null);
  }, [status, hydrated, session?.user?.email]);

  useEffect(() => {
    if (status !== "authenticated" || !activeBoardId) return;
    scheduleBoardSync(activeBoardId, 1500);
  }, [status, activeBoardId]);

  useEffect(() => {
    if (status !== "authenticated") return;
    const unsub = useBoardStore.subscribe((state, prev) => {
      const boardId = state.activeBoardId;
      if (!boardId) return;
      const changed =
        state.cards !== prev.cards ||
        state.lists !== prev.lists ||
        state.boards !== prev.boards ||
        state.members !== prev.members ||
        state.teams !== prev.teams ||
        state.requirements !== prev.requirements ||
        state.calendarEvents !== prev.calendarEvents ||
        state.standups !== prev.standups;
      if (changed) scheduleBoardSync(boardId);
      if (state.mayaLogs !== prev.mayaLogs) {
        const ids = new Set<string>();
        if (boardId) ids.add(boardId);
        for (const log of Object.values(state.mayaLogs || {})) {
          if (state.mayaLogs[log.id] !== prev.mayaLogs?.[log.id]) ids.add(log.boardId);
        }
        for (const id of ids) scheduleMayaChatSync(id);
      }
    });
    return unsub;
  }, [status]);

  return null;
}
