"use client";

import { useEffect, useState } from "react";
import { useBoardStore } from "@/lib/store";
import { BoardShell } from "@/components/BoardShell";

export function AppProviders({ children }: { children?: React.ReactNode }) {
  const hydrated = useBoardStore((s) => s.hydrated);
  const setHydrated = useBoardStore((s) => s.setHydrated);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // persist may already have rehydrated before mount
    if (useBoardStore.persist.hasHydrated()) {
      setHydrated(true);
      setReady(true);
      return;
    }
    const unsub = useBoardStore.persist.onFinishHydration(() => {
      setHydrated(true);
      setReady(true);
    });
    return unsub;
  }, [setHydrated]);

  if (!ready && !hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center text-[var(--muted)]">
        Carregando board…
      </div>
    );
  }

  return children ?? <BoardShell />;
}
