import type { BoardSnapshot } from "@/lib/board-snapshot";
import { useBoardStore } from "@/lib/store";

let pushTimer: ReturnType<typeof setTimeout> | null = null;
let pendingBoardId: string | null = null;

export async function loadServerBoards(): Promise<number> {
  const res = await fetch("/api/boards", { credentials: "include" });
  if (!res.ok) return 0;
  const data = (await res.json()) as { snapshots?: BoardSnapshot[] };
  const snapshots = data.snapshots ?? [];
  useBoardStore.getState().adoptServerSnapshots(snapshots);
  return snapshots.length;
}

export async function saveVisibleBoards(boardIds: string[]): Promise<number> {
  const res = await fetch("/api/boards/visibility", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ boardIds }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    snapshots?: BoardSnapshot[];
    error?: string;
  };
  if (!res.ok) {
    throw new Error(data.error || "Não foi possível salvar a escolha.");
  }
  const snapshots = data.snapshots ?? [];
  useBoardStore.getState().adoptServerSnapshots(snapshots);
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

export function cancelBoardSync(boardId?: string) {
  if (boardId && pendingBoardId && pendingBoardId !== boardId) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = null;
  pendingBoardId = null;
}

export async function removeBoardFromServer(boardId: string): Promise<boolean> {
  cancelBoardSync(boardId);
  try {
    const res = await fetch(`/api/boards/${boardId}`, {
      method: "DELETE",
      credentials: "include",
    });
    return res.ok || res.status === 404 || res.status === 401;
  } catch {
    return false;
  }
}
