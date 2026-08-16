"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { nanoid } from "nanoid";
import type { Board, Card, List } from "./types";
import { createSampleWorkspace } from "./sample-data";

interface BoardState {
  boards: Record<string, Board>;
  lists: Record<string, List>;
  cards: Record<string, Card>;
  activeBoardId: string | null;
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
  moveCard: (
    cardId: string,
    toListId: string,
    toIndex: number,
  ) => void;
  reorderCardInList: (listId: string, activeId: string, overId: string) => void;
  addCardsBulk: (
    listId: string,
    items: { title: string; description?: string; priority?: Card["priority"] }[],
  ) => void;
  applyPriorityUpdates: (
    updates: { cardId: string; priority: NonNullable<Card["priority"]> }[],
  ) => void;
  resetDemo: () => void;
}

const sample = createSampleWorkspace();

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
                ...board,
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
                ...board,
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
            [fromList.id]: { ...fromList, cardIds: card.listId === toListId ? toIds : fromIds },
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

      resetDemo: () => {
        const next = createSampleWorkspace();
        set({ ...next, hydrated: true });
      },
    }),
    {
      name: "trelloai-board-v1",
      partialize: (state) => ({
        boards: state.boards,
        lists: state.lists,
        cards: state.cards,
        activeBoardId: state.activeBoardId,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    },
  ),
);
