"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { GripHorizontal, Minus, X } from "lucide-react";
import { nanoid } from "nanoid";
import { useBoardStore } from "@/lib/store";
import { calendarDayKey } from "@/lib/calendar-report";
import { JangadaBuddy } from "@/components/JangadaBuddy";
import {
  runBoardToolCalls,
  type AiToolChatResponse,
  type AiToolContext,
  type ToolExecResult,
} from "@/lib/ai-tools";

const QUICK = [
  "Crie 4 cards para o próximo piloto",
  "Agende a daily amanhã às 09:00",
  "Crie as tarefas e marque a review sexta 14h",
];

type ChatLine = {
  id: string;
  role: "user" | "assistant";
  content: string;
  tools?: ToolExecResult[];
};

type DialogPos = { x: number; y: number; w: number; h: number };

const POS_KEY = "jangada-ai-dialog-pos";
const MIN_W = 320;
const MIN_H = 380;
const DEFAULT_W = 380;
const DEFAULT_H = 520;

function chatKey(boardId: string) {
  return `jangada-ai-tools-chat-${boardId}`;
}

function defaultPos(): DialogPos {
  if (typeof window === "undefined") return { x: 24, y: 24, w: DEFAULT_W, h: DEFAULT_H };
  return {
    x: Math.max(12, window.innerWidth - DEFAULT_W - 24),
    y: Math.max(12, window.innerHeight - DEFAULT_H - 24),
    w: DEFAULT_W,
    h: DEFAULT_H,
  };
}

function loadPos(): DialogPos {
  try {
    const raw = localStorage.getItem(POS_KEY);
    if (!raw) return defaultPos();
    const parsed = JSON.parse(raw) as Partial<DialogPos>;
    const base = defaultPos();
    return {
      x: typeof parsed.x === "number" ? parsed.x : base.x,
      y: typeof parsed.y === "number" ? parsed.y : base.y,
      w: typeof parsed.w === "number" ? parsed.w : base.w,
      h: typeof parsed.h === "number" ? parsed.h : base.h,
    };
  } catch {
    return defaultPos();
  }
}

function clampPos(pos: DialogPos): DialogPos {
  if (typeof window === "undefined") return pos;
  const w = Math.min(Math.max(pos.w, MIN_W), window.innerWidth - 16);
  const h = Math.min(Math.max(pos.h, MIN_H), window.innerHeight - 16);
  return {
    w,
    h,
    x: Math.min(Math.max(8, pos.x), Math.max(8, window.innerWidth - w - 8)),
    y: Math.min(Math.max(8, pos.y), Math.max(8, window.innerHeight - h - 8)),
  };
}

export function AiChatDialog({
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
  const calendarEvents = useBoardStore((s) => s.calendarEvents);
  const addCard = useBoardStore((s) => s.addCard);
  const addList = useBoardStore((s) => s.addList);
  const createCalendarEvent = useBoardStore((s) => s.createCalendarEvent);
  const updateCalendarEvent = useBoardStore((s) => s.updateCalendarEvent);

  const [mounted, setMounted] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [pos, setPos] = useState<DialogPos>(defaultPos);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatLine[]>(() => {
    if (typeof window === "undefined") return welcome();
    try {
      const raw = localStorage.getItem(chatKey(boardId));
      if (raw) return JSON.parse(raw) as ChatLine[];
    } catch {
      /* ignore */
    }
    return welcome();
  });

  const dragRef = useRef<{
    mode: "move" | "resize";
    dx: number;
    dy: number;
    start: DialogPos;
  } | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMounted(true);
    setPos(clampPos(loadPos()));
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(POS_KEY, JSON.stringify(pos));
    } catch {
      /* ignore */
    }
  }, [pos]);

  useEffect(() => {
    try {
      localStorage.setItem(chatKey(boardId), JSON.stringify(messages.slice(-40)));
    } catch {
      /* ignore */
    }
  }, [messages, boardId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const context = useMemo((): AiToolContext | null => {
    if (!board) return null;
    return {
      boardId: board.id,
      boardTitle: board.title,
      today: calendarDayKey(),
      lists: board.listIds
        .map((id) => lists[id])
        .filter(Boolean)
        .map((list) => ({
          id: list.id,
          title: list.title,
          systemKey: list.systemKey,
          cards: list.cardIds
            .map((cid) => cards[cid])
            .filter(Boolean)
            .filter((c) => !c.archived)
            .map((c) => ({
              id: c.id,
              title: c.title,
              priority: c.priority,
              assigneeId: c.assigneeId,
              dueDate: c.dueDate,
            })),
        })),
      members: (board.memberIds ?? []).map((id) => members[id]).filter(Boolean).map((m) => ({
        id: m.id,
        name: m.name,
      })),
      events: Object.values(calendarEvents || {})
        .filter((e) => e.boardId === boardId)
        .sort((a, b) => `${a.date}${a.time || ""}`.localeCompare(`${b.date}${b.time || ""}`))
        .slice(0, 24)
        .map((e) => ({
          id: e.id,
          title: e.title,
          date: e.date,
          time: e.time,
          kind: e.kind,
          meetingUrl: e.meetingUrl,
        })),
    };
  }, [board, lists, cards, members, calendarEvents, boardId]);

  const onPointerMove = (e: PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.mode === "move") {
      setPos((cur) =>
        clampPos({
          ...cur,
          x: e.clientX - drag.dx,
          y: e.clientY - drag.dy,
        }),
      );
      return;
    }
    setPos((cur) =>
      clampPos({
        ...cur,
        w: drag.start.w + (e.clientX - drag.dx),
        h: drag.start.h + (e.clientY - drag.dy),
      }),
    );
  };

  const stopDrag = () => {
    dragRef.current = null;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", stopDrag);
  };

  const startDrag = (mode: "move" | "resize", e: ReactPointerEvent) => {
    e.preventDefault();
    dragRef.current = {
      mode,
      dx: mode === "move" ? e.clientX - pos.x : e.clientX,
      dy: mode === "move" ? e.clientY - pos.y : e.clientY,
      start: pos,
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", stopDrag);
  };

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading || !context) return;
    const userLine: ChatLine = {
      id: nanoid(),
      role: "user",
      content: trimmed,
    };
    setMessages((prev) => [...prev, userLine]);
    setPrompt("");
    setLoading(true);

    try {
      const history = messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .slice(-8)
        .map((m) => ({ role: m.role, content: m.content }));
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: trimmed, messages: history, context }),
      });
      const data = (await res.json()) as AiToolChatResponse & { error?: string };
      if (!res.ok) throw new Error(data.error || "Falha na IA");

      const tools = data.toolCalls?.length
        ? runBoardToolCalls(data.toolCalls, context, {
            addList,
            addCard,
            createCalendarEvent,
            updateCalendarEvent,
          })
        : [];

      setMessages((prev) => [
        ...prev,
        {
          id: nanoid(),
          role: "assistant",
          content: data.message,
          tools,
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

  if (!mounted) return null;

  return createPortal(
    minimized ? (
      <button
        type="button"
        onClick={() => setMinimized(false)}
        className="fixed z-[170] inline-flex items-center gap-2 rounded-full border border-white/20 bg-[#0e2416]/95 py-1.5 pl-1.5 pr-3 text-sm text-white shadow-xl backdrop-blur"
        style={{ left: pos.x, top: pos.y }}
      >
        <JangadaBuddy size="sm" mood="happy" />
        Jangadinha
      </button>
    ) : (
      <div
        role="dialog"
        aria-label="Chat da Jangadinha"
        className="fixed z-[170] flex flex-col overflow-hidden rounded-2xl border border-white/18 bg-[#102818]/96 shadow-[0_18px_50px_rgba(0,0,0,0.45)] backdrop-blur-md"
        style={{
          left: pos.x,
          top: pos.y,
          width: pos.w,
          height: pos.h,
        }}
      >
        <header
          className="flex shrink-0 cursor-grab items-center gap-2 border-b border-white/12 bg-black/25 px-3 py-2 active:cursor-grabbing"
          onPointerDown={(e) => startDrag("move", e)}
        >
          <GripHorizontal className="h-4 w-4 text-white/45" />
          <JangadaBuddy size="md" mood={loading ? "thinking" : "idle"} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">Jangadinha</p>
            <p className="truncate text-[10px] text-white/55">
              Sua jangada de auxílio · {board?.title || "board"}
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg p-1.5 text-white/60 hover:bg-white/10 hover:text-white"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setMinimized(true)}
            aria-label="Minimizar"
          >
            <Minus className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="rounded-lg p-1.5 text-white/60 hover:bg-white/10 hover:text-white"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onClose}
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div ref={scrollRef} className="board-scroll min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex items-end gap-2 ${
                m.role === "user" ? "flex-row-reverse" : ""
              }`}
            >
              {m.role === "assistant" ? (
                <JangadaBuddy size="sm" mood="happy" />
              ) : null}
              <div
                className={`min-w-0 rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-[var(--accent)]/20 text-white"
                    : "bg-black/30 text-[var(--text)]"
                }`}
              >
                <p className="whitespace-pre-wrap">{m.content}</p>
                {m.tools && m.tools.length > 0 ? (
                  <ul className="mt-2 space-y-1">
                    {m.tools.map((tool, i) => (
                      <li
                        key={`${m.id}-${i}`}
                        className={`rounded-lg px-2 py-1 text-[11px] ${
                          tool.ok
                            ? "bg-lime-400/15 text-lime-100"
                            : "bg-rose-500/15 text-rose-100"
                        }`}
                      >
                        {tool.ok ? "✓" : "!"} {tool.summary}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
          ))}
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-white/70">
              <JangadaBuddy size="sm" mood="thinking" />
              Jangadinha está remando nas tools…
            </div>
          ) : null}
        </div>

        <div className="shrink-0 space-y-2 border-t border-white/12 p-3">
          <div className="flex flex-wrap gap-1.5">
            {QUICK.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => void send(q)}
                className="rounded-lg border border-white/15 px-2 py-1 text-[11px] text-white/70 hover:text-white"
              >
                {q}
              </button>
            ))}
          </div>
          <form onSubmit={onSubmit} className="flex gap-2">
            <input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Oi, Jangadinha — crie cards ou agende Meet/Teams…"
              className="min-w-0 flex-1 rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-[var(--accent)]"
            />
            <button
              type="submit"
              disabled={loading || !prompt.trim()}
              className="rounded-xl bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-[var(--accent-on)] disabled:opacity-40"
            >
              Enviar
            </button>
          </form>
        </div>

        <button
          type="button"
          aria-label="Redimensionar"
          className="absolute bottom-1 right-1 h-4 w-4 cursor-nwse-resize rounded-sm bg-white/25"
          onPointerDown={(e) => startDrag("resize", e)}
        />
      </div>
    ),
    document.body,
  );
}

function welcome(): ChatLine[] {
  return [
    {
      id: "welcome",
      role: "assistant",
      content:
        "Oi! Eu sou a Jangadinha. Posso criar cards, listas e eventos do calendário (Meet ou Teams). Arrasta a janela — eu vou junto.",
    },
  ];
}
