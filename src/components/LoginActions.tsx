"use client";

import Link from "next/link";

export function AuthActions({ googleConfigured }: { googleConfigured: boolean }) {
  return (
    <div className="space-y-2">
      {googleConfigured ? (
        <p className="text-center text-xs text-[var(--muted)]">
          Você será redirecionado ao Google para autorizar o TrelloAI.
        </p>
      ) : null}
      <Link
        href="/?local=1"
        className="flex w-full items-center justify-center rounded-xl border border-[var(--line)] px-4 py-3 text-sm text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-white"
      >
        {googleConfigured
          ? "Entrar em modo local (sem Google)"
          : "Continuar em modo local (sem Google)"}
      </Link>
    </div>
  );
}
