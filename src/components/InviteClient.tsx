"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { Loader2, ShieldCheck } from "lucide-react";
import { CredentialsAuthForm } from "@/components/CredentialsAuthForm";
import { useBoardStore } from "@/lib/store";
import type { BoardSnapshot } from "@/lib/board-snapshot";

type InviteInfo = {
  token: string;
  boardId: string;
  boardTitle: string;
  createdByName: string;
  inviteeEmail: string | null;
  kind?: "board" | "team";
  teamId?: string | null;
  teamName?: string | null;
  valid: boolean;
  error: string | null;
  canRegister?: boolean;
};

type JoinPayload = {
  error?: string;
  boardId?: string;
  boardIds?: string[];
  teamId?: string | null;
  snapshots?: BoardSnapshot[];
  snapshot?: BoardSnapshot;
  profile?: { name: string; email: string; image?: string | null };
  username?: string;
};

export function InviteClient({ token }: { token: string }) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const mergeBoardSnapshot = useBoardStore((s) => s.mergeBoardSnapshot);
  const addBoardMemberFromProfile = useBoardStore((s) => s.addBoardMemberFromProfile);
  const setActiveBoard = useBoardStore((s) => s.setActiveBoard);

  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"register" | "login">("register");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/invite/${token}`);
        const data = (await res.json()) as InviteInfo & { error?: string };
        if (!res.ok) {
          if (!cancelled) setError(data.error || "Convite inválido.");
          return;
        }
        if (!cancelled) setInfo(data);
      } catch {
        if (!cancelled) setError("Falha ao carregar convite.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  function applyJoin(data: JoinPayload) {
    const snapshots = data.snapshots?.length
      ? data.snapshots
      : data.snapshot
        ? [data.snapshot]
        : [];
    const boardId = data.boardId;
    if (!boardId || snapshots.length === 0) return false;
    for (const snapshot of snapshots) {
      mergeBoardSnapshot(snapshot, { setActive: snapshot.board.id === boardId });
    }
    if (data.profile) {
      addBoardMemberFromProfile(boardId, data.profile, {
        teamId: data.teamId ?? info?.teamId,
        extraBoardIds: data.boardIds,
      });
    }
    setActiveBoard(boardId);
    return true;
  }

  async function accept() {
    setAccepting(true);
    setError(null);
    try {
      const res = await fetch(`/api/invite/${token}/accept`, { method: "POST" });
      const data = (await res.json()) as JoinPayload;
      if (!res.ok || !applyJoin(data) || !data.boardId) {
        setError(data.error || "Não foi possível aceitar o convite.");
        return;
      }

      const snapshot = useBoardStore.getState().exportBoardSnapshot(data.boardId);
      if (snapshot) {
        await fetch(`/api/boards/${data.boardId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ snapshot }),
        }).catch(() => null);
      }

      router.push(`/board/${data.boardId}`);
      router.refresh();
    } catch {
      setError("Erro de rede ao aceitar convite.");
    } finally {
      setAccepting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-[var(--muted)]">
        <Loader2 className="h-5 w-5 animate-spin" />
        Carregando convite…
      </div>
    );
  }

  if (error && !info) {
    return (
      <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
        {error}
        <div className="mt-3">
          <Link href="/" className="text-[var(--accent)] hover:underline">
            Voltar ao início
          </Link>
        </div>
      </div>
    );
  }

  if (!info) return null;

  const isTeam = info.kind === "team";
  const title = isTeam ? info.teamName || info.boardTitle : info.boardTitle;
  const heading = isTeam ? "Convite para a equipe" : "Convite para o board";

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent)]/15 text-[var(--accent)]">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-[var(--muted)]">{heading}</p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-2xl text-white">
            {title}
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Enviado por {info.createdByName}
            {info.inviteeEmail ? ` · destinado a ${info.inviteeEmail}` : ""}.
          </p>
        </div>
      </div>

      {!info.valid ? (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {info.error || "Convite inválido."}
        </p>
      ) : null}

      {error ? (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      ) : null}

      {info.valid && status === "authenticated" && session?.user ? (
        <div className="space-y-3">
          <p className="text-sm text-[var(--muted)]">
            Você está autenticado como{" "}
            <span className="text-white">{session.user.email}</span>. Aceite para entrar
            {isTeam ? " na equipe" : " no board"}.
          </p>
          <button
            type="button"
            disabled={accepting}
            onClick={() => void accept()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-[var(--accent-on)] transition hover:brightness-110 disabled:opacity-60"
          >
            {accepting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isTeam ? "Aceitar convite e entrar na equipe" : "Aceitar convite e abrir board"}
          </button>
        </div>
      ) : null}

      {info.valid && status !== "authenticated" ? (
        <div className="space-y-3">
          <div className="flex rounded-xl border border-[var(--line)] p-1 text-xs">
            <button
              type="button"
              onClick={() => setMode("register")}
              className={`flex-1 rounded-lg px-3 py-2 font-medium ${
                mode === "register"
                  ? "bg-[var(--accent)] text-[var(--accent-on)]"
                  : "text-[var(--muted)]"
              }`}
            >
              Criar conta
            </button>
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`flex-1 rounded-lg px-3 py-2 font-medium ${
                mode === "login"
                  ? "bg-[var(--accent)] text-[var(--accent-on)]"
                  : "text-[var(--muted)]"
              }`}
            >
              Já tenho conta
            </button>
          </div>

          {mode === "register" ? (
            <InviteRegisterForm
              token={token}
              defaultEmail={info.inviteeEmail || ""}
              lockedEmail={Boolean(info.inviteeEmail)}
              busy={accepting}
              onError={setError}
              onJoin={async (data, password) => {
                setAccepting(true);
                try {
                  if (!applyJoin(data) || !data.boardId) {
                    setError(data.error || "Cadastro criado, mas o convite não pôde ser aplicado.");
                    return;
                  }
                  const login = data.username || data.profile?.email || "";
                  const result = await signIn("credentials", {
                    email: login,
                    password,
                    redirect: false,
                    callbackUrl: `/board/${data.boardId}`,
                  });
                  if (result?.error) {
                    setError("Conta criada. Entre com o usuário e a senha para continuar.");
                    setMode("login");
                    return;
                  }
                  router.push(`/board/${data.boardId}`);
                  router.refresh();
                } finally {
                  setAccepting(false);
                }
              }}
            />
          ) : (
            <>
              <p className="text-sm text-[var(--muted)]">
                Entre com sua conta para aceitar o convite.
              </p>
              <CredentialsAuthForm
                callbackUrl={`/invite/${token}`}
                defaultEmail={info.inviteeEmail || ""}
              />
            </>
          )}
        </div>
      ) : null}

      {status === "loading" ? (
        <p className="text-sm text-[var(--muted)]">Verificando sessão…</p>
      ) : null}
    </div>
  );
}

function InviteRegisterForm({
  token,
  defaultEmail,
  lockedEmail,
  busy,
  onError,
  onJoin,
}: {
  token: string;
  defaultEmail: string;
  lockedEmail: boolean;
  busy: boolean;
  onError: (message: string | null) => void;
  onJoin: (data: JoinPayload, password: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    onError(null);
    if (password !== confirm) {
      onError("As senhas não coincidem.");
      return;
    }
    const res = await fetch(`/api/invite/${token}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        username,
        password,
        email: email.trim() || undefined,
      }),
    });
    const data = (await res.json()) as JoinPayload;
    if (!res.ok) {
      onError(data.error || "Não foi possível criar a conta.");
      return;
    }
    await onJoin(data, password);
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-3">
      <p className="text-sm text-[var(--muted)]">
        Crie um usuário para entrar. O cadastro aberto só vale com este convite.
      </p>
      <label className="block space-y-1.5 text-sm">
        <span className="text-[var(--muted)]">Nome</span>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          minLength={2}
          className="w-full rounded-xl border border-[var(--line)] bg-black/20 px-3 py-2.5 text-white outline-none ring-[var(--accent)] focus:ring-1"
          placeholder="Seu nome"
        />
      </label>
      <label className="block space-y-1.5 text-sm">
        <span className="text-[var(--muted)]">Usuário</span>
        <input
          required
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          minLength={2}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          className="w-full rounded-xl border border-[var(--line)] bg-black/20 px-3 py-2.5 text-white outline-none ring-[var(--accent)] focus:ring-1"
          placeholder="nome.sobrenome"
        />
      </label>
      {lockedEmail || defaultEmail ? (
        <label className="block space-y-1.5 text-sm">
          <span className="text-[var(--muted)]">E-mail</span>
          <input
            type="email"
            value={email}
            readOnly={lockedEmail}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-[var(--line)] bg-black/20 px-3 py-2.5 text-white outline-none ring-[var(--accent)] focus:ring-1 read-only:opacity-70"
          />
        </label>
      ) : null}
      <label className="block space-y-1.5 text-sm">
        <span className="text-[var(--muted)]">Senha</span>
        <input
          required
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          autoComplete="new-password"
          className="w-full rounded-xl border border-[var(--line)] bg-black/20 px-3 py-2.5 text-white outline-none ring-[var(--accent)] focus:ring-1"
          placeholder="Mínimo 8 caracteres"
        />
      </label>
      <label className="block space-y-1.5 text-sm">
        <span className="text-[var(--muted)]">Confirmar senha</span>
        <input
          required
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          minLength={8}
          autoComplete="new-password"
          className="w-full rounded-xl border border-[var(--line)] bg-black/20 px-3 py-2.5 text-white outline-none ring-[var(--accent)] focus:ring-1"
        />
      </label>
      <button
        type="submit"
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-110 disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Cadastrar e entrar
      </button>
    </form>
  );
}
