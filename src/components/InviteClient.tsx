"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Loader2, ShieldCheck } from "lucide-react";
import { CredentialsAuthForm } from "@/components/CredentialsAuthForm";
import { useBoardStore } from "@/lib/store";

type InviteInfo = {
  token: string;
  boardId: string;
  boardTitle: string;
  createdByName: string;
  inviteeEmail: string | null;
  valid: boolean;
  error: string | null;
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

  async function accept() {
    setAccepting(true);
    setError(null);
    try {
      const res = await fetch(`/api/invite/${token}/accept`, { method: "POST" });
      const data = (await res.json()) as {
        error?: string;
        boardId?: string;
        snapshot?: Parameters<typeof mergeBoardSnapshot>[0];
        profile?: { name: string; email: string; image?: string | null };
      };
      if (!res.ok || !data.snapshot || !data.boardId) {
        setError(data.error || "Não foi possível aceitar o convite.");
        return;
      }
      mergeBoardSnapshot(data.snapshot, { setActive: true });
      if (data.profile) {
        addBoardMemberFromProfile(data.boardId, data.profile);
      }
      setActiveBoard(data.boardId);

      // push membership back with the new member included
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

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent)]/15 text-[var(--accent)]">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Convite para o board</p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-2xl text-white">
            {info.boardTitle}
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
            <span className="text-white">{session.user.email}</span>. Aceite para entrar no board.
          </p>
          <button
            type="button"
            disabled={accepting}
            onClick={() => void accept()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-teal-950 transition hover:brightness-110 disabled:opacity-60"
          >
            {accepting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Aceitar convite e abrir board
          </button>
        </div>
      ) : null}

      {info.valid && status !== "authenticated" ? (
        <div className="space-y-3">
          <p className="text-sm text-[var(--muted)]">
            Crie uma conta ou entre para aceitar o convite automaticamente.
          </p>
          <CredentialsAuthForm
            callbackUrl={`/invite/${token}`}
            defaultEmail={info.inviteeEmail || ""}
            inviteHint
          />
        </div>
      ) : null}

      {status === "loading" ? (
        <p className="text-sm text-[var(--muted)]">Verificando sessão…</p>
      ) : null}
    </div>
  );
}
