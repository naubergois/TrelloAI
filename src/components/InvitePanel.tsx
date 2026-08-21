"use client";

import { useState } from "react";
import { Check, Copy, Link2, Loader2, Mail, UserPlus } from "lucide-react";
import { useBoardStore } from "@/lib/store";

export function InvitePanel({
  boardId,
  onClose,
}: {
  boardId: string;
  onClose?: () => void;
}) {
  const board = useBoardStore((s) => s.boards[boardId]);
  const exportBoardSnapshot = useBoardStore((s) => s.exportBoardSnapshot);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!board) return null;

  async function createInvite() {
    setLoading(true);
    setError(null);
    setCopied(false);
    try {
      const snapshot = exportBoardSnapshot(boardId);
      if (!snapshot) {
        setError("Não foi possível exportar o board.");
        return;
      }

      const res = await fetch(`/api/boards/${boardId}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          snapshot,
          boardTitle: board.title,
          inviteeEmail: email.trim() || null,
        }),
      });
      const data = (await res.json()) as { error?: string; urlPath?: string };
      if (!res.ok) {
        setError(data.error || "Falha ao criar convite.");
        return;
      }
      const url = `${window.location.origin}${data.urlPath}`;
      setInviteUrl(url);

      // keep shared copy updated
      await fetch(`/api/boards/${boardId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshot }),
      }).catch(() => null);
    } catch {
      setError("Erro de rede ao criar convite.");
    } finally {
      setLoading(false);
    }
  }

  async function copyLink() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
    } catch {
      setError("Não foi possível copiar. Copie o link manualmente.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent)]/15 text-[var(--accent)]">
          <UserPlus className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-[family-name:var(--font-display)] text-lg text-white">
            Convidar para o board
          </h3>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Gere um link para a pessoa se cadastrar (ou entrar) e entrar em{" "}
            <span className="text-white">{board.title}</span>.
          </p>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-[var(--muted)] hover:text-white"
          >
            Fechar
          </button>
        ) : null}
      </div>

      <label className="block space-y-1.5 text-sm">
        <span className="inline-flex items-center gap-1.5 text-[var(--muted)]">
          <Mail className="h-3.5 w-3.5" />
          E-mail do convidado (opcional)
        </span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="colega@cge.gov.br"
          className="w-full rounded-xl border border-[var(--line)] bg-black/20 px-3 py-2.5 text-white outline-none ring-[var(--accent)] focus:ring-1"
        />
        <span className="text-[11px] text-[var(--muted)]">
          Se informar o e-mail, só essa pessoa poderá aceitar o convite.
        </span>
      </label>

      {error ? (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        disabled={loading}
        onClick={() => void createInvite()}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-teal-950 transition hover:brightness-110 disabled:opacity-60"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
        Gerar link de convite
      </button>

      {inviteUrl ? (
        <div className="space-y-2 rounded-xl border border-[var(--line)] bg-black/25 p-3">
          <p className="text-xs font-medium text-white">Link gerado</p>
          <code className="block break-all rounded-lg bg-black/30 px-2 py-2 text-[11px] text-[var(--accent)]">
            {inviteUrl}
          </code>
          <button
            type="button"
            onClick={() => void copyLink()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--line)] px-3 py-2 text-sm text-white transition hover:border-[var(--accent)]"
          >
            {copied ? <Check className="h-4 w-4 text-[var(--accent)]" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copiado!" : "Copiar link"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
