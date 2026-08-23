"use client";

import { useEffect, useState } from "react";
import { useBoardStore } from "@/lib/store";
import { AuthUserSync } from "@/components/AuthUserSync";
import { BoardSync } from "@/components/BoardSync";
import { ToastProvider } from "@/components/Toast";

export function AppProviders({ children }: { children: React.ReactNode }) {
  const hydrated = useBoardStore((s) => s.hydrated);
  const setHydrated = useBoardStore((s) => s.setHydrated);
  const [ready, setReady] = useState(false);

  useEffect(() => {
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
      <div className="flex min-h-dvh items-center justify-center text-[var(--muted)]">
        Carregando…
      </div>
    );
  }

  return (
    <ToastProvider>
      <AuthUserSync />
      <BoardSync />
      {children}
    </ToastProvider>
  );
}
