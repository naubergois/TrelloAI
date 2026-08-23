"use client";

import { useMemo, useState, useEffect, type FormEvent } from "react";
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

function chatKey(boardId: string) {
  return `trelloai-ai-chat-${boardId}`;
}

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
  const members = useBoardStore((s) => s.members);
  const requirements = useBoardStore((s) => s.requirements);
  const applyManagerActions = useBoardStore((s) => s.applyManagerActions);

  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<AiMessage[]>(() => {
    if (typeof window === "undefined") {
      return [
        {
          id: "welcome",
          role: "assistant",
          content:
            "Olá — sou o assistente do board. Peça cards, prioridades, listas ou atribuições.",
          createdAt: new Date().toISOString(),
        },
      ];
    }
    try {
      const raw = localStorage.getItem(chatKey(boardId));
      if (raw) return JSON.parse(raw) as AiMessage[];
    } catch {
      /* ignore */
    }
    return [
      {
        id: "welcome",
        role: "assistant",
        content:
          "Olá — sou o assistente do board. Peça cards, prioridades, listas ou atribuições.",
        createdAt: new Date().toISOString(),
      },
    ];
  });

  useEffect(() => {
    try {
      localStorage.setItem(chatKey(boardId), JSON.stringify(messages.slice(-40)));
    } catch {
      /* ignore quota */
    }
  }, [messages, boardId]);

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
            .filter((c) => !c.archived)
            .map((c) => ({
              id: c.id,
              title: c.title,
              description: c.description,
              priority: c.priority,
              assigneeId: c.assigneeId,
              dueDate: c.dueDate,
            })),
        })),
    };
  }, [board, lists, cards]);

  const reqSummary = useMemo(() => {
    return Object.values(requirements || {})
      .filter((r) => r.boardId === boardId)
      .slice(0, 12)
      .map((r) => `${r.code}: ${r.title} (${r.status})`);
  }, [requirements, boardId]);

  const applyAction = (action: AiAction) => {
    if (action.type === "none") return;
    applyManagerActions([action], boardId);
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

    const enrichedPrompt =
      reqSummary.length > 0
        ? `${trimmed}\n\nRequisitos do board:\n${reqSummary.join("\n")}`
        : trimmed;

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: enrichedPrompt, context }),
      });
      const data = (await res.json()) as AiResponse & { error?: string };
      if (!res.ok) throw new Error(data.error || "Falha na IA");

      applyAction(data.action);
      setMessages((prev) => [
        ...prev,
        {
          id: nanoid(),
          role: "assistant",
          content: data.message,
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
    send(prompt);
  };

  return (
    <aside className="anim-rise panel-glass flex h-full min-h-0 w-full flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--line)] px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-[var(--accent)]" />
          <h2 className="font-[family-name:var(--font-display)] text-lg text-white">
            Assistente IA
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-[var(--line)] p-2 text-[var(--muted)] hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="board-scroll min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`chat-bubble rounded-2xl px-3 py-2 text-sm leading-relaxed ${
              m.role === "user"
                ? "ml-6 bg-[var(--accent)]/20 text-white"
                : "mr-6 bg-black/25 text-[var(--text)]"
            }`}
          >
            {m.content}
          </div>
        ))}
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Pensando…
          </div>
        ) : null}
      </div>

      <div className="shrink-0 space-y-2 border-t border-[var(--line)] p-3">
        <div className="flex flex-wrap gap-1.5">
          {QUICK.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => send(q)}
              className="rounded-lg border border-[var(--line)] px-2 py-1 text-[11px] text-[var(--muted)] hover:text-white"
            >
              {q}
            </button>
          ))}
        </div>
        <form onSubmit={onSubmit} className="flex gap-2">
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Peça ao assistente…"
            className="min-w-0 flex-1 rounded-xl border border-[var(--line)] bg-[var(--ink)] px-3 py-2 text-sm text-white outline-none focus:border-[var(--accent)]"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-[var(--accent-on)] disabled:opacity-50"
          >
            Enviar
          </button>
        </form>
      </div>
    </aside>
  );
}
