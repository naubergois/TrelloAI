import { describe, expect, it } from "vitest";
import { buildCardTimeline } from "./card-timeline";
import type { Card, KanbanActivity } from "./types";

const card: Pick<Card, "id" | "createdAt" | "comments" | "dailyNotes" | "attachments"> = {
  id: "c1",
  createdAt: "2026-08-20T10:00:00.000Z",
  comments: [
    {
      id: "cm1",
      authorId: "ana",
      body: "Segue o print",
      createdAt: "2026-08-22T12:00:00.000Z",
    },
  ],
  dailyNotes: [
    {
      id: "n1",
      date: "2026-08-21",
      body: "Kickoff",
      attachmentIds: ["a1"],
      authorId: "ana",
      createdAt: "2026-08-21T15:00:00.000Z",
      updatedAt: "2026-08-21T15:00:00.000Z",
    },
  ],
  attachments: [
    {
      id: "a1",
      name: "print.png",
      mimeType: "image/png",
      size: 12,
      kind: "file",
      url: "/a1",
      createdAt: "2026-08-21T15:01:00.000Z",
    },
  ],
};

describe("card timeline", () => {
  it("orders created, notes, attachments, comments and later moves", () => {
    const activities: KanbanActivity[] = [
      {
        id: "act-create",
        boardId: "b1",
        memberId: "ana",
        date: "2026-08-20",
        kind: "card_create",
        cardId: "c1",
        createdAt: "2026-08-20T10:00:00.000Z",
      },
      {
        id: "act-obs",
        boardId: "b1",
        memberId: "ana",
        date: "2026-08-21",
        kind: "card_update",
        cardId: "c1",
        note: "obs 2026-08-21: Kickoff",
        createdAt: "2026-08-21T15:00:01.000Z",
      },
      {
        id: "act-move",
        boardId: "b1",
        memberId: "ana",
        date: "2026-08-23",
        kind: "card_move",
        cardId: "c1",
        createdAt: "2026-08-23T09:00:00.000Z",
      },
    ];
    const items = buildCardTimeline({ card, activities });
    expect(items.map((item) => item.kind)).toEqual([
      "created",
      "note",
      "attachment",
      "comment",
      "move",
    ]);
    expect(items.find((item) => item.kind === "note")?.attachmentIds).toEqual(["a1"]);
  });
});
