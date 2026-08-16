"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { nanoid } from "nanoid";
import type { Board, Card, LabelColor, List, Meeting, TeamMember, TeamRole } from "./types";
import { buildMeetingRoomSlug, createSampleWorkspace } from "./sample-data";

interface BoardState {
  boards: Record<string, Board>;
  lists: Record<string, List>;
  cards: Record<string, Card>;
  members: Record<string, TeamMember>;
  meetings: Record<string, Meeting>;
  currentUserId: string | null;
  activeBoardId: string | null;
  activeMeetingId: string | null;
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

        set((state) => ({
          boards: { ...state.boards, [boardId]: board },
          lists: { ...state.lists, ...lists },
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
        set((state) => {
          const list = state.lists[listId];
          if (!list) return state;
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
        return cardId;
      },

      updateCard: (cardId, patch) =>
        set((state) => {
          const card = state.cards[cardId];
          if (!card) return state;
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
        }),

      deleteCard: (cardId) =>
        set((state) => {
          const card = state.cards[cardId];
          if (!card) return state;
          const list = state.lists[card.listId];
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
        }),

      moveCard: (cardId, toListId, toIndex) =>
        set((state) => {
          const card = state.cards[cardId];
          const toList = state.lists[toListId];
          if (!card || !toList) return state;

          const fromList = state.lists[card.listId];
          if (!fromList) return state;

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
        }),

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

      resetDemo: () => {
        const next = createSampleWorkspace();
        set({ ...next, hydrated: true });
      },
    }),
    {
      name: "trelloai-board-v2",
      partialize: (state) => ({
        boards: state.boards,
        lists: state.lists,
        cards: state.cards,
        members: state.members,
        meetings: state.meetings,
        currentUserId: state.currentUserId,
        activeBoardId: state.activeBoardId,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        // migrate boards missing memberIds
        const boards = { ...state.boards };
        for (const [id, board] of Object.entries(boards)) {
          boards[id] = ensureBoardMembers(board);
        }
        state.boards = boards;
        if (!state.members) state.members = {};
        if (!state.meetings) state.meetings = {};
        state.setHydrated(true);
      },
    },
  ),
);
