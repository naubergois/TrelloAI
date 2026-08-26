"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { LogIn, LogOut, Users } from "lucide-react";

export function AuthButton() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <span className="text-xs text-[var(--muted)]">…</span>;
  }

  if (session?.user) {
    return (
      <div className="flex items-center gap-2">
        {session.user.role === "admin" ? (
          <Link
            href="/admin/usuarios"
            className="inline-flex items-center gap-1 rounded-lg border border-[var(--line)] px-2.5 py-2 text-xs text-[var(--muted)] transition hover:text-white"
            title="Cadastrar usuários"
          >
            <Users className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Usuários</span>
          </Link>
        ) : null}
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white ring-1 ring-[var(--line)]">
          {(session.user.name || session.user.email || "?").slice(0, 1).toUpperCase()}
        </span>
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
    <Link
      href="/login"
      className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-xs font-semibold text-slate-900 transition hover:brightness-95"
      title="Entrar com usuário e senha"
    >
      <LogIn className="h-3.5 w-3.5" />
      Entrar
    </Link>
  );
}
