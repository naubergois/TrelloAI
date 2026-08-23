import type { BoardSnapshot } from "@/lib/board-snapshot";
import { useBoardStore } from "@/lib/store";

let pushTimer: ReturnType<typeof setTimeout> | null = null;
let pendingBoardId: string | null = null;

export async function loadServerBoards(): Promise<number> {
  const res = await fetch("/api/boards", { credentials: "include" });
  if (!res.ok) return 0;
  const data = (await res.json()) as { snapshots?: BoardSnapshot[] };
  const snapshots = data.snapshots ?? [];
  for (const snapshot of snapshots) {
    useBoardStore.getState().mergeBoardSnapshot(snapshot, { setActive: false });
  }
  return snapshots.length;
}

export async function pushBoardToServer(boardId: string): Promise<boolean> {
  const snapshot = useBoardStore.getState().exportBoardSnapshot(boardId);
  if (!snapshot) return false;
  const res = await fetch(`/api/boards/${boardId}`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ snapshot }),
  });
  return res.ok;
}

export function scheduleBoardSync(boardId: string, delayMs = 2000) {
  pendingBoardId = boardId;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    const id = pendingBoardId;
    pendingBoardId = null;
    if (id) pushBoardToServer(id).catch(() => null);
  }, delayMs);
}

export function flushBoardSync(boardId: string) {
  if (pushTimer) clearTimeout(pushTimer);
  pendingBoardId = null;
  return pushBoardToServer(boardId);
}
