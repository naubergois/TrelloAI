"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Pencil, Save, Shield, UserPlus, X } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { AuthButton } from "@/components/AuthButton";
import type { PublicUser, UserRole } from "@/lib/users";

export function UsersAdmin() {
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("user");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<PublicUser | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users");
      const data = (await res.json()) as { users?: PublicUser[]; error?: string };
      if (!res.ok) {
        setError(data.error || "Não foi possível listar os usuários.");
        return;
      }
      setUsers(data.users ?? []);
    } catch {
      setError("Erro de rede ao listar usuários.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function resetForm() {
    setName("");
    setUsername("");
    setEmail("");
    setPassword("");
    setRole("user");
    setEditing(null);
  }

  function startEdit(user: PublicUser) {
    setEditing(user);
    setName(user.name);
    setUsername(user.username);
    setEmail(user.email);
    setPassword("");
    setRole(user.role);
    setError(null);
    requestAnimationFrame(() => {
      document.getElementById("user-admin-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = editing
        ? await fetch(`/api/admin/users/${encodeURIComponent(editing.id)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name,
              username,
              email,
              password: password || undefined,
              role,
            }),
          })
        : await fetch("/api/admin/users", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, username, email, password, role }),
          });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error || (editing ? "Não foi possível salvar o usuário." : "Não foi possível cadastrar o usuário."));
        return;
      }
      resetForm();
      await load();
    } catch {
      setError(editing ? "Erro de rede ao salvar." : "Erro de rede ao cadastrar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="app-bar shrink-0 border-b backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-4xl items-center gap-2 px-3 sm:h-16 sm:gap-3 sm:px-6">
          <div className="min-w-0 flex-1">
            <BrandMark size="sm" subtitle="Administração" />
          </div>
          <AuthButton />
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--muted)] transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar aos boards
        </Link>

        <div className="mt-4 flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent)]/15 text-[var(--accent)]">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-2xl text-white">
              Usuários
            </h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Qualquer administrador pode cadastrar, editar contas e conceder perfil de administrador.
            </p>
          </div>
        </div>

        <form
          id="user-admin-form"
          onSubmit={(e) => void onSubmit(e)}
          className="mt-6 grid gap-3 rounded-3xl border border-[var(--line)] bg-black/20 p-5 sm:grid-cols-2"
        >
          <div className="flex items-center justify-between gap-2 sm:col-span-2">
            <p className="text-sm font-semibold text-white">
              {editing ? `Editar ${editing.name}` : "Novo usuário"}
            </p>
            {editing ? (
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-[var(--muted)] transition hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
                Cancelar
              </button>
            ) : null}
          </div>
          <label className="space-y-1.5 text-sm sm:col-span-1">
            <span className="text-[var(--muted)]">Nome</span>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-[var(--line)] bg-black/25 px-3 py-2.5 text-white outline-none focus:border-[var(--accent)]"
              placeholder="Nome completo"
            />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="text-[var(--muted)]">Usuário</span>
            <input
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoCapitalize="none"
              spellCheck={false}
              className="w-full rounded-xl border border-[var(--line)] bg-black/25 px-3 py-2.5 text-white outline-none focus:border-[var(--accent)]"
              placeholder="admin"
            />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="text-[var(--muted)]">E-mail (opcional)</span>
            <input
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-[var(--line)] bg-black/25 px-3 py-2.5 text-white outline-none focus:border-[var(--accent)]"
              placeholder="pessoa@cge.ce.gov.br"
            />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="text-[var(--muted)]">
              {editing ? "Nova senha (opcional)" : "Senha inicial"}
            </span>
            <input
              required={!editing}
              type="password"
              minLength={editing && !password ? undefined : 8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-[var(--line)] bg-black/25 px-3 py-2.5 text-white outline-none focus:border-[var(--accent)]"
              placeholder={editing ? "Deixe em branco para manter" : "Mínimo 8 caracteres"}
            />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="text-[var(--muted)]">Perfil</span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value === "admin" ? "admin" : "user")}
              className="w-full rounded-xl border border-[var(--line)] bg-black/25 px-3 py-2.5 text-white outline-none focus:border-[var(--accent)]"
            >
              <option value="user">Usuário</option>
              <option value="admin">Administrador</option>
            </select>
          </label>
          {error ? (
            <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200 sm:col-span-2">
              {error}
            </p>
          ) : null}
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[var(--accent-on)] transition hover:brightness-110 disabled:opacity-60 sm:w-auto"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : editing ? (
                <Save className="h-4 w-4" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
              {editing ? "Salvar alterações" : "Cadastrar usuário"}
            </button>
          </div>
        </form>

        <section className="mt-8">
          <h2 className="text-sm font-semibold text-white">Contas cadastradas</h2>
          {loading ? (
            <p className="mt-3 flex items-center gap-2 text-sm text-[var(--muted)]">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando…
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-[var(--line)] overflow-hidden rounded-2xl border border-[var(--line)]">
              {users.map((u) => (
                <li
                  key={u.id}
                  className={`flex items-center justify-between gap-3 bg-black/20 px-4 py-3 ${
                    editing?.id === u.id ? "ring-1 ring-inset ring-[var(--accent)]" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-white">{u.name}</p>
                    <p className="truncate text-xs text-[var(--muted)]">
                      {u.username}
                      {u.email ? ` · ${u.email}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                        u.role === "admin"
                          ? "bg-[var(--accent)]/20 text-[var(--accent)]"
                          : "bg-white/10 text-[var(--muted)]"
                      }`}
                    >
                      {u.role === "admin" ? "Admin" : "Usuário"}
                    </span>
                    <button
                      type="button"
                      onClick={() => startEdit(u)}
                      className="inline-flex items-center gap-1 rounded-lg border border-[var(--line)] px-2 py-1.5 text-xs text-[var(--muted)] transition hover:text-white"
                      title="Editar usuário"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Editar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
