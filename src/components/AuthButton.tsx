"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import { LogIn, LogOut } from "lucide-react";

export function AuthButton({ googleConfigured }: { googleConfigured: boolean }) {
  const { data: session, status } = useSession();

  if (!googleConfigured) {
    return (
      <span className="hidden text-[11px] text-[var(--muted)] lg:inline">
        Configure Google OAuth no .env.local
      </span>
    );
  }

  if (status === "loading") {
    return <span className="text-xs text-[var(--muted)]">…</span>;
  }

  if (session?.user) {
    return (
      <div className="flex items-center gap-2">
        {session.user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={session.user.image}
            alt=""
            className="h-8 w-8 rounded-full ring-1 ring-[var(--line)]"
            referrerPolicy="no-referrer"
          />
        ) : null}
        <span className="hidden max-w-[120px] truncate text-xs text-[var(--muted)] sm:inline">
          {session.user.name || session.user.email}
        </span>
        <button
          type="button"
          onClick={() => void signOut({ callbackUrl: "/login" })}
          className="inline-flex items-center gap-1 rounded-lg border border-[var(--line)] px-2.5 py-2 text-xs text-[var(--muted)] transition hover:text-white"
          title="Sair"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sair
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void signIn("google", { callbackUrl: "/" })}
      className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-xs font-semibold text-slate-900 transition hover:brightness-95"
    >
      <LogIn className="h-3.5 w-3.5" />
      Google
    </button>
  );
}
