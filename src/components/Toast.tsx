"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { CheckCircle2, X } from "lucide-react";

type ToastItem = {
  id: string;
  message: string;
};

type ToastContextValue = {
  toast: (message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const toast = useCallback((message: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setItems((prev) => [...prev.slice(-3), { id, message }]);
  }, []);

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    if (items.length === 0) return;
    const timers = items.map((item) =>
      window.setTimeout(() => dismiss(item.id), 3200),
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [items, dismiss]);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[300] flex flex-col items-center gap-2 px-4">
        {items.map((item) => (
          <div
            key={item.id}
            className="anim-sheet pointer-events-auto flex max-w-md items-center gap-2 rounded-2xl border border-[var(--line)] bg-[var(--panel-strong)] px-4 py-3 text-sm text-white shadow-[0_16px_40px_rgba(0,0,0,0.4)]"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--accent)]" />
            <p className="min-w-0 flex-1">{item.message}</p>
            <button
              type="button"
              className="rounded-lg p-1 text-[var(--muted)] hover:text-white"
              onClick={() => dismiss(item.id)}
              aria-label="Fechar"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      toast: (_message: string) => {
        /* no-op outside provider */
      },
    };
  }
  return ctx;
}
