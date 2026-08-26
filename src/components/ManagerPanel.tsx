"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  Archive,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  GitBranch,
  Loader2,
  MessageCircle,
  Play,
  Send,
  Settings2,
  ShieldAlert,
  Sparkles,
  Trash2,
  Video,
  X,
} from "lucide-react";
import { useBoardStore } from "@/lib/store";
import type { AiAction, BoardRiskReport } from "@/lib/types";
import { labelStyles } from "@/lib/utils";
import {
  buildDayUpdateReport,
  calendarDayKey,
  formatCalendarDayLabel,
  shiftCalendarDay,
} from "@/lib/calendar-report";
import {
  collectMayaDayMessages,
  downloadTextFile,
  formatMayaChatTranscript,
  listMayaChatDays,
  mayaChatFileName,
} from "@/lib/maya-chat";
import { buildMayaBoardMemory, formatMayaMemoryPrompt } from "@/lib/maya-board-memory";

type Tab = "chat" | "calendar" | "settings";

function timeReached(dailyTime: string) {
  const [h, m] = dailyTime.split(":").map((n) => Number(n));
  if (Number.isNaN(h) || Number.isNaN(m)) return true;
  const now = new Date();
  return now.getHours() > h || (now.getHours() === h && now.getMinutes() >= m);
}

const QUICK_REPLIES = [
  "Sem bloqueios",
  "Concluí a tarefa principal",
  "Continuo no mesmo card",
  "Preciso de review",
];

function MayaAvatar({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const cls =
    size === "lg" ? "h-12 w-12 text-base" : size === "sm" ? "h-7 w-7 text-[10px]" : "h-9 w-9 text-xs";
  return (
    <div
      className={`maya-avatar flex shrink-0 items-center justify-center rounded-full font-semibold text-white ring-2 ring-[var(--accent)]/30 ${cls}`}
      aria-hidden
    >
      M
    </div>
  );
}

function formatTime(iso: string) {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

export function ManagerPanel({
  boardId,
  onClose,
}: {
  boardId: string;
  onClose: () => void;
}) {
  const board = useBoardStore((s) => s.boards[boardId]);
  const boards = useBoardStore((s) => s.boards);
  const managers = useBoardStore((s) => s.managers);
  const standups = useBoardStore((s) => s.standups);
  const members = useBoardStore((s) => s.members);
  const lists = useBoardStore((s) => s.lists);
  const cards = useBoardStore((s) => s.cards);
  const requirements = useBoardStore((s) => s.requirements);
  const currentUserId = useBoardStore((s) => s.currentUserId);
  const activeStandupId = useBoardStore((s) => s.activeStandupId);
  const ensureManager = useBoardStore((s) => s.ensureManager);
  const updateManager = useBoardStore((s) => s.updateManager);
  const startDailyStandup = useBoardStore((s) => s.startDailyStandup);
  const applyStandupAiTurn = useBoardStore((s) => s.applyStandupAiTurn);
  const appendMayaDayChat = useBoardStore((s) => s.appendMayaDayChat);
  const replyToStandupChat = useBoardStore((s) => s.replyToStandupChat);
  const setActiveStandup = useBoardStore((s) => s.setActiveStandup);
  const closeStandup = useBoardStore((s) => s.closeStandup);
  const applyManagerActions = useBoardStore((s) => s.applyManagerActions);
  const addBoardGitRepo = useBoardStore((s) => s.addBoardGitRepo);
  const removeBoardGitRepo = useBoardStore((s) => s.removeBoardGitRepo);
  const setBoardRiskReport = useBoardStore((s) => s.setBoardRiskReport);
  const joinMeeting = useBoardStore((s) => s.joinMeeting);
  const activities = useBoardStore((s) => s.activities);
  const postCalendarDayAlert = useBoardStore((s) => s.postCalendarDayAlert);
  const mayaLogs = useBoardStore((s) => s.mayaLogs);

  const [tab, setTab] = useState<Tab>("chat");
  const [processing, setProcessing] = useState(false);
  const [resultMsg, setResultMsg] = useState("");
  const [draft, setDraft] = useState("");
  const [gitDraft, setGitDraft] = useState("");
  const [calendarDay, setCalendarDay] = useState(calendarDayKey());
  const [archiveOpen, setArchiveOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    ensureManager(boardId);
  }, [boardId, ensureManager]);

  const manager = managers[boardId];

  const standup = useMemo(() => {
    if (activeStandupId && standups[activeStandupId]?.boardId === boardId) {
      return standups[activeStandupId];
    }
    return (
      Object.values(standups)
        .filter((s) => s.boardId === boardId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null
    );
  }, [standups, boardId, activeStandupId]);

  const team = useMemo(() => {
    if (!board) return [];
    return (board.memberIds ?? []).map((id) => members[id]).filter(Boolean);
  }, [board, members]);

  useEffect(() => {
    if (!manager?.enabled || !manager.autoStartDaily || !board) return;
    const today = calendarDayKey();
    if (manager.lastStandupDate === today) return;
    if (!timeReached(manager.dailyTime)) return;
    const open = Object.values(standups).find(
      (s) => s.boardId === boardId && s.date === today && s.status === "open",
    );
    if (open) {
      setActiveStandup(open.id);
      return;
    }
    startDailyStandup(boardId, { withMeeting: true });
  }, [manager, board, boardId, standups, startDailyStandup, setActiveStandup]);

  const dayReport = useMemo(() => {
    if (!board) return null;
    return buildDayUpdateReport(
      boardId,
      calendarDay,
      board.memberIds ?? [],
      Object.values(activities || {}),
    );
  }, [board, boardId, calendarDay, activities]);

  const todayKey = calendarDayKey();
  const todayMessages = useMemo(
    () => collectMayaDayMessages(boardId, todayKey, mayaLogs, standups),
    [boardId, todayKey, mayaLogs, standups],
  );
  const previousChatDays = useMemo(
    () => listMayaChatDays(boardId, mayaLogs, standups).filter((day) => day !== todayKey),
    [boardId, mayaLogs, standups, todayKey],
  );

  useEffect(() => {
    if (tab !== "chat") return;
    const el = chatScrollRef.current;
    if (!el) return;
    const stickToEnd = () => {
      el.scrollTop = el.scrollHeight;
    };
    const frame = window.requestAnimationFrame(stickToEnd);
    const later = window.setTimeout(stickToEnd, 80);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(later);
    };
  }, [todayMessages.length, processing, standup?.awaitingReplyFrom, standup?.id, tab]);

  useEffect(() => {
    if (tab === "chat" && standup?.awaitingReplyFrom) {
      inputRef.current?.focus();
    }
  }, [tab, standup?.awaitingReplyFrom, standup?.chat?.length]);

  if (!board || !manager) return null;

  const awaitingId = standup?.awaitingReplyFrom ?? null;
  const awaitingMember = awaitingId ? members[awaitingId] : null;
  const interviewDone =
    !!standup &&
    standup.status === "open" &&
    !standup.awaitingReplyFrom &&
    (standup.chat?.length ?? 0) > 0;
  const submittedCount = standup?.checkIns.filter((c) => c.submittedAt).length ?? 0;
  const totalMembers = standup?.checkIns.length ?? team.length;
  const progress = totalMembers ? Math.round((submittedCount / totalMembers) * 100) : 0;
  const qIndex = (standup?.currentQuestionIndex ?? 0) + 1;
  const qTotal = standup?.questions?.length || 3;

  const send = (text: string) => {
    void sendStandupWithAi(text);
  };

  const sendStandupWithAi = async (text: string) => {
    const prompt = text.trim();
    if (!standup || !prompt || !awaitingId || processing) return;
    setDraft("");
    setProcessing(true);
    setResultMsg("");

    const member = members[awaitingId];
    const questions =
      standup.questions?.length > 0
        ? standup.questions
        : ["O que você fez desde a última daily?", "No que vai trabalhar hoje?", "Há algum bloqueio?"];
    const checkIn = standup.checkIns.find((c) => c.memberId === awaitingId) || {
      memberId: awaitingId,
      yesterday: "",
      today: "",
      blockers: "",
      submittedAt: null,
    };

    try {
      const res = await fetch("/api/manager", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "standup",
          standup: {
            managerName: manager.name,
            memberName: member?.name || "membro",
            memberId: awaitingId,
            questionIndex: standup.currentQuestionIndex ?? 0,
            questions,
            userReply: prompt,
            checkIn,
            recentChat: (standup.chat ?? []).slice(-10).map((m) => ({
              role: m.role,
              content: m.content,
            })),
            boardTitle: board.title,
            boardMemory: buildManagerContext().memoryBrief,
          },
        }),
      });
      const data = (await res.json()) as {
        message?: string;
        extract?: { yesterday?: string; today?: string; blockers?: string };
        advanceQuestion?: boolean;
        completeMember?: boolean;
        provider?: string;
        error?: string;
      };

      if (!res.ok) {
        // fallback estático se a API falhar por completo
        replyToStandupChat(standup.id, prompt, awaitingId);
        setResultMsg(data.error || "Falha na Maya — usei o fluxo local.");
        return;
      }

      applyStandupAiTurn(standup.id, {
        memberId: awaitingId,
        userText: prompt,
        managerMessage: data.message || "Certo, continue.",
        extract: data.extract || {},
        advanceQuestion: Boolean(data.advanceQuestion),
        completeMember: Boolean(data.completeMember),
      });

      if (data.provider === "deepseek") {
        setResultMsg("");
      } else if (data.message?.includes("DeepSeek falhou")) {
        setResultMsg("Maya respondeu em modo local (DeepSeek indisponível).");
      }
    } catch {
      replyToStandupChat(standup.id, prompt, awaitingId);
      setResultMsg("Erro de rede — usei o fluxo local da daily.");
    } finally {
      setProcessing(false);
    }
  };

  const buildManagerContext = (report?: BoardRiskReport | null) => {
    const boardReqs = Object.values(requirements || {}).filter((r) => r.boardId === boardId);
    const latest = report ?? board.riskReport;
    const memory = buildMayaBoardMemory({
      boardId,
      boards,
      lists,
      cards,
      requirements,
      members,
      managerName: manager.name,
      logs: mayaLogs,
      standups,
    });
    return {
      boardTitle: board.title,
      boardId,
      boardDescription: board.description || "",
      executiveSummary: board.executiveSummary || "",
      memoryBrief: memory ? formatMayaMemoryPrompt(memory) : "",
      recentChat: (memory?.chat || []).map((turn) => ({
        role: turn.role,
        content: turn.content,
        who: turn.who,
      })),
      managerName: manager.name,
      members: team.map((m) => ({ id: m.id, name: m.name, email: m.email })),
      memberNames: Object.fromEntries(team.map((m) => [m.id, m.name])),
      checkIns: standup?.checkIns ?? [],
      requirements: boardReqs.map((r) => ({
        id: r.id,
        code: r.code,
        title: r.title,
        status: r.status,
      })),
      gitRepos: (board.gitRepos || []).map((r) => ({ url: r.url })),
      whatsappGroups: (board.whatsappGroups || []).map((g) => ({
        name: g.name,
        inviteUrl: g.inviteUrl || null,
        jid: g.jid || null,
      })),
      risks: latest?.risks?.map((r) => ({
        title: r.title,
        severity: r.severity,
        reason: r.reason,
      })),
      git: latest?.git?.map((g) => ({
        url: g.url,
        ok: g.ok,
        error: g.error,
        fileCount: g.fileCount,
        files: g.files.slice(0, 80),
        hints: g.hints,
        coverage: g.coverage.map((c) => ({
          title: c.title,
          status: c.status,
          evidence: c.evidence,
        })),
      })),
      lists: board.listIds
        .map((id) => lists[id])
        .filter(Boolean)
        .map((list) => ({
          id: list.id,
          title: list.title,
          cards: list.cardIds
            .map((cid) => cards[cid])
            .filter(Boolean)
            .map((c) => ({
              id: c.id,
              title: c.title,
              description: c.description,
              priority: c.priority,
              assigneeId: c.assigneeId ?? null,
              dueDate: c.dueDate,
            })),
        })),
    };
  };

  const collectAnalyzePayload = (extraUrls: string[] = [], clone = false) => ({
    clone,
    urls: [...new Set([...(board.gitRepos || []).map((r) => r.url), ...extraUrls])],
    requirements: Object.values(requirements || {})
      .filter((r) => r.boardId === boardId)
      .map((r) => ({
        id: r.id,
        title: r.title,
        code: r.code,
        status: r.status,
      })),
    lists: board.listIds
      .map((id) => lists[id])
      .filter(Boolean)
      .map((list) => ({
        id: list.id,
        title: list.title,
        systemKey: list.systemKey ?? null,
        cards: list.cardIds
          .map((cid) => cards[cid])
          .filter(Boolean)
          .map((c) => ({
            id: c.id,
            title: c.title,
            priority: c.priority,
            dueDate: c.dueDate,
            assigneeId: c.assigneeId ?? null,
            origin: c.origin ?? null,
          })),
      })),
  });

  const runRiskAndGitAnalysis = async (extraUrls: string[] = []) => {
    const res = await fetch("/api/board/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(collectAnalyzePayload(extraUrls, true)),
    });
    const data = (await res.json()) as { report?: BoardRiskReport; error?: string };
    if (!res.ok || !data.report) {
      throw new Error(data.error || "Falha na análise.");
    }
    setBoardRiskReport(boardId, data.report);
    return data.report;
  };

  const askWithAnalysis = async (text: string) => {
    const prompt = text.trim();
    if (!prompt || processing) return;
    let report = board.riskReport;
    if (/risco|git\b|reposit|implementad|cobertura|analis/i.test(prompt)) {
      setProcessing(true);
      try {
        report = await runRiskAndGitAnalysis();
      } catch {
        /* Maya usa o relatório anterior, se houver */
      }
      setProcessing(false);
    }
    await askManager(prompt, report);
  };

  const onSend = (e: FormEvent) => {
    e.preventDefault();
    if (awaitingId) {
      void sendStandupWithAi(draft);
      return;
    }
    void askWithAnalysis(draft);
  };

  const askManager = async (text: string, report?: BoardRiskReport | null) => {
    const prompt = text.trim();
    if (!prompt || processing) return;
    appendMayaDayChat(boardId, {
      role: "member",
      memberId: currentUserId,
      content: prompt,
    });
    setProcessing(true);
    setResultMsg("");
    setDraft("");
    try {
      const res = await fetch("/api/manager", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "chat",
          message: prompt,
          context: buildManagerContext(report),
        }),
      });
      const data = (await res.json()) as {
        message?: string;
        action?: AiAction;
        extraAction?: AiAction;
        error?: string;
        provider?: string;
      };
      if (!res.ok) {
        setResultMsg(data.error || "Falha ao consultar Maya.");
        return;
      }
      const actions = [data.action, data.extraAction].filter(Boolean) as AiAction[];
      applyManagerActions(actions, boardId);
      const msg = data.message || "Pronto.";
      appendMayaDayChat(boardId, { role: "manager", content: msg });
      if (data.provider !== "deepseek" && msg.includes("DeepSeek falhou")) {
        setResultMsg("Maya respondeu em modo local (DeepSeek indisponível).");
      }
    } catch {
      setResultMsg("Erro de rede ao falar com Maya.");
    } finally {
      setProcessing(false);
    }
  };

  const processDaily = async () => {
    if (!standup) return;
    setProcessing(true);
    setResultMsg("");
    try {
      const context = buildManagerContext();

      const res = await fetch("/api/manager", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context, mode: "daily" }),
      });
      const data = (await res.json()) as {
        message?: string;
        action?: AiAction;
        extraAction?: AiAction;
        error?: string;
      };
      if (!res.ok) {
        setResultMsg(data.error || "Falha ao processar daily.");
        return;
      }
      const actions = [data.action, data.extraAction].filter(Boolean) as AiAction[];
      applyManagerActions(actions, boardId);
      closeStandup(standup.id, data.message || "");
      setResultMsg(data.message || "Daily processada.");
    } catch {
      setResultMsg("Erro de rede ao processar daily.");
    } finally {
      setProcessing(false);
    }
  };

  const tabs: { id: Tab; label: string; icon: typeof MessageCircle }[] = [
    { id: "chat", label: "Chat", icon: MessageCircle },
    { id: "calendar", label: "Dia", icon: CalendarDays },
    { id: "settings", label: "Ajustes", icon: Settings2 },
  ];

  const downloadDayFile = (date: string) => {
    const messages = collectMayaDayMessages(boardId, date, mayaLogs, standups);
    downloadTextFile(
      mayaChatFileName(board.title, date),
      formatMayaChatTranscript({
        boardTitle: board.title,
        managerName: manager.name,
        date,
        messages,
        members,
      }),
    );
  };

  return (
    <aside className="anim-rise panel-glass flex h-full min-h-0 w-full flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl">
      {/* Header Maya */}
      <header className="relative shrink-0 overflow-hidden border-b border-[var(--line)] px-3 pb-2.5 pt-3 sm:px-4 sm:pb-3 sm:pt-4">
        <div className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-[var(--accent)]/15 blur-2xl" />
        <div className="relative flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <MayaAvatar size="lg" />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-[family-name:var(--font-display)] text-lg text-white">
                  {manager.name}
                </h2>
                <span className="rounded-full bg-[var(--accent)]/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--accent)]">
                  online
                </span>
              </div>
              <p className="text-xs text-[var(--muted)]">
                Gestor(a) virtual · daily às {manager.dailyTime}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[var(--line)] p-2 text-[var(--muted)] transition hover:border-white/20 hover:text-white"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {standup?.status === "open" ? (
          <div className="relative mt-3">
            <div className="mb-1 flex items-center justify-between text-[11px] text-[var(--muted)]">
              <span>
                Daily {standup.date} · {submittedCount}/{totalMembers} no chat
              </span>
              <span>{progress}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full bg-[var(--accent)] transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : null}

        <div className="relative mt-3 flex gap-1 rounded-xl bg-black/25 p-1">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium transition ${
                  active
                    ? "bg-[var(--accent)] text-[var(--accent-on)] shadow"
                    : "text-[var(--muted)] hover:text-white"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>
      </header>

      {/* Body */}
      {tab === "chat" ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--line)] px-3 py-2">
            <p className="text-[11px] text-[var(--muted)]">
              Hoje · {todayMessages.length}{" "}
              {todayMessages.length === 1 ? "mensagem" : "mensagens"}
            </p>
            <div className="flex items-center gap-1">
              {todayMessages.length > 0 ? (
                <button
                  type="button"
                  onClick={() => downloadDayFile(todayKey)}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-[var(--muted)] hover:text-white"
                >
                  <Download className="h-3.5 w-3.5" />
                  Salvar hoje
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setArchiveOpen((open) => !open)}
                className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] ${
                  archiveOpen ? "bg-white/10 text-white" : "text-[var(--muted)] hover:text-white"
                }`}
                aria-expanded={archiveOpen}
              >
                <Archive className="h-3.5 w-3.5" />
                Dias anteriores
                {previousChatDays.length > 0 ? (
                  <span className="rounded-full bg-white/10 px-1.5 text-[10px]">
                    {previousChatDays.length}
                  </span>
                ) : null}
              </button>
            </div>
          </div>

          {archiveOpen ? (
            <div className="shrink-0 border-b border-[var(--line)] bg-black/20 px-3 py-2">
              {previousChatDays.length === 0 ? (
                <p className="text-[11px] text-[var(--muted)]">
                  Conversas de outros dias aparecem aqui como arquivo .txt para baixar.
                </p>
              ) : (
                <ul className="max-h-36 space-y-1 overflow-y-auto">
                  {previousChatDays.map((day) => (
                    <li key={day} className="flex items-center justify-between gap-2">
                      <span className="text-xs text-white">{formatCalendarDayLabel(day)}</span>
                      <button
                        type="button"
                        onClick={() => downloadDayFile(day)}
                        className="inline-flex items-center gap-1 rounded-lg border border-[var(--line)] px-2 py-1 text-[11px] text-[var(--muted)] hover:text-white"
                      >
                        <Download className="h-3 w-3" />
                        Arquivo
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}

          {!standup && todayMessages.length === 0 ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
                <MayaAvatar size="lg" />
                <div>
                  <p className="font-[family-name:var(--font-display)] text-lg text-white">
                    Maya gerencia o projeto
                  </p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    Peça análise de riscos, ligue um Git ou inicie a daily da equipe.
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-1.5">
                  {[
                    "Analise os riscos do board",
                    "Compare o Git com o que está implementado",
                  ].map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => void askWithAnalysis(q)}
                      className="rounded-full border border-[var(--line)] bg-white/5 px-2.5 py-1 text-[11px] text-[var(--muted)] hover:text-white"
                    >
                      {q}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => startDailyStandup(boardId, { withMeeting: true })}
                  className="inline-flex items-center gap-2 rounded-2xl bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[var(--accent-on)] transition hover:brightness-110"
                >
                  <Play className="h-4 w-4" />
                  Começar daily com {manager.name}
                </button>
              </div>
              <div className="border-t border-[var(--line)] px-3 pb-3 pt-2">
                {resultMsg ? (
                  <p className="mb-2 max-h-28 overflow-y-auto rounded-xl border border-[var(--accent)]/20 bg-[var(--accent)]/10 px-3 py-2 text-xs whitespace-pre-wrap text-[var(--accent)]">
                    {resultMsg}
                  </p>
                ) : null}
                <form onSubmit={onSend} className="flex items-center gap-2">
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder='Ex.: "Organize o backlog da ASESI"'
                    disabled={processing}
                    className="w-full rounded-xl border border-[var(--line)] bg-[var(--ink)] px-3 py-2.5 text-sm outline-none placeholder:text-[var(--muted)] focus:border-[var(--accent)] disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={!draft.trim() || processing}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)] text-[var(--accent-on)] disabled:opacity-40"
                  >
                    {processing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <>
              <div ref={chatScrollRef} className="board-scroll min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-4">
                {todayMessages.map((msg, i) => {
                  const isManager = msg.role === "manager";
                  const who = msg.memberId ? members[msg.memberId] : null;
                  const prevMember = i > 0 ? todayMessages[i - 1].memberId : null;
                  const showTurn = Boolean(msg.memberId && msg.memberId !== prevMember);
                  return (
                    <div key={msg.id} className="space-y-2">
                      {showTurn && who ? (
                        <div className="flex items-center gap-2 pt-1">
                          <div className="h-px flex-1 bg-white/10" />
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-white/50">
                            {who.name}
                          </span>
                          <div className="h-px flex-1 bg-white/10" />
                        </div>
                      ) : null}
                    <div
                      className={`chat-bubble flex gap-2 ${isManager ? "items-end" : "flex-row-reverse items-end"}`}
                      style={{ animationDelay: `${Math.min(i, 8) * 20}ms` }}
                    >
                      {isManager ? (
                        <MayaAvatar size="sm" />
                      ) : who ? (
                        <span
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${labelStyles[who.color]}`}
                        >
                          {who.name.slice(0, 1).toUpperCase()}
                        </span>
                      ) : (
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px]">
                          ?
                        </span>
                      )}
                      <div
                        className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm ${
                          isManager
                            ? "rounded-bl-md border border-white/10 bg-[#132536] text-[var(--text)]"
                            : "rounded-br-md bg-[var(--accent)] text-[var(--accent-on)]"
                        }`}
                      >
                        <div className="mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide opacity-70">
                          <span>
                            {isManager
                              ? who
                                ? `${manager.name} · ${who.name}`
                                : manager.name
                              : who?.name || "Membro"}
                          </span>
                          <span className="font-normal normal-case tracking-normal">
                            {formatTime(msg.createdAt)}
                          </span>
                        </div>
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                    </div>
                  );
                })}

                {processing || (awaitingMember && standup?.status === "open") ? (
                  <div className="chat-bubble flex items-center gap-2 pl-1 text-xs text-[var(--muted)]">
                    <MayaAvatar size="sm" />
                    <span className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] bg-white/5 px-2.5 py-1">
                      {processing
                        ? "Maya pensando (DeepSeek)…"
                        : `Aguardando ${awaitingMember?.name}`}
                      <span className="ml-1 inline-flex gap-0.5">
                        <span className="typing-dot h-1 w-1 rounded-full bg-[var(--accent)]" />
                        <span className="typing-dot h-1 w-1 rounded-full bg-[var(--accent)]" />
                        <span className="typing-dot h-1 w-1 rounded-full bg-[var(--accent)]" />
                      </span>
                    </span>
                  </div>
                ) : null}
              </div>

              {resultMsg || standup?.managerSummary ? (
                <div className="mx-3 mb-2 whitespace-pre-wrap rounded-2xl border border-[var(--accent)]/25 bg-[var(--accent)]/10 px-3 py-2 text-xs text-[var(--text)]">
                  {resultMsg || standup?.managerSummary}
                </div>
              ) : null}

              {interviewDone ? (
                <div className="border-t border-[var(--line)] bg-black/20 px-3 py-3">
                  <p className="mb-2 text-center text-xs text-[var(--muted)]">
                    Todo mundo respondeu. Posso atualizar o board agora.
                  </p>
                  <div className="flex gap-2">
                    {standup.meetingId ? (
                      <button
                        type="button"
                        onClick={() => joinMeeting(standup.meetingId!)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--line)] px-3 py-2.5 text-xs text-[var(--muted)] hover:text-white"
                      >
                        <Video className="h-3.5 w-3.5" />
                        Sala
                      </button>
                    ) : null}
                    <button
                      type="button"
                      disabled={processing}
                      onClick={() => void processDaily()}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--accent-2)] px-3 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50"
                    >
                      {processing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                      Atualizar cards
                    </button>
                  </div>
                </div>
              ) : null}

              {standup?.status === "open" && awaitingMember ? (
                <div className="border-t border-[var(--line)] bg-gradient-to-t from-black/40 to-transparent px-3 pb-3 pt-2">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-[11px] text-[var(--muted)]">
                      Resposta de{" "}
                      <strong className="text-white">{awaitingMember.name}</strong>
                      {awaitingMember.id === currentUserId ? " (você)" : ""} · pergunta{" "}
                      {Math.min(qIndex, qTotal)}/{qTotal}
                    </p>
                    <div className="flex gap-1">
                      {team.map((m) => {
                        const done = standup.checkIns.find((c) => c.memberId === m.id)
                          ?.submittedAt;
                        const active = awaitingId === m.id;
                        return (
                          <span
                            key={m.id}
                            title={m.name}
                            className={`flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold ring-2 transition ${
                              active
                                ? "ring-[var(--accent)]"
                                : done
                                  ? "ring-[var(--accent)]/40 opacity-80"
                                  : "ring-transparent opacity-40"
                            } ${labelStyles[m.color]}`}
                          >
                            {m.name.slice(0, 1).toUpperCase()}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {QUICK_REPLIES.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => send(q)}
                        className="rounded-full border border-[var(--line)] bg-white/5 px-2.5 py-1 text-[11px] text-[var(--muted)] transition hover:border-[var(--accent)]/50 hover:text-white"
                      >
                        {q}
                      </button>
                    ))}
                  </div>

                  <form onSubmit={onSend} className="flex items-center gap-2">
                    <input
                      ref={inputRef}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      placeholder={
                        processing
                          ? "Maya (DeepSeek) está respondendo…"
                          : `Responder como ${awaitingMember.name}…`
                      }
                      disabled={processing}
                      className="w-full rounded-xl border border-[var(--line)] bg-[var(--ink)] px-3 py-2.5 text-sm outline-none transition placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 disabled:opacity-60 sm:rounded-2xl sm:px-4 sm:py-3"
                    />
                    <button
                      type="submit"
                      disabled={!draft.trim() || processing}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)] text-[var(--accent-on)] transition hover:brightness-110 disabled:opacity-40 sm:h-11 sm:w-11 sm:rounded-2xl"
                      aria-label="Enviar"
                    >
                      {processing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </button>
                  </form>
                </div>
              ) : (
                <div className="border-t border-[var(--line)] bg-gradient-to-t from-black/40 to-transparent px-3 pb-3 pt-2">
                  <p className="mb-2 text-[11px] text-[var(--muted)]">
                    Peça à Maya para gerir o projeto: criar cards, listas, atribuir e mover.
                  </p>
                  {resultMsg ? (
                    <p className="mb-2 max-h-28 overflow-y-auto rounded-xl border border-[var(--accent)]/20 bg-[var(--accent)]/10 px-3 py-2 text-xs whitespace-pre-wrap text-[var(--accent)]">
                      {resultMsg}
                    </p>
                  ) : null}
                  <form onSubmit={onSend} className="flex items-center gap-2">
                    <input
                      ref={inputRef}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      placeholder='Ex.: "Crie cards para o plano ASESI"'
                      disabled={processing}
                      className="w-full rounded-xl border border-[var(--line)] bg-[var(--ink)] px-3 py-2.5 text-sm outline-none transition placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 disabled:opacity-50 sm:rounded-2xl sm:px-4 sm:py-3"
                    />
                    <button
                      type="submit"
                      disabled={!draft.trim() || processing}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)] text-[var(--accent-on)] transition hover:brightness-110 disabled:opacity-40 sm:h-11 sm:w-11 sm:rounded-2xl"
                      aria-label="Enviar para Maya"
                    >
                      {processing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </button>
                  </form>
                  {!standup ? (
                    <button
                      type="button"
                      onClick={() => startDailyStandup(boardId, { withMeeting: true })}
                      className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--line)] px-3 py-2 text-xs text-[var(--muted)] hover:text-white"
                    >
                      <Play className="h-3.5 w-3.5" />
                      Começar daily com {manager.name}
                    </button>
                  ) : null}
                </div>
              )}

              {standup?.status === "closed" ? (
                <div className="border-t border-[var(--line)] px-3 py-3">
                  <button
                    type="button"
                    onClick={() => startDailyStandup(boardId, { withMeeting: true })}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[var(--line)] px-3 py-2.5 text-sm text-[var(--muted)] hover:text-white"
                  >
                    <Play className="h-4 w-4" />
                    Nova daily
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      {tab === "calendar" ? (
        <div className="board-scroll min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          <div className="flex items-center justify-between">
            <button
              type="button"
              className="rounded-xl border border-[var(--line)] p-2 text-[var(--muted)] hover:text-white"
              onClick={() => setCalendarDay((d) => shiftCalendarDay(d, -1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="text-center">
              <p className="font-[family-name:var(--font-display)] text-white">
                {formatCalendarDayLabel(calendarDay)}
              </p>
              <input
                type="date"
                value={calendarDay}
                onChange={(e) => setCalendarDay(e.target.value)}
                className="mt-1 rounded-lg border border-[var(--line)] bg-[var(--ink)] px-2 py-1 text-xs text-white"
              />
            </div>
            <button
              type="button"
              className="rounded-xl border border-[var(--line)] p-2 text-[var(--muted)] hover:text-white"
              onClick={() => setCalendarDay((d) => shiftCalendarDay(d, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <p className="text-center text-xs text-[var(--muted)]">
            {dayReport?.activityCount ?? 0} atualização(ões) no kanban
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-[var(--accent)]/25 bg-[var(--accent)]/10 p-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--accent)]">
                Atualizaram
              </p>
              <ul className="space-y-2">
                {(dayReport?.updatedMemberIds ?? []).length === 0 ? (
                  <li className="text-xs text-[var(--muted)]">Ninguém ainda</li>
                ) : (
                  dayReport!.updatedMemberIds.map((id) => (
                    <li key={id} className="flex items-center gap-2 text-sm text-white">
                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${labelStyles[members[id]?.color || "teal"]}`}
                      >
                        {(members[id]?.name || "?").slice(0, 1)}
                      </span>
                      {members[id]?.name || id}
                    </li>
                  ))
                )}
              </ul>
            </div>
            <div className="rounded-2xl border border-rose-400/25 bg-rose-500/10 p-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-rose-300">
                Não atualizaram
              </p>
              <ul className="space-y-2">
                {(dayReport?.missingMemberIds ?? []).length === 0 ? (
                  <li className="text-xs text-[var(--muted)]">Time em dia</li>
                ) : (
                  dayReport!.missingMemberIds.map((id) => (
                    <li key={id} className="flex items-center gap-2 text-sm text-rose-50/90">
                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold opacity-70 ${labelStyles[members[id]?.color || "rose"]}`}
                      >
                        {(members[id]?.name || "?").slice(0, 1)}
                      </span>
                      {members[id]?.name || id}
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              const msg = postCalendarDayAlert(boardId, calendarDay);
              if (msg) {
                setResultMsg(msg);
                setTab("chat");
                if (!standup) startDailyStandup(boardId, { withMeeting: false });
              }
            }}
            className="w-full rounded-2xl bg-[var(--accent-2)] px-4 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-110"
          >
            Maya avisa no chat este dia
          </button>
        </div>
      ) : null}

      {tab === "settings" ? (
        <div className="board-scroll min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          <label className="block text-xs text-[var(--muted)]">
            Nome do gestor
            <input
              value={manager.name}
              onChange={(e) => updateManager(boardId, { name: e.target.value })}
              className="mt-1 w-full rounded-xl border border-[var(--line)] bg-[var(--ink)] px-3 py-2.5 text-sm text-white outline-none focus:border-[var(--accent)]"
            />
          </label>
          <label className="block text-xs text-[var(--muted)]">
            Persona
            <textarea
              value={manager.persona}
              onChange={(e) => updateManager(boardId, { persona: e.target.value })}
              className="mt-1 min-h-24 w-full rounded-xl border border-[var(--line)] bg-[var(--ink)] px-3 py-2.5 text-sm text-white outline-none focus:border-[var(--accent)]"
            />
          </label>

          <div className="space-y-2 rounded-2xl border border-[var(--line)] bg-[var(--ink)]/40 p-3">
            <p className="flex items-center gap-1.5 text-sm text-white">
              <GitBranch className="h-4 w-4 text-[var(--accent)]" />
              Repositórios Git
            </p>
            <p className="text-[11px] text-[var(--muted)]">
              A Maya preenche a coluna <strong className="text-white">Riscos Maya</strong> com cada
              risco do kanban e da análise do código. Uma vez por semana o servidor clona o GitLab
              e atualiza essa coluna.
            </p>
            {(board.gitRepos || []).map((repo) => (
              <div
                key={repo.id}
                className="flex items-center gap-2 rounded-xl border border-[var(--line)] bg-black/20 px-2 py-1.5"
              >
                <span className="min-w-0 flex-1 truncate text-xs text-white">{repo.url}</span>
                <button
                  type="button"
                  onClick={() => removeBoardGitRepo(boardId, repo.id)}
                  className="rounded-lg p-1 text-[var(--muted)] hover:text-rose-300"
                  aria-label="Remover git"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const url = gitDraft.trim();
                if (!url) return;
                addBoardGitRepo(boardId, url);
                setGitDraft("");
                void (async () => {
                  setProcessing(true);
                  try {
                    const report = await runRiskAndGitAnalysis([url]);
                    setProcessing(false);
                    await askManager(
                      `Git adicionado: ${url}. Analise os riscos do board e o que já está implementado ou não neste repositório.`,
                      report,
                    );
                  } catch (err) {
                    setProcessing(false);
                    setResultMsg(
                      err instanceof Error ? err.message : "Não consegui inspecionar o Git.",
                    );
                  }
                })();
              }}
            >
              <input
                value={gitDraft}
                onChange={(e) => setGitDraft(e.target.value)}
                placeholder="https://git.cge.local/g_asesi/jangada.git"
                className="w-full rounded-xl border border-[var(--line)] bg-[var(--ink)] px-3 py-2 text-xs text-white outline-none focus:border-[var(--accent)]"
              />
              <button
                type="submit"
                disabled={!gitDraft.trim() || processing}
                className="shrink-0 rounded-xl bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-[var(--accent-on)] disabled:opacity-40"
              >
                Ligar
              </button>
            </form>
            <button
              type="button"
              disabled={processing}
              onClick={() =>
                void askWithAnalysis(
                  "Analise os riscos do board e compare o Git com o que está implementado ou não.",
                )
              }
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--line)] px-3 py-2.5 text-xs text-[var(--muted)] hover:text-white disabled:opacity-40"
            >
              {processing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ShieldAlert className="h-3.5 w-3.5" />
              )}
              Clonar código e analisar agora
            </button>
            {board.riskReport?.risks?.length ? (
              <ul className="space-y-1 text-[11px] text-[var(--muted)]">
                {board.riskReport.risks.slice(0, 5).map((risk) => (
                  <li key={risk.id}>
                    <span className="text-rose-300">{risk.severity}</span> · {risk.title}
                  </li>
                ))}
              </ul>
            ) : null}
            {board.riskReport?.git?.some((g) => g.coverage?.length) ? (
              <div className="space-y-2 border-t border-[var(--line)] pt-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                  Cobertura no Git
                </p>
                {board.riskReport.git.map((repo) => {
                  const implemented = repo.coverage.filter((c) => c.status === "implemented");
                  const missing = repo.coverage.filter((c) => c.status === "missing");
                  const partial = repo.coverage.filter((c) => c.status === "partial");
                  return (
                    <div key={repo.url} className="space-y-1 text-[11px]">
                      <p className="truncate text-white/80">
                        {repo.ok
                          ? `${repo.fileCount} arquivo(s)${repo.hints.length ? ` · ${repo.hints.join(", ")}` : ""}`
                          : repo.error || "Git inacessível"}
                      </p>
                      {implemented.length ? (
                        <p className="text-emerald-300">
                          Implementado: {implemented.slice(0, 4).map((i) => i.title).join("; ")}
                          {implemented.length > 4 ? "…" : ""}
                        </p>
                      ) : null}
                      {partial.length ? (
                        <p className="text-amber-300">
                          Parcial: {partial.slice(0, 3).map((i) => i.title).join("; ")}
                        </p>
                      ) : null}
                      {missing.length ? (
                        <p className="text-rose-300">
                          Não encontrado: {missing.slice(0, 4).map((i) => i.title).join("; ")}
                          {missing.length > 4 ? "…" : ""}
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
          <div className="flex items-center justify-between rounded-xl border border-[var(--line)] bg-[var(--ink)]/50 px-3 py-3">
            <span className="text-sm text-white">Maya ativa</span>
            <input
              type="checkbox"
              checked={manager.enabled}
              onChange={(e) => updateManager(boardId, { enabled: e.target.checked })}
            />
          </div>
          <div className="flex items-center justify-between rounded-xl border border-[var(--line)] bg-[var(--ink)]/50 px-3 py-3">
            <span className="text-sm text-white">Iniciar daily automaticamente</span>
            <input
              type="checkbox"
              checked={manager.autoStartDaily}
              onChange={(e) =>
                updateManager(boardId, { autoStartDaily: e.target.checked })
              }
            />
          </div>
          <label className="block text-xs text-[var(--muted)]">
            Horário da daily
            <input
              type="time"
              value={manager.dailyTime}
              onChange={(e) => updateManager(boardId, { dailyTime: e.target.value })}
              className="mt-1 w-full rounded-xl border border-[var(--line)] bg-[var(--ink)] px-3 py-2.5 text-sm text-white outline-none focus:border-[var(--accent)]"
            />
          </label>
          <button
            type="button"
            onClick={() => {
              setTab("chat");
              startDailyStandup(boardId, { withMeeting: true });
            }}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-[var(--accent-on)]"
          >
            <Play className="h-4 w-4" />
            Iniciar daily agora
          </button>
        </div>
      ) : null}
    </aside>
  );
}
