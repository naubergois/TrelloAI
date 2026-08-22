"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Loader2, Sparkles, X } from "lucide-react";
import { nanoid } from "nanoid";
import type { AiMessage, AiAction } from "@/lib/types";
import { useBoardStore } from "@/lib/store";
import type { AiResponse } from "@/lib/ai";

const QUICK = [
  "Gere cards para lançar o MVP em 2 semanas",
  "Sugira prioridades nos cards sem classificação",
  "Quebre em tarefas: onboarding de times no board",
];

export function AiPanel({
  boardId,
  onClose,
}: {
  boardId: string;
  onClose: () => void;
}) {
  const board = useBoardStore((s) => s.boards[boardId]);
  const lists = useBoardStore((s) => s.lists);
  const cards = useBoardStore((s) => s.cards);
  const addCardsBulk = useBoardStore((s) => s.addCardsBulk);
  const applyPriorityUpdates = useBoardStore((s) => s.applyPriorityUpdates);

  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<AiMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Olá — sou o assistente do board. Peça para gerar cards a partir de um briefing ou sugerir prioridades. Uso DeepSeek quando DEEPSEEK_API_KEY estiver configurada; senão, o motor local.",
      createdAt: new Date().toISOString(),
    },
  ]);

  const context = useMemo(() => {
    if (!board) return { boardTitle: "Board", lists: [] };
    return {
      boardTitle: board.title,
      lists: board.listIds
        .map((id) => lists[id])
        .filter(Boolean)
        .map((list) => ({
          id: list.id,
          title: list.title,
          cards: list.cardIds
            .map((cid) => cards[cid])
            .filter(Boolean)
            .map((c) => ({ id: c.id, title: c.title, priority: c.priority })),
        })),
    };
  }, [board, lists, cards]);

  const applyAction = (action: AiAction) => {
    if (action.type === "create_cards") {
      const listId = action.listId || board?.listIds[0];
      if (!listId) return;
      addCardsBulk(listId, action.cards);
    }
    if (action.type === "suggest_priorities") {
      applyPriorityUpdates(action.updates);
    }
  };

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: AiMessage = {
      id: nanoid(),
      role: "user",
      content: trimmed,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setPrompt("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: trimmed, context }),
      });
      const data = (await res.json()) as AiResponse & { error?: string };
      if (!res.ok) throw new Error(data.error || "Falha na IA");

      applyAction(data.action);
      setMessages((prev) => [
        ...prev,
        {
          id: nanoid(),
          role: "assistant",
          content: `${data.message}\n\n_provider: ${data.provider}_`,
          createdAt: new Date().toISOString(),
        },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: nanoid(),
          role: "assistant",
          content:
            error instanceof Error
              ? `Não consegui responder: ${error.message}`
              : "Não consegui responder.",
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void send(prompt);
  };

  if (!board) return null;

  return (
    <aside className="anim-rise flex h-full min-h-0 w-full flex-col overflow-hidden rounded-t-3xl border border-[var(--line)] bg-[var(--panel-strong)] sm:rounded-2xl">
      <header className="flex shrink-0 items-center justify-between border-b border-[var(--line)] px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[var(--accent)]" />
          <div>
            <p className="text-sm font-semibold text-white">Assistente</p>
            <p className="text-xs text-[var(--muted)]">Gera cards e prioridades</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-[var(--muted)] hover:bg-white/5 hover:text-white"
          aria-label="Fechar painel"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="board-scroll min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${
              msg.role === "user"
                ? "ml-6 bg-[var(--accent)]/15 text-teal-50"
                : "mr-4 bg-white/5 text-[var(--text)]"
            }`}
          >
            {msg.content}
          </div>
        ))}
        {loading ? (
          <div className="inline-flex items-center gap-2 text-xs text-[var(--muted)]">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Pensando…
          </div>
        ) : null}
      </div>

      <div className="space-y-2 border-t border-[var(--line)] p-3">
        <div className="flex flex-wrap gap-1.5">
          {QUICK.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => void send(q)}
              className="rounded-full border border-[var(--line)] px-2.5 py-1 text-[11px] text-[var(--muted)] transition hover:border-[var(--accent)]/50 hover:text-white"
            >
              {q}
            </button>
          ))}
        </div>
        <form onSubmit={onSubmit} className="flex gap-2">
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Peça à IA…"
            className="w-full rounded-lg border border-[var(--line)] bg-[var(--ink)] px-3 py-2 text-sm outline-none placeholder:text-[var(--muted)] focus:border-[var(--accent)]"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-medium text-[var(--accent-on)] disabled:opacity-60"
          >
            Enviar
          </button>
        </form>
      </div>
    </aside>
  );
}
