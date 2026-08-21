"use client";

import Link from "next/link";

export function AuthActions() {
  return (
    <Link
      href="/?local=1"
      className="flex w-full items-center justify-center rounded-xl border border-[var(--line)] px-4 py-3 text-sm text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-white"
    >
      Entrar em modo local (sem conta)
    </Link>
  );
}
