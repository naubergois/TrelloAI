"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Loader2, LogIn, Sparkles } from "lucide-react";
import { useBoardStore } from "@/lib/store";
import type { BoardSnapshot } from "@/lib/board-snapshot";

export function InviteAcceptClient({ token }: { token: string }) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const mergeBoardSnapshot = useBoardStore((s) => s.mergeBoardSnapshot);
  const addBoardMemberFromProfile = useBoardStore((s) => s.addBoardMemberFromProfile);
  const setActiveBoard = useBoardStore((s) => s.setActiveBoard);

  const [meta, setMeta] = useState<{
    boardTitle: string;
    createdByName: string;
    valid: boolean;
    error: string | null;
    inviteeEmail: string | null;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetch(`/api/invite/${token}`);
      const data = (await res.json()) as {
        boardTitle?: string;
        createdByName?: string;
        valid?: boolean;
        error?: string;
        inviteeEmail?: string | null;
      };
      if (cancelled) return;
      if (!res.ok) {
        setMeta({
          boardTitle: "Convite",
          createdByName: "",
          valid: false,
          error: data.error || "Convite inválido",
          inviteeEmail: null,
        });
        return;
      }
      setMeta({
        boardTitle: data.boardTitle || "Board",
        createdByName: data.createdByName || "Alguém",
        valid: Boolean(data.valid),
        error: data.error || null,
        inviteeEmail: data.inviteeEmail ?? null,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const accept = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/invite/${token}/accept`, { method: "POST" });
      const data = (await res.json()) as {
        error?: string;
        boardId?: string;
        snapshot?: BoardSnapshot;
        profile?: { name: string; email: string; image?: string | null };
      };
      if (!res.ok || !data.snapshot || !data.boardId || !data.profile) {
        setErr(data.error || "Não foi possível aceitar o convite.");
        return;
      }
      mergeBoardSnapshot(data.snapshot, { setActive: true });
      addBoardMemberFromProfile(data.boardId, data.profile);
      setActiveBoard(data.boardId);

      // push membership-enriched snapshot back
      const next = useBoardStore.getState().exportBoardSnapshot(data.boardId);
      if (next) {
        void fetch(`/api/boards/${data.boardId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ snapshot: next }),
        });
      }

      router.push(`/board/${data.boardId}`);
      router.refresh();
    } catch {
      setErr("Erro de rede.");
    } finally {
      setBusy(false);
    }
  };

  if (!meta) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-[var(--muted)]">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <main className="relative flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-16 top-16 h-72 w-72 rounded-full bg-[var(--accent)]/20 blur-3xl" />
        <div className="absolute -right-10 bottom-10 h-80 w-80 rounded-full bg-sky-500/15 blur-3xl" />
      </div>

      <section className="relative w-full max-w-md rounded-3xl border border-[var(--line)] bg-[var(--panel-strong)] p-8 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
        <p className="inline-flex items-center gap-2 text-[var(--accent)]">
          <Sparkles className="h-4 w-4" />
          <span className="text-xs font-semibold uppercase tracking-wide">Convite TrelloAI</span>
        </p>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-2xl text-white">
          {meta.boardTitle}
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          {meta.createdByName
            ? `${meta.createdByName} convidou você para colaborar neste board.`
            : "Você foi convidado para colaborar neste board."}
        </p>

        {!meta.valid ? (
          <p className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {meta.error || "Convite inválido."}
          </p>
        ) : null}

        {err ? (
          <p className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {err}
          </p>
        ) : null}

        <div className="mt-6 space-y-3">
          {status === "authenticated" && meta.valid ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void accept()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-[var(--accent-on)] transition hover:brightness-110 disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Entrar no board
            </button>
          ) : meta.valid ? (
            <>
              <Link
                href={`/login?callbackUrl=${encodeURIComponent(`/invite/${token}`)}&invite=${token}`}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-[var(--accent-on)] transition hover:brightness-110"
              >
                <LogIn className="h-4 w-4" />
                Criar conta ou entrar
              </Link>
              {meta.inviteeEmail ? (
                <p className="text-center text-[11px] text-[var(--muted)]">
                  Use o e-mail <span className="text-white">{meta.inviteeEmail}</span>
                </p>
              ) : null}
            </>
          ) : (
            <Link
              href="/"
              className="flex w-full items-center justify-center rounded-xl border border-[var(--line)] px-4 py-3 text-sm text-[var(--muted)]"
            >
              Voltar ao início
            </Link>
          )}
        </div>

        {status === "authenticated" && session?.user?.email ? (
          <p className="mt-4 text-center text-[11px] text-[var(--muted)]">
            Conectado como {session.user.email}
          </p>
        ) : null}
      </section>
    </main>
  );
}
