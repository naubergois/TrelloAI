import { activityKindLabel } from "./utils";
import type { Card, CardAttachment, CardComment, CardDailyNote, KanbanActivity } from "./types";

export type CardTimelineKind =
  | "created"
  | "comment"
  | "note"
  | "attachment"
  | "move"
  | "update"
  | "archive"
  | "delete";

export type CardTimelineItem = {
  id: string;
  at: string;
  kind: CardTimelineKind;
  label: string;
  detail?: string;
  memberId?: string | null;
  attachmentIds?: string[];
};

function isCoveredUpdateNote(note: string | undefined) {
  const text = String(note || "").trim().toLowerCase();
  return (
    text.startsWith("obs ") ||
    text.startsWith("anexo ") ||
    text === "anexo removido"
  );
}

export function buildCardTimeline(input: {
  card: Pick<Card, "id" | "createdAt" | "comments" | "dailyNotes" | "attachments">;
  activities: KanbanActivity[];
}): CardTimelineItem[] {
  const items: CardTimelineItem[] = [
    {
      id: `created:${input.card.id}`,
      at: input.card.createdAt,
      kind: "created",
      label: "Card criado",
    },
  ];

  for (const comment of input.card.comments || []) {
    items.push(commentToTimeline(comment));
  }

  for (const note of input.card.dailyNotes || []) {
    items.push(noteToTimeline(note));
  }

  for (const attachment of input.card.attachments || []) {
    items.push(attachmentToTimeline(attachment));
  }

  for (const activity of input.activities) {
    if (activity.cardId !== input.card.id) continue;
    if (activity.kind === "card_create" || activity.kind === "card_comment") continue;
    if (activity.kind === "card_update" && isCoveredUpdateNote(activity.note)) continue;
    const mapped = activityToTimeline(activity);
    if (mapped) items.push(mapped);
  }

  return items.sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
}

function commentToTimeline(comment: CardComment): CardTimelineItem {
  return {
    id: `comment:${comment.id}`,
    at: comment.createdAt,
    kind: "comment",
    label: "Comentário",
    detail: comment.body,
    memberId: comment.authorId,
  };
}

function noteToTimeline(note: CardDailyNote): CardTimelineItem {
  const day = note.date.split("-").reverse().join("/");
  return {
    id: `note:${note.id}`,
    at: note.createdAt,
    kind: "note",
    label: `Observação · ${day}`,
    detail: note.body || undefined,
    memberId: note.authorId,
    attachmentIds: note.attachmentIds,
  };
}

function attachmentToTimeline(attachment: CardAttachment): CardTimelineItem {
  return {
    id: `attachment:${attachment.id}`,
    at: attachment.createdAt,
    kind: "attachment",
    label: "Anexo",
    detail: attachment.name,
    attachmentIds: [attachment.id],
  };
}

function activityToTimeline(activity: KanbanActivity): CardTimelineItem | null {
  const kind: CardTimelineKind | null =
    activity.kind === "card_move"
      ? "move"
      : activity.kind === "card_archive"
        ? "archive"
        : activity.kind === "card_delete"
          ? "delete"
          : activity.kind === "card_update"
            ? "update"
            : null;
  if (!kind) return null;
  return {
    id: `activity:${activity.id}`,
    at: activity.createdAt,
    kind,
    label: activityKindLabel[activity.kind],
    detail: activity.note,
    memberId: activity.memberId,
  };
}
