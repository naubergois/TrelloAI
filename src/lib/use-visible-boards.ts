"use client";

import { useMemo } from "react";
import { useSession } from "next-auth/react";
import { useBoardStore } from "@/lib/store";
import { filterBoardsForMember, filterTeamsForMember } from "@/lib/board-access";

export function useVisibleBoards() {
  const boards = useBoardStore((s) => s.boards);
  const teams = useBoardStore((s) => s.teams);
  const currentUserId = useBoardStore((s) => s.currentUserId);
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";

  const boardList = useMemo(
    () =>
      filterBoardsForMember(Object.values(boards), currentUserId, teams, { isAdmin }).sort(
        (a, b) => b.updatedAt.localeCompare(a.updatedAt),
      ),
    [boards, currentUserId, teams, isAdmin],
  );

  const teamList = useMemo(
    () =>
      filterTeamsForMember(Object.values(teams), currentUserId, { isAdmin }).sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
    [teams, currentUserId, isAdmin],
  );

  const visibleIds = useMemo(() => new Set(boardList.map((b) => b.id)), [boardList]);

  return { boardList, teamList, isAdmin, currentUserId, visibleIds };
}
