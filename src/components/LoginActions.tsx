"use client";

import Link from "next/link";

export function AuthActions({ googleConfigured }: { googleConfigured: boolean }) {
  if (googleConfigured) {
    return (
      <p className="text-center text-xs text-[var(--muted)]">
        Você será redirecionado ao Google para autorizar o TrelloAI.
      </p>
    );
  }

  return (
    <Link
      href="/"
      className="flex w-full items-center justify-center rounded-xl border border-[var(--line)] px-4 py-3 text-sm text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-white"
    >
      Continuar em modo local (sem Google)
    </Link>
  );
}
