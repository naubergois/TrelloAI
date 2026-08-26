import { shouldRefreshClone } from "@/lib/git-clone";
import { listAllSharedBoards } from "@/lib/shared-boards";
import { runMayaGitJob } from "@/lib/maya-git-job";

const HOUR_MS = 60 * 60 * 1000;

function weeklyEnabled() {
  if (process.env.MAYA_GIT_WEEKLY === "0") return false;
  if (process.env.MAYA_GIT_WEEKLY === "1") return true;
  return process.env.NODE_ENV === "production";
}

async function tick() {
  if (!weeklyEnabled()) return;
  try {
    const boards = await listAllSharedBoards();
    const due = boards.some((snap) =>
      shouldRefreshClone(
        snap.board.riskReport?.clonedAt || snap.board.riskReport?.analyzedAt,
      ),
    );
    if (due) await runMayaGitJob({ forceClone: false });
  } catch (err) {
    console.error("[maya-git] weekly job failed", err instanceof Error ? err.message : err);
  }
}

export function startMayaGitScheduler() {
  if (!weeklyEnabled()) return;
  setTimeout(() => {
    void tick();
  }, 45_000);
  setInterval(() => {
    void tick();
  }, HOUR_MS);
}
