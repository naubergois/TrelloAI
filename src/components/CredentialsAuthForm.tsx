"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

type Mode = "login" | "register";

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
  const [mode, setMode] = useState<Mode>(inviteHint ? "register" : "login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === "register") {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password }),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
          setError(data.error || "Não foi possível criar a conta.");
          return;
        }
      }

      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl,
      });

      if (result?.error) {
        setError(
          mode === "register"
            ? "Conta criada, mas o login falhou. Tente entrar de novo."
            : "E-mail ou senha incorretos.",
        );
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
          Após criar a conta ou entrar, você volta a esta página para aceitar o convite do board.
        </p>
      ) : null}
      <div className="flex rounded-xl border border-[var(--line)] p-1 text-sm">
        <button
          type="button"
          onClick={() => {
            setMode("login");
            setError(null);
          }}
          className={`flex-1 rounded-lg px-3 py-2 transition ${
            mode === "login" ? "bg-white/10 text-white" : "text-[var(--muted)] hover:text-white"
          }`}
        >
          Entrar
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("register");
            setError(null);
          }}
          className={`flex-1 rounded-lg px-3 py-2 transition ${
            mode === "register" ? "bg-white/10 text-white" : "text-[var(--muted)] hover:text-white"
          }`}
        >
          Criar conta
        </button>
      </div>

      <form onSubmit={onSubmit} className="space-y-3">
        {mode === "register" ? (
          <label className="block space-y-1.5 text-sm">
            <span className="text-[var(--muted)]">Nome</span>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              className="w-full rounded-xl border border-[var(--line)] bg-black/20 px-3 py-2.5 text-white outline-none ring-[var(--accent)] focus:ring-1"
              placeholder="Seu nome"
            />
          </label>
        ) : null}

        <label className="block space-y-1.5 text-sm">
          <span className="text-[var(--muted)]">E-mail</span>
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className="w-full rounded-xl border border-[var(--line)] bg-black/20 px-3 py-2.5 text-white outline-none ring-[var(--accent)] focus:ring-1"
            placeholder="voce@empresa.com"
          />
        </label>

        <label className="block space-y-1.5 text-sm">
          <span className="text-[var(--muted)]">Senha</span>
          <input
            required
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "register" ? "new-password" : "current-password"}
            minLength={8}
            className="w-full rounded-xl border border-[var(--line)] bg-black/20 px-3 py-2.5 text-white outline-none ring-[var(--accent)] focus:ring-1"
            placeholder={mode === "register" ? "Mínimo 8 caracteres" : "••••••••"}
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
          {loading ? "Aguarde…" : mode === "register" ? "Criar conta e entrar" : "Entrar"}
        </button>
      </form>
    </div>
  );
}
