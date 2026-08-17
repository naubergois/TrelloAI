"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { nanoid } from "nanoid";
import type {
  Board,
  Card,
  KanbanActivity,
  LabelColor,
  List,
  Meeting,
  StandupCheckIn,
  StandupChatMessage,
  StandupSession,
  TeamMember,
  TeamRole,
  VirtualManager,
} from "./types";
import { buildMeetingRoomSlug, createSampleWorkspace, defaultManagerQuestions } from "./sample-data";
import {
  buildDayUpdateReport,
  calendarDayKey,
  dayReportMessage,
  formatCalendarDayLabel,
  shiftCalendarDay,
} from "./calendar-report";

interface BoardState {
  boards: Record<string, Board>;
  lists: Record<string, List>;
  cards: Record<string, Card>;
  members: Record<string, TeamMember>;
  meetings: Record<string, Meeting>;
  managers: Record<string, VirtualManager>;
  standups: Record<string, StandupSession>;
  activities: Record<string, KanbanActivity>;
  currentUserId: string | null;
  activeBoardId: string | null;
  activeMeetingId: string | null;
  activeStandupId: string | null;
  hydrated: boolean;
  setHydrated: (value: boolean) => void;
  createBoard: (title: string, description?: string) => string;
  setActiveBoard: (boardId: string) => void;
  renameBoard: (boardId: string, title: string) => void;
  addList: (boardId: string, title: string) => string;
  renameList: (listId: string, title: string) => void;
  addCard: (
    listId: string,
    title: string,
    extras?: Partial<Pick<Card, "description" | "priority" | "dueDate" | "labels">>,
  ) => string;
  updateCard: (cardId: string, patch: Partial<Card>) => void;
  deleteCard: (cardId: string) => void;
  moveCard: (cardId: string, toListId: string, toIndex: number) => void;
  reorderCardInList: (listId: string, activeId: string, overId: string) => void;
  addCardsBulk: (
    listId: string,
    items: { title: string; description?: string; priority?: Card["priority"] }[],
  ) => void;
  applyPriorityUpdates: (
    updates: { cardId: string; priority: NonNullable<Card["priority"]> }[],
  ) => void;
  setCurrentUserName: (name: string) => void;
  syncGoogleUser: (profile: {
    name: string;
    email: string;
    image?: string | null;
  }) => void;
  addTeamMember: (
    boardId: string,
    data: { name: string; email: string; role?: TeamRole; color?: LabelColor },
  ) => string;
  removeTeamMember: (boardId: string, memberId: string) => void;
  createMeeting: (input: {
    boardId: string;
    title: string;
    scheduledAt?: string | null;
    participantIds?: string[];
    startNow?: boolean;
  }) => string;
  updateMeeting: (meetingId: string, patch: Partial<Meeting>) => void;
  deleteMeeting: (meetingId: string) => void;
  joinMeeting: (meetingId: string) => void;
  leaveMeeting: () => void;
  endMeeting: (meetingId: string) => void;
  ensureManager: (boardId: string) => void;
  updateManager: (boardId: string, patch: Partial<VirtualManager>) => void;
  startDailyStandup: (boardId: string, opts?: { withMeeting?: boolean }) => string;
  submitCheckIn: (
    standupId: string,
    memberId: string,
    data: { yesterday: string; today: string; blockers: string },
  ) => void;
  replyToStandupChat: (standupId: string, text: string, asMemberId?: string) => void;
  setActiveStandup: (standupId: string | null) => void;
  closeStandup: (standupId: string, summary: string) => void;
  applyManagerActions: (actions: import("./types").AiAction[]) => void;
  recordActivity: (input: {
    boardId: string;
    memberId?: string | null;
    kind: KanbanActivity["kind"];
    cardId?: string;
    note?: string;
  }) => void;
  postCalendarDayAlert: (boardId: string, date?: string) => string | null;
  resetDemo: () => void;
}

const sample = createSampleWorkspace();
const MEMBER_COLORS: LabelColor[] = ["teal", "amber", "rose", "sky", "lime", "violet"];

function ensureBoardMembers(board: Board): Board {
  return {
    ...board,
    memberIds: board.memberIds ?? [],
  };
}

export const useBoardStore = create<BoardState>()(
  persist(
    (set, get) => ({
      ...sample,
      hydrated: false,
      setHydrated: (value) => set({ hydrated: value }),

      createBoard: (title, description = "") => {
        const boardId = nanoid();
        const listDefs = ["A fazer", "Em progresso", "Concluído"];
        const now = new Date().toISOString();
        const listIds: string[] = [];
        const lists: Record<string, List> = {};
        const currentUserId = get().currentUserId;

        for (const listTitle of listDefs) {
          const listId = nanoid();
          listIds.push(listId);
          lists[listId] = {
            id: listId,
            boardId,
            title: listTitle,
            cardIds: [],
          };
        }

        const board: Board = {
          id: boardId,
          title: title.trim() || "Novo board",
          description,
          listIds,
          memberIds: currentUserId ? [currentUserId] : [],
          createdAt: now,
          updatedAt: now,
        };

        const manager: VirtualManager = {
          boardId,
          name: "Maya",
          persona:
            "Gestor(a) virtual: reúne o time diariamente, pergunta o andamento e atualiza o kanban.",
          enabled: true,
          dailyTime: "09:30",
          lastStandupDate: null,
          createdAt: now,
          updatedAt: now,
        };

        set((state) => ({
          boards: { ...state.boards, [boardId]: board },
          lists: { ...state.lists, ...lists },
          managers: { ...state.managers, [boardId]: manager },
          activeBoardId: boardId,
        }));

        return boardId;
      },

      setActiveBoard: (boardId) => set({ activeBoardId: boardId }),

      renameBoard: (boardId, title) =>
        set((state) => {
          const board = state.boards[boardId];
          if (!board) return state;
          return {
            boards: {
              ...state.boards,
              [boardId]: {
                ...ensureBoardMembers(board),
                title: title.trim() || board.title,
                updatedAt: new Date().toISOString(),
              },
            },
          };
        }),

      addList: (boardId, title) => {
        const listId = nanoid();
        set((state) => {
          const board = state.boards[boardId];
          if (!board) return state;
          return {
            lists: {
              ...state.lists,
              [listId]: {
                id: listId,
                boardId,
                title: title.trim() || "Nova lista",
                cardIds: [],
              },
            },
            boards: {
              ...state.boards,
              [boardId]: {
                ...ensureBoardMembers(board),
                listIds: [...board.listIds, listId],
                updatedAt: new Date().toISOString(),
              },
            },
          };
        });
        return listId;
      },

      renameList: (listId, title) =>
        set((state) => {
          const list = state.lists[listId];
          if (!list) return state;
          return {
            lists: {
              ...state.lists,
              [listId]: { ...list, title: title.trim() || list.title },
            },
          };
        }),

      addCard: (listId, title, extras = {}) => {
        const cardId = nanoid();
        const now = new Date().toISOString();
        let boardId: string | null = null;
        set((state) => {
          const list = state.lists[listId];
          if (!list) return state;
          boardId = list.boardId;
          const card: Card = {
            id: cardId,
            listId,
            title: title.trim() || "Novo card",
            description: extras.description ?? "",
            labels: extras.labels ?? [],
            dueDate: extras.dueDate ?? null,
            priority: extras.priority ?? null,
            createdAt: now,
            updatedAt: now,
          };
          return {
            cards: { ...state.cards, [cardId]: card },
            lists: {
              ...state.lists,
              [listId]: { ...list, cardIds: [...list.cardIds, cardId] },
            },
          };
        });
        if (boardId) {
          get().recordActivity({
            boardId,
            kind: "card_create",
            cardId,
            note: title.trim() || "Novo card",
          });
        }
        return cardId;
      },

      updateCard: (cardId, patch) => {
        let boardId: string | null = null;
        set((state) => {
          const card = state.cards[cardId];
          if (!card) return state;
          const list = state.lists[card.listId];
          boardId = list?.boardId ?? null;
          return {
            cards: {
              ...state.cards,
              [cardId]: {
                ...card,
                ...patch,
                id: card.id,
                updatedAt: new Date().toISOString(),
              },
            },
          };
        });
        if (boardId) {
          get().recordActivity({
            boardId,
            kind: "card_update",
            cardId,
          });
        }
      },

      deleteCard: (cardId) => {
        let boardId: string | null = null;
        set((state) => {
          const card = state.cards[cardId];
          if (!card) return state;
          const list = state.lists[card.listId];
          boardId = list?.boardId ?? null;
          const nextCards = { ...state.cards };
          delete nextCards[cardId];
          return {
            cards: nextCards,
            lists: list
              ? {
                  ...state.lists,
                  [list.id]: {
                    ...list,
                    cardIds: list.cardIds.filter((id) => id !== cardId),
                  },
                }
              : state.lists,
          };
        });
        if (boardId) {
          get().recordActivity({ boardId, kind: "card_delete", cardId });
        }
      },

      moveCard: (cardId, toListId, toIndex) => {
        let boardId: string | null = null;
        set((state) => {
          const card = state.cards[cardId];
          const toList = state.lists[toListId];
          if (!card || !toList) return state;

          const fromList = state.lists[card.listId];
          if (!fromList) return state;
          boardId = toList.boardId;

          const fromIds = fromList.cardIds.filter((id) => id !== cardId);
          const toIds =
            card.listId === toListId
              ? fromIds
              : toList.cardIds.filter((id) => id !== cardId);

          const clamped = Math.max(0, Math.min(toIndex, toIds.length));
          toIds.splice(clamped, 0, cardId);

          const lists = {
            ...state.lists,
            [fromList.id]: {
              ...fromList,
              cardIds: card.listId === toListId ? toIds : fromIds,
            },
            [toList.id]: { ...toList, cardIds: toIds },
          };

          if (card.listId === toListId) {
            lists[fromList.id] = { ...fromList, cardIds: toIds };
          }

          return {
            lists,
            cards: {
              ...state.cards,
              [cardId]: {
                ...card,
                listId: toListId,
                updatedAt: new Date().toISOString(),
              },
            },
          };
        });
        if (boardId) {
          get().recordActivity({ boardId, kind: "card_move", cardId });
        }
      },

      reorderCardInList: (listId, activeId, overId) => {
        const list = get().lists[listId];
        if (!list) return;
        const oldIndex = list.cardIds.indexOf(activeId);
        const newIndex = list.cardIds.indexOf(overId);
        if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;
        get().moveCard(activeId, listId, newIndex);
      },

      addCardsBulk: (listId, items) => {
        for (const item of items) {
          get().addCard(listId, item.title, {
            description: item.description,
            priority: item.priority ?? null,
          });
        }
      },

      applyPriorityUpdates: (updates) => {
        for (const update of updates) {
          get().updateCard(update.cardId, { priority: update.priority });
        }
      },

      setCurrentUserName: (name) =>
        set((state) => {
          const id = state.currentUserId;
          if (!id || !state.members[id]) return state;
          return {
            members: {
              ...state.members,
              [id]: { ...state.members[id], name: name.trim() || state.members[id].name },
            },
          };
        }),

      syncGoogleUser: (profile) =>
        set((state) => {
          const email = profile.email.trim().toLowerCase();
          const name = profile.name.trim() || "Usuário Google";
          const image = profile.image ?? null;
          const now = new Date().toISOString();

          // Prefer matching by email across members
          const existing =
            Object.values(state.members).find(
              (m) => m.email.trim().toLowerCase() === email && email.length > 0,
            ) ?? (state.currentUserId ? state.members[state.currentUserId] : null);

          if (existing) {
            const memberId = existing.id;
            const boards = { ...state.boards };
            for (const [boardId, board] of Object.entries(boards)) {
              const memberIds = board.memberIds ?? [];
              if (!memberIds.includes(memberId)) {
                boards[boardId] = {
                  ...board,
                  memberIds: [...memberIds, memberId],
                  updatedAt: now,
                };
              }
            }
            return {
              currentUserId: memberId,
              members: {
                ...state.members,
                [memberId]: {
                  ...existing,
                  name,
                  email: email || existing.email,
                  image,
                  role: existing.role === "owner" ? "owner" : existing.role,
                },
              },
              boards,
            };
          }

          const memberId = nanoid();
          const member: TeamMember = {
            id: memberId,
            name,
            email: email || `${memberId}@gmail.local`,
            role: "owner",
            color: "teal",
            image,
            createdAt: now,
          };

          const boards = { ...state.boards };
          for (const [boardId, board] of Object.entries(boards)) {
            const memberIds = (board.memberIds ?? []).filter(
              (id) => id !== state.currentUserId,
            );
            boards[boardId] = {
              ...board,
              memberIds: [memberId, ...memberIds],
              updatedAt: now,
            };
          }

          const nextMembers = { ...state.members, [memberId]: member };
          if (state.currentUserId && state.currentUserId !== memberId) {
            // demote previous local "Você" placeholder if unused
            const prev = nextMembers[state.currentUserId];
            if (prev && prev.email.endsWith("@trelloai.local")) {
              delete nextMembers[state.currentUserId];
            }
          }

          return {
            currentUserId: memberId,
            members: nextMembers,
            boards,
          };
        }),

      addTeamMember: (boardId, data) => {
        const memberId = nanoid();
        const now = new Date().toISOString();
        set((state) => {
          const board = state.boards[boardId];
          if (!board) return state;
          const color =
            data.color ??
            MEMBER_COLORS[Object.keys(state.members).length % MEMBER_COLORS.length];
          const member: TeamMember = {
            id: memberId,
            name: data.name.trim() || "Membro",
            email: data.email.trim() || `${memberId}@equipe.local`,
            role: data.role ?? "member",
            color,
            createdAt: now,
          };
          const safeBoard = ensureBoardMembers(board);
          return {
            members: { ...state.members, [memberId]: member },
            boards: {
              ...state.boards,
              [boardId]: {
                ...safeBoard,
                memberIds: [...safeBoard.memberIds, memberId],
                updatedAt: now,
              },
            },
          };
        });
        return memberId;
      },

      removeTeamMember: (boardId, memberId) =>
        set((state) => {
          const board = state.boards[boardId];
          if (!board) return state;
          const safeBoard = ensureBoardMembers(board);
          if (memberId === state.currentUserId) return state;

          const nextMembers = { ...state.members };
          // keep member profile if on other boards; only detach from this board
          const usedElsewhere = Object.values(state.boards).some(
            (b) => b.id !== boardId && (b.memberIds ?? []).includes(memberId),
          );
          if (!usedElsewhere) delete nextMembers[memberId];

          const nextMeetings = { ...state.meetings };
          for (const meeting of Object.values(nextMeetings)) {
            if (meeting.boardId !== boardId) continue;
            nextMeetings[meeting.id] = {
              ...meeting,
              participantIds: meeting.participantIds.filter((id) => id !== memberId),
              updatedAt: new Date().toISOString(),
            };
          }

          return {
            members: nextMembers,
            meetings: nextMeetings,
            boards: {
              ...state.boards,
              [boardId]: {
                ...safeBoard,
                memberIds: safeBoard.memberIds.filter((id) => id !== memberId),
                updatedAt: new Date().toISOString(),
              },
            },
          };
        }),

      createMeeting: ({ boardId, title, scheduledAt = null, participantIds, startNow }) => {
        const meetingId = nanoid();
        const now = new Date().toISOString();
        const state = get();
        const board = state.boards[boardId];
        if (!board) return meetingId;

        const safeBoard = ensureBoardMembers(board);
        const meeting: Meeting = {
          id: meetingId,
          boardId,
          title: title.trim() || "Reunião da equipe",
          roomSlug: buildMeetingRoomSlug(board.title, meetingId),
          status: startNow ? "live" : "scheduled",
          scheduledAt: startNow ? now : scheduledAt,
          participantIds:
            participantIds && participantIds.length > 0
              ? participantIds
              : [...safeBoard.memberIds],
          createdById: state.currentUserId ?? safeBoard.memberIds[0] ?? meetingId,
          createdAt: now,
          updatedAt: now,
        };

        set((s) => ({
          meetings: { ...s.meetings, [meetingId]: meeting },
          activeMeetingId: startNow ? meetingId : s.activeMeetingId,
        }));

        return meetingId;
      },

      updateMeeting: (meetingId, patch) =>
        set((state) => {
          const meeting = state.meetings[meetingId];
          if (!meeting) return state;
          return {
            meetings: {
              ...state.meetings,
              [meetingId]: {
                ...meeting,
                ...patch,
                id: meeting.id,
                updatedAt: new Date().toISOString(),
              },
            },
          };
        }),

      deleteMeeting: (meetingId) =>
        set((state) => {
          const next = { ...state.meetings };
          delete next[meetingId];
          return {
            meetings: next,
            activeMeetingId:
              state.activeMeetingId === meetingId ? null : state.activeMeetingId,
          };
        }),

      joinMeeting: (meetingId) => {
        const meeting = get().meetings[meetingId];
        if (!meeting) return;
        get().updateMeeting(meetingId, { status: "live" });
        set({ activeMeetingId: meetingId });
      },

      leaveMeeting: () => set({ activeMeetingId: null }),

      endMeeting: (meetingId) => {
        get().updateMeeting(meetingId, { status: "ended" });
        set((state) => ({
          activeMeetingId:
            state.activeMeetingId === meetingId ? null : state.activeMeetingId,
        }));
      },

      ensureManager: (boardId) => {
        if (get().managers[boardId]) return;
        const now = new Date().toISOString();
        set((state) => ({
          managers: {
            ...state.managers,
            [boardId]: {
              boardId,
              name: "Maya",
              persona:
                "Gestor(a) virtual: reúne o time diariamente, pergunta o andamento e atualiza o kanban.",
              enabled: true,
              dailyTime: "09:30",
              lastStandupDate: null,
              createdAt: now,
              updatedAt: now,
            },
          },
        }));
      },

      updateManager: (boardId, patch) =>
        set((state) => {
          const manager = state.managers[boardId];
          if (!manager) return state;
          return {
            managers: {
              ...state.managers,
              [boardId]: {
                ...manager,
                ...patch,
                boardId,
                updatedAt: new Date().toISOString(),
              },
            },
          };
        }),

      startDailyStandup: (boardId, opts = {}) => {
        get().ensureManager(boardId);
        const state = get();
        const board = state.boards[boardId];
        const manager = state.managers[boardId];
        if (!board || !manager) return "";

        const today = new Date().toISOString().slice(0, 10);
        const existing = Object.values(state.standups).find(
          (s) => s.boardId === boardId && s.date === today && s.status !== "closed",
        );
        if (existing) {
          // migrate old sessions without chat
          if (!existing.chat) {
            const firstId = existing.checkIns[0]?.memberId ?? null;
            const memberName = firstId ? state.members[firstId]?.name : "time";
            const questions = existing.questions?.length
              ? existing.questions
              : defaultManagerQuestions();
            const nowFix = new Date().toISOString();
            const chat: StandupChatMessage[] = [
              {
                id: nanoid(),
                role: "manager",
                memberId: null,
                content: `Olá, time! Sou ${manager.name}. Vamos à daily de hoje — pergunto para cada um como anda o projeto.`,
                createdAt: nowFix,
              },
            ];
            if (firstId) {
              chat.push({
                id: nanoid(),
                role: "manager",
                memberId: firstId,
                content: `${memberName}, ${questions[0]}`,
                createdAt: nowFix,
              });
            }
            set((s) => ({
              standups: {
                ...s.standups,
                [existing.id]: {
                  ...existing,
                  chat,
                  currentMemberIndex: 0,
                  currentQuestionIndex: 0,
                  awaitingReplyFrom: firstId,
                  questions,
                },
              },
              activeStandupId: existing.id,
            }));
          } else {
            set({ activeStandupId: existing.id });
          }
          return existing.id;
        }

        const standupId = nanoid();
        const now = new Date().toISOString();
        const memberIds = ensureBoardMembers(board).memberIds;
        const checkIns: StandupCheckIn[] = memberIds.map((memberId) => ({
          memberId,
          yesterday: "",
          today: "",
          blockers: "",
          submittedAt: null,
        }));
        const questions = defaultManagerQuestions();
        const firstMemberId = memberIds[0] ?? null;
        const firstName = firstMemberId
          ? state.members[firstMemberId]?.name || "membro"
          : "time";

        let meetingId: string | null = null;
        if (opts.withMeeting !== false) {
          meetingId = get().createMeeting({
            boardId,
            title: `Daily — ${manager.name} · ${today}`,
            startNow: false,
            participantIds: memberIds,
          });
        }

        const chat: StandupChatMessage[] = [
          {
            id: nanoid(),
            role: "manager",
            memberId: null,
            content: `Olá, time! Sou ${manager.name}, gestor(a) virtual deste board. Vou perguntar para cada um como anda o projeto e depois atualizo o kanban.`,
            createdAt: now,
          },
        ];
        if (firstMemberId) {
          chat.push({
            id: nanoid(),
            role: "manager",
            memberId: firstMemberId,
            content: `${firstName}, ${questions[0]}`,
            createdAt: now,
          });
        }

        const standup: StandupSession = {
          id: standupId,
          boardId,
          date: today,
          status: "open",
          questions,
          checkIns,
          chat,
          currentMemberIndex: 0,
          currentQuestionIndex: 0,
          awaitingReplyFrom: firstMemberId,
          managerSummary: "",
          meetingId,
          createdAt: now,
          updatedAt: now,
        };

        set((s) => ({
          standups: { ...s.standups, [standupId]: standup },
          activeStandupId: standupId,
          managers: {
            ...s.managers,
            [boardId]: {
              ...s.managers[boardId],
              lastStandupDate: today,
              updatedAt: now,
            },
          },
        }));

        // Aviso de calendário: ontem + hoje (quem atualizou / quem não)
        get().postCalendarDayAlert(boardId, shiftCalendarDay(today, -1));
        get().postCalendarDayAlert(boardId, today);

        return standupId;
      },

      submitCheckIn: (standupId, memberId, data) =>
        set((state) => {
          const standup = state.standups[standupId];
          if (!standup) return state;
          const checkIns = standup.checkIns.map((c) =>
            c.memberId === memberId
              ? {
                  ...c,
                  yesterday: data.yesterday,
                  today: data.today,
                  blockers: data.blockers,
                  submittedAt: new Date().toISOString(),
                }
              : c,
          );
          return {
            standups: {
              ...state.standups,
              [standupId]: {
                ...standup,
                checkIns,
                updatedAt: new Date().toISOString(),
              },
            },
          };
        }),

      replyToStandupChat: (standupId, text, asMemberId) => {
        const trimmed = text.trim();
        if (!trimmed) return;

        let boardIdForActivity: string | null = null;
        let memberForActivity: string | null = null;

        set((state) => {
          const standup = state.standups[standupId];
          if (!standup || standup.status !== "open") return state;

          const memberIds = standup.checkIns.map((c) => c.memberId);
          const memberIndex = Math.min(
            standup.currentMemberIndex ?? 0,
            Math.max(memberIds.length - 1, 0),
          );
          const questionIndex = standup.currentQuestionIndex ?? 0;
          const targetMemberId =
            asMemberId ||
            standup.awaitingReplyFrom ||
            memberIds[memberIndex] ||
            null;
          if (!targetMemberId) return state;

          boardIdForActivity = standup.boardId;
          memberForActivity = targetMemberId;

          const now = new Date().toISOString();
          const chat = [...(standup.chat ?? [])];
          chat.push({
            id: nanoid(),
            role: "member",
            memberId: targetMemberId,
            content: trimmed,
            createdAt: now,
          });

          const field =
            questionIndex === 0 ? "yesterday" : questionIndex === 1 ? "today" : "blockers";
          let checkIns = standup.checkIns.map((c) =>
            c.memberId === targetMemberId ? { ...c, [field]: trimmed } : c,
          );

          const questions =
            standup.questions?.length > 0
              ? standup.questions
              : defaultManagerQuestions();
          let nextMemberIndex = memberIndex;
          let nextQuestionIndex = questionIndex + 1;
          let awaitingReplyFrom: string | null = targetMemberId;
          const manager = state.managers[standup.boardId];
          const managerName = manager?.name || "Gestor";

          if (nextQuestionIndex >= questions.length) {
            checkIns = checkIns.map((c) =>
              c.memberId === targetMemberId
                ? { ...c, submittedAt: now }
                : c,
            );
            const memberName = state.members[targetMemberId]?.name || "você";
            chat.push({
              id: nanoid(),
              role: "manager",
              memberId: targetMemberId,
              content: `Obrigado, ${memberName}! Anotei seu status.`,
              createdAt: now,
            });

            nextMemberIndex = memberIndex + 1;
            nextQuestionIndex = 0;

            if (nextMemberIndex < memberIds.length) {
              const nextId = memberIds[nextMemberIndex];
              const nextName = state.members[nextId]?.name || "próximo";
              awaitingReplyFrom = nextId;
              chat.push({
                id: nanoid(),
                role: "manager",
                memberId: nextId,
                content: `${nextName}, ${questions[0]}`,
                createdAt: now,
              });
            } else {
              awaitingReplyFrom = null;
              chat.push({
                id: nanoid(),
                role: "manager",
                memberId: null,
                content: `Pronto — falei com todo o time. Quando quiser, peço para processar a daily e eu crio/atualizo os cards no board.`,
                createdAt: now,
              });
            }
          } else {
            const memberName = state.members[targetMemberId]?.name || "você";
            chat.push({
              id: nanoid(),
              role: "manager",
              memberId: targetMemberId,
              content: `${memberName}, ${questions[nextQuestionIndex]}`,
              createdAt: now,
            });
            awaitingReplyFrom = targetMemberId;
          }

          void managerName;

          return {
            standups: {
              ...state.standups,
              [standupId]: {
                ...standup,
                chat,
                checkIns,
                currentMemberIndex: nextMemberIndex,
                currentQuestionIndex: nextQuestionIndex,
                awaitingReplyFrom,
                updatedAt: now,
              },
            },
          };
        });

        if (boardIdForActivity && memberForActivity) {
          get().recordActivity({
            boardId: boardIdForActivity,
            memberId: memberForActivity,
            kind: "standup_reply",
            note: trimmed.slice(0, 120),
          });
        }
      },

      setActiveStandup: (standupId) => set({ activeStandupId: standupId }),

      closeStandup: (standupId, summary) =>
        set((state) => {
          const standup = state.standups[standupId];
          if (!standup) return state;
          return {
            standups: {
              ...state.standups,
              [standupId]: {
                ...standup,
                status: "closed",
                managerSummary: summary,
                updatedAt: new Date().toISOString(),
              },
            },
            activeStandupId:
              state.activeStandupId === standupId ? null : state.activeStandupId,
          };
        }),

      applyManagerActions: (actions) => {
        for (const action of actions) {
          if (action.type === "create_cards") {
            const listId = action.listId;
            if (!listId) continue;
            get().addCardsBulk(listId, action.cards);
          }
          if (action.type === "suggest_priorities") {
            get().applyPriorityUpdates(action.updates);
          }
          if (action.type === "update_cards") {
            for (const u of action.updates) {
              const patch: Partial<Card> = {};
              if (u.title !== undefined) patch.title = u.title;
              if (u.description !== undefined) patch.description = u.description;
              if (u.priority !== undefined) patch.priority = u.priority;
              if (Object.keys(patch).length) get().updateCard(u.cardId, patch);
              if (u.moveToListId) {
                const list = get().lists[u.moveToListId];
                if (list) get().moveCard(u.cardId, u.moveToListId, list.cardIds.length);
              }
            }
          }
        }
      },

      recordActivity: ({ boardId, memberId, kind, cardId, note }) => {
        const actor = memberId || get().currentUserId;
        if (!actor) return;
        const id = nanoid();
        const now = new Date().toISOString();
        const activity: KanbanActivity = {
          id,
          boardId,
          memberId: actor,
          date: calendarDayKey(),
          kind,
          cardId,
          note,
          createdAt: now,
        };
        set((state) => ({
          activities: { ...(state.activities || {}), [id]: activity },
        }));
      },

      postCalendarDayAlert: (boardId, date) => {
        const state = get();
        const board = state.boards[boardId];
        const manager = state.managers[boardId];
        if (!board || !manager) return null;

        const day = date || calendarDayKey();
        const memberIds = ensureBoardMembers(board).memberIds;
        const activities = Object.values(state.activities || {});
        const report = buildDayUpdateReport(boardId, day, memberIds, activities);
        const updatedNames = report.updatedMemberIds.map(
          (id) => state.members[id]?.name || id,
        );
        const missingNames = report.missingMemberIds.map(
          (id) => state.members[id]?.name || id,
        );
        const message = dayReportMessage(
          manager.name,
          formatCalendarDayLabel(day),
          updatedNames,
          missingNames,
        );

        // Attach alert to open standup chat if any; otherwise keep as managerSummary on a sticky note via standup of today
        const today = calendarDayKey();
        const openStandup = Object.values(state.standups).find(
          (s) => s.boardId === boardId && s.date === today && s.status === "open",
        );
        if (openStandup) {
          const now = new Date().toISOString();
          const chatMsg: StandupChatMessage = {
            id: nanoid(),
            role: "manager",
            memberId: null,
            content: message,
            createdAt: now,
          };
          set((s) => ({
            standups: {
              ...s.standups,
              [openStandup.id]: {
                ...s.standups[openStandup.id],
                chat: [...(s.standups[openStandup.id].chat || []), chatMsg],
                updatedAt: now,
              },
            },
          }));
        }

        return message;
      },

      resetDemo: () => {
        const next = createSampleWorkspace();
        set({ ...next, hydrated: true });
      },
    }),
    {
      name: "trelloai-board-v3",
      partialize: (state) => ({
        boards: state.boards,
        lists: state.lists,
        cards: state.cards,
        members: state.members,
        meetings: state.meetings,
        managers: state.managers,
        standups: state.standups,
        activities: state.activities,
        currentUserId: state.currentUserId,
        activeBoardId: state.activeBoardId,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const boards = { ...state.boards };
        for (const [id, board] of Object.entries(boards)) {
          boards[id] = ensureBoardMembers(board);
        }
        state.boards = boards;
        if (!state.members) state.members = {};
        if (!state.meetings) state.meetings = {};
        if (!state.managers) state.managers = {};
        if (!state.standups) state.standups = {};
        if (!state.activities) state.activities = {};
        for (const boardId of Object.keys(state.boards)) {
          if (!state.managers[boardId]) {
            const now = new Date().toISOString();
            state.managers[boardId] = {
              boardId,
              name: "Maya",
              persona:
                "Gestor(a) virtual: reúne o time diariamente, pergunta o andamento e atualiza o kanban.",
              enabled: true,
              dailyTime: "09:30",
              lastStandupDate: null,
              createdAt: now,
              updatedAt: now,
            };
          }
        }
        state.setHydrated(true);
      },
    },
  ),
);
