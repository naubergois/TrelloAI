"use client";

import { useRef, useState } from "react";
import {
  Download,
  FileText,
  Image as ImageIcon,
  Loader2,
  Paperclip,
  Trash2,
} from "lucide-react";
import type { Card, CardAttachment } from "@/lib/types";
import { useBoardStore } from "@/lib/store";
import { useToast } from "@/components/Toast";
import { formatFileSize, MAX_ATTACHMENT_BYTES } from "@/lib/card-attachments";

function isImage(attachment: CardAttachment) {
  return (
    attachment.mimeType.startsWith("image/") ||
    (attachment.kind === "link" && /\.(png|jpe?g|gif|webp)$/i.test(attachment.name))
  );
}

export function CardAttachments({
  card,
  boardId,
}: {
  card: Card;
  boardId: string | undefined;
}) {
  const addCardAttachment = useBoardStore((s) => s.addCardAttachment);
  const removeCardAttachment = useBoardStore((s) => s.removeCardAttachment);
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const attachments = card.attachments || [];

  const uploadFiles = async (files: FileList | File[]) => {
    const list = Array.from(files).filter((file) => file.size > 0);
    if (!list.length) return;
    if (!boardId) {
      toast("Este card ainda não está em um board salvo.");
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      for (const file of list) form.append("file", file);
      const res = await fetch(`/api/boards/${boardId}/cards/${card.id}/attachments`, {
        method: "POST",
        credentials: "include",
        body: form,
      });
      const data = (await res.json().catch(() => ({}))) as {
        attachments?: CardAttachment[];
        error?: string;
      };
      if (!res.ok) {
        toast(data.error || "Não foi possível enviar o arquivo.");
        return;
      }
      for (const attachment of data.attachments || []) {
        addCardAttachment(card.id, attachment);
      }
      const n = data.attachments?.length || 0;
      toast(n > 1 ? `${n} arquivos anexados` : "Arquivo anexado");
    } catch {
      toast("Falha ao enviar o arquivo.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (attachment: CardAttachment) => {
    removeCardAttachment(card.id, attachment.id);
    if (!boardId || attachment.kind === "link") return;
    try {
      const res = await fetch(
        `/api/boards/${boardId}/cards/${card.id}/attachments/${attachment.id}`,
        { method: "DELETE", credentials: "include" },
      );
      if (!res.ok) toast("Não foi possível remover o anexo no servidor.");
    } catch {
      toast("Não foi possível remover o anexo no servidor.");
    }
  };

  return (
    <div className="rounded-2xl border border-[var(--line)] bg-black/15 p-4 md:col-span-2">
      <p className="mb-2 text-xs font-medium text-[var(--muted)] sm:text-sm">Anexos</p>
      <ul className="mb-3 space-y-2">
        {attachments.map((attachment) => (
          <li
            key={attachment.id}
            className="flex items-center gap-2 rounded-xl border border-[var(--line)] bg-black/20 px-3 py-2"
          >
            {isImage(attachment) && attachment.kind === "file" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={attachment.url}
                alt=""
                className="h-8 w-8 shrink-0 rounded object-cover"
              />
            ) : isImage(attachment) ? (
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
                title={attachment.name}
              >
                {attachment.name}
              </a>
              <p className="text-[10px] text-[var(--muted)]">
                {attachment.kind === "link" ? "Link" : formatFileSize(attachment.size)}
              </p>
            </div>
            <a
              href={attachment.url}
              download={attachment.kind === "file" ? attachment.name : undefined}
              target="_blank"
              rel="noreferrer"
              className="rounded p-1 text-[var(--muted)] hover:text-white"
              aria-label={`Baixar ${attachment.name}`}
              title="Baixar"
            >
              <Download className="h-3.5 w-3.5" />
            </a>
            <button
              type="button"
              className="rounded p-1 text-[var(--muted)] hover:text-rose-300"
              onClick={() => void remove(attachment)}
              aria-label={`Remover ${attachment.name}`}
              title="Remover"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
        {attachments.length === 0 ? (
          <p className="text-xs text-[var(--muted)]">Nenhum arquivo anexado.</p>
        ) : null}
      </ul>
      <div
        className={`rounded-xl border border-dashed px-3 py-3 ${
          dragOver ? "border-[var(--accent)] bg-[var(--accent)]/10" : "border-[var(--line)]"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void uploadFiles(e.dataTransfer.files);
        }}
      >
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--line)] px-3 py-2 text-xs text-white hover:bg-white/5 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}
            {busy ? "Enviando…" : "Enviar arquivo"}
          </button>
          <p className="text-[11px] text-[var(--muted)]">
            Arraste aqui. Até {formatFileSize(MAX_ATTACHMENT_BYTES)} por arquivo.
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = e.target.files;
            e.target.value = "";
            if (files) void uploadFiles(files);
          }}
        />
      </div>
    </div>
  );
}
