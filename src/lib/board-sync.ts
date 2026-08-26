import type { BoardSnapshot } from "@/lib/board-snapshot";
import type { MayaDayLog } from "@/lib/types";
import { useBoardStore } from "@/lib/store";

let pushTimer: ReturnType<typeof setTimeout> | null = null;
let pendingBoardId: string | null = null;
let chatTimer: ReturnType<typeof setTimeout> | null = null;
const pendingChatBoardIds = new Set<string>();
let serverAdopted = false;

function adoptMayaLogs(logs?: Record<string, MayaDayLog>) {
  if (!logs || Object.keys(logs).length === 0) return;
  useBoardStore.getState().adoptUserMayaLogs(logs);
}

export async function loadServerBoards(): Promise<number> {
  const res = await fetch("/api/boards", { credentials: "include" });
  if (!res.ok) return 0;
  const data = (await res.json()) as {
    snapshots?: BoardSnapshot[];
    mayaLogs?: Record<string, MayaDayLog>;
  };
  const snapshots = data.snapshots ?? [];
  if (snapshots.length === 0) return 0;
  useBoardStore.getState().adoptServerSnapshots(snapshots);
  adoptMayaLogs(data.mayaLogs);
  serverAdopted = true;
  for (const snapshot of snapshots) {
    scheduleMayaChatSync(snapshot.board.id, 600);
  }
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
    mayaLogs?: Record<string, MayaDayLog>;
    error?: string;
  };
  if (!res.ok) {
    throw new Error(data.error || "Não foi possível salvar a escolha.");
  }
  const snapshots = data.snapshots ?? [];
  useBoardStore.getState().adoptServerSnapshots(snapshots);
  adoptMayaLogs(data.mayaLogs);
  serverAdopted = true;
  return snapshots.length;
}

export async function pushBoardToServer(boardId: string): Promise<boolean> {
  if (!serverAdopted) return false;
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

export async function pushMayaChatsToServer(boardId: string): Promise<boolean> {
  if (!serverAdopted) return false;
  const logs = Object.values(useBoardStore.getState().mayaLogs || {}).filter(
    (log) => log.boardId === boardId,
  );
  const res = await fetch(`/api/boards/${boardId}/maya-chat`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ logs }),
  });
  return res.ok;
}

export async function deleteMayaChatOnServer(
  boardId: string,
  date: string,
  messageId?: string,
): Promise<boolean> {
  if (!serverAdopted) return false;
  const params = new URLSearchParams({ date });
  if (messageId) params.set("messageId", messageId);
  const res = await fetch(`/api/boards/${boardId}/maya-chat?${params.toString()}`, {
    method: "DELETE",
    credentials: "include",
  });
  return res.ok || res.status === 404;
}

export function scheduleBoardSync(boardId: string, delayMs = 2000) {
  if (!serverAdopted) return;
  pendingBoardId = boardId;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    const id = pendingBoardId;
    pendingBoardId = null;
    if (id) pushBoardToServer(id).catch(() => null);
  }, delayMs);
}

export function scheduleMayaChatSync(boardId: string, delayMs = 700) {
  if (!serverAdopted) return;
  pendingChatBoardIds.add(boardId);
  if (chatTimer) clearTimeout(chatTimer);
  chatTimer = setTimeout(() => {
    const ids = [...pendingChatBoardIds];
    pendingChatBoardIds.clear();
    for (const id of ids) pushMayaChatsToServer(id).catch(() => null);
  }, delayMs);
}

export function cancelBoardSync(boardId?: string) {
  if (!boardId || pendingBoardId === boardId) {
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = null;
    pendingBoardId = null;
  }
  if (boardId) pendingChatBoardIds.delete(boardId);
  else pendingChatBoardIds.clear();
  if (chatTimer && pendingChatBoardIds.size === 0) {
    clearTimeout(chatTimer);
    chatTimer = null;
  }
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
