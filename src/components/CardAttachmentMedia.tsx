"use client";

import { Download, FileText, Image as ImageIcon } from "lucide-react";
import type { CardAttachment } from "@/lib/types";
import {
  formatFileSize,
  isImageAttachment,
  isPdfAttachment,
} from "@/lib/card-attachments";

export function attachmentsByIds(
  attachments: CardAttachment[] | undefined,
  ids: string[] | undefined,
) {
  if (!ids?.length) return [];
  const byId = new Map((attachments || []).map((item) => [item.id, item]));
  return ids.map((id) => byId.get(id)).filter((item): item is CardAttachment => Boolean(item));
}

function FileMeta({ attachment }: { attachment: CardAttachment }) {
  return (
    <p className="text-[10px] text-[var(--muted)]">
      {attachment.kind === "link" ? "Link" : formatFileSize(attachment.size)}
    </p>
  );
}

export function CardAttachmentMedia({
  attachments,
  compact = false,
}: {
  attachments: CardAttachment[];
  compact?: boolean;
}) {
  if (!attachments.length) return null;
  const images = attachments.filter(isImageAttachment);
  const pdfs = attachments.filter((item) => !isImageAttachment(item) && isPdfAttachment(item));
  const docs = attachments.filter((item) => !isImageAttachment(item) && !isPdfAttachment(item));

  return (
    <div className="space-y-2">
      {images.length > 0 ? (
        <div className={`grid gap-2 ${images.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
          {images.map((attachment) => (
            <figure
              key={attachment.id}
              className="overflow-hidden rounded-xl border border-[var(--line)] bg-black/30"
            >
              <a href={attachment.url} target="_blank" rel="noreferrer" className="block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={attachment.url}
                  alt={attachment.name}
                  className={`w-full object-cover ${compact ? "max-h-40" : "max-h-72"} bg-black/40`}
                />
              </a>
              <figcaption className="flex items-center justify-between gap-2 px-2.5 py-1.5">
                <span className="min-w-0 truncate text-[11px] text-white">{attachment.name}</span>
                <a
                  href={attachment.url}
                  download={attachment.kind === "file" ? attachment.name : undefined}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 text-[var(--muted)] hover:text-white"
                  aria-label={`Baixar ${attachment.name}`}
                >
                  <Download className="h-3.5 w-3.5" />
                </a>
              </figcaption>
            </figure>
          ))}
        </div>
      ) : null}

      {pdfs.map((attachment) => (
        <div
          key={attachment.id}
          className="overflow-hidden rounded-xl border border-[var(--line)] bg-black/30"
        >
          <div className="flex items-center gap-2 px-2.5 py-2">
            <FileText className="h-4 w-4 shrink-0 text-[var(--muted)]" />
            <a
              href={attachment.url}
              target="_blank"
              rel="noreferrer"
              className="min-w-0 flex-1 truncate text-sm text-white hover:underline"
            >
              {attachment.name}
            </a>
            <FileMeta attachment={attachment} />
          </div>
          {compact ? null : (
            <iframe
              title={attachment.name}
              src={attachment.url}
              className="h-72 w-full border-t border-[var(--line)] bg-white"
            />
          )}
        </div>
      ))}

      {docs.length > 0 ? (
        <ul className="space-y-1.5">
          {docs.map((attachment) => (
            <li
              key={attachment.id}
              className="flex items-center gap-2 rounded-xl border border-[var(--line)] bg-black/20 px-3 py-2"
            >
              {isImageAttachment(attachment) ? (
                <ImageIcon className="h-4 w-4 shrink-0 text-[var(--muted)]" />
              ) : (
                <FileText className="h-4 w-4 shrink-0 text-[var(--muted)]" />
              )}
              <div className="min-w-0 flex-1">
                <a
                  href={attachment.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block truncate text-sm text-white hover:underline"
                >
                  {attachment.name}
                </a>
                <FileMeta attachment={attachment} />
              </div>
              <a
                href={attachment.url}
                download={attachment.kind === "file" ? attachment.name : undefined}
                target="_blank"
                rel="noreferrer"
                className="rounded p-1 text-[var(--muted)] hover:text-white"
                aria-label={`Baixar ${attachment.name}`}
              >
                <Download className="h-3.5 w-3.5" />
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
