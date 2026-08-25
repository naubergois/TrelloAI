"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export function CredentialsAuthForm({
  callbackUrl = "/",
  defaultEmail = "",
  inviteHint = false,
}: {
  callbackUrl?: string;
  defaultEmail?: string;
  inviteHint?: boolean;
}) {
  const router = useRouter();
  const [login, setLogin] = useState(defaultEmail);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email: login,
        password,
        redirect: false,
        callbackUrl,
      });

      if (result?.error) {
        setError("Usuário ou senha incorretos.");
        return;
      }

      router.push(result?.url || callbackUrl);
      router.refresh();
    } catch {
      setError("Erro de rede. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {inviteHint ? (
        <p className="rounded-xl border border-[var(--accent)]/25 bg-[var(--accent)]/10 px-3 py-2 text-xs text-[var(--accent)]">
          Entre com o usuário cadastrado pelo administrador para aceitar o convite.
        </p>
      ) : null}

      <form onSubmit={onSubmit} className="space-y-3">
        <label className="block space-y-1.5 text-sm">
          <span className="text-[var(--muted)]">Usuário</span>
          <input
            required
            type="text"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            className="w-full rounded-xl border border-[var(--line)] bg-black/20 px-3 py-2.5 text-white outline-none ring-[var(--accent)] focus:ring-1"
            placeholder="admin"
          />
        </label>

        <label className="block space-y-1.5 text-sm">
          <span className="text-[var(--muted)]">Senha</span>
          <input
            required
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            minLength={8}
            className="w-full rounded-xl border border-[var(--line)] bg-black/20 px-3 py-2.5 text-white outline-none ring-[var(--accent)] focus:ring-1"
            placeholder="••••••••"
          />
        </label>

        {error ? (
          <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-110 disabled:opacity-60"
        >
          {loading ? "Aguarde…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}
