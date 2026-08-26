"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ExternalLink,
  MessageCircle,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useBoardStore } from "@/lib/store";
import type { BoardWhatsAppGroup } from "@/lib/types";
import {
  sanitizeWhatsAppInviteUrl,
  sanitizeWhatsAppJid,
} from "@/lib/whatsapp-groups";

type Draft = {
  name: string;
  inviteUrl: string;
  jid: string;
  notes: string;
};

const EMPTY_DRAFT: Draft = { name: "", inviteUrl: "", jid: "", notes: "" };

function groupToDraft(group: BoardWhatsAppGroup): Draft {
  return {
    name: group.name,
    inviteUrl: group.inviteUrl || "",
    jid: group.jid || "",
    notes: group.notes || "",
  };
}

function draftToInput(draft: Draft) {
  return {
    name: draft.name.trim(),
    inviteUrl: draft.inviteUrl.trim() || null,
    jid: draft.jid.trim() || null,
    notes: draft.notes.trim(),
  };
}

function draftError(draft: Draft): string | null {
  const hasName = Boolean(draft.name.trim());
  const hasUrl = Boolean(draft.inviteUrl.trim());
  const hasJid = Boolean(draft.jid.trim());
  if (!hasName && !hasUrl && !hasJid) {
    return "Informe o nome, o link de convite ou o JID do grupo.";
  }
  if (hasUrl && !sanitizeWhatsAppInviteUrl(draft.inviteUrl)) {
    return "O convite precisa ser um link https://chat.whatsapp.com/…";
  }
  if (hasJid && !sanitizeWhatsAppJid(draft.jid)) {
    return "O JID deve ser no formato 1203…@g.us.";
  }
  return null;
}

export function WhatsAppGroupsPanel({
  boardId,
  onClose,
}: {
  boardId: string;
  onClose: () => void;
}) {
  const board = useBoardStore((s) => s.boards[boardId]);
  const addBoardWhatsAppGroup = useBoardStore((s) => s.addBoardWhatsAppGroup);
  const updateBoardWhatsAppGroup = useBoardStore((s) => s.updateBoardWhatsAppGroup);
  const removeBoardWhatsAppGroup = useBoardStore((s) => s.removeBoardWhatsAppGroup);

  const groups = useMemo(
    () => board?.whatsappGroups || [],
    [board?.whatsappGroups],
  );

  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setError(null);
  }, [boardId]);

  if (!board) return null;

  const startCreate = () => {
    setEditingId("new");
    setDraft(EMPTY_DRAFT);
    setError(null);
  };

  const startEdit = (group: BoardWhatsAppGroup) => {
    setEditingId(group.id);
    setDraft(groupToDraft(group));
    setError(null);
  };

  const cancel = () => {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setError(null);
  };

  const save = (e: FormEvent) => {
    e.preventDefault();
    const problem = draftError(draft);
    if (problem) {
      setError(problem);
      return;
    }
    const input = draftToInput(draft);
    if (editingId && editingId !== "new") {
      const ok = updateBoardWhatsAppGroup(boardId, editingId, input);
      if (!ok) {
        setError("Não foi possível salvar. Confira o link/JID e se já não existe outro grupo igual.");
        return;
      }
    } else {
      const id = addBoardWhatsAppGroup(boardId, input);
      if (!id) {
        setError("Não foi possível incluir o grupo. Informe nome, convite ou JID válidos.");
        return;
      }
    }
    cancel();
  };

  const remove = (group: BoardWhatsAppGroup) => {
    if (!confirm(`Excluir o grupo "${group.name}" deste board?`)) return;
    removeBoardWhatsAppGroup(boardId, group.id);
    if (editingId === group.id) cancel();
  };

  return (
    <aside className="anim-rise panel-glass flex h-full min-h-0 w-full flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--line)] px-4 py-3">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-[var(--accent)]" />
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-lg text-white">
              Grupos WhatsApp
            </h2>
            <p className="text-[11px] text-[var(--muted)]">
              Links e metadados vinculados a {board.title}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-[var(--line)] p-2 text-[var(--muted)] hover:text-white"
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="board-scroll min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {groups.length === 0 && editingId !== "new" ? (
          <p className="rounded-2xl border border-dashed border-[var(--line)] px-3 py-4 text-sm text-[var(--muted)]">
            Nenhum grupo vinculado. Inclua o convite, o nome e o JID (1203…@g.us) deste board.
          </p>
        ) : null}

        {groups.map((group) =>
          editingId === group.id ? (
            <GroupForm
              key={group.id}
              draft={draft}
              error={error}
              submitLabel="Salvar"
              onChange={setDraft}
              onSubmit={save}
              onCancel={cancel}
            />
          ) : (
            <article
              key={group.id}
              className="rounded-2xl border border-[var(--line)] bg-black/20 px-3 py-2.5"
            >
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">{group.name}</p>
                  {group.jid ? (
                    <p className="mt-0.5 truncate font-mono text-[11px] text-[var(--muted)]">
                      {group.jid}
                    </p>
                  ) : null}
                  {group.notes ? (
                    <p className="mt-1 text-xs text-[var(--muted)]">{group.notes}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 gap-1">
                  {group.inviteUrl ? (
                    <a
                      href={group.inviteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg p-1.5 text-[var(--muted)] hover:text-white"
                      title="Abrir convite"
                      aria-label={`Abrir convite de ${group.name}`}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => startEdit(group)}
                    className="rounded-lg p-1.5 text-[var(--muted)] hover:text-white"
                    aria-label={`Editar ${group.name}`}
                    title="Editar"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(group)}
                    className="rounded-lg p-1.5 text-[var(--muted)] hover:text-rose-300"
                    aria-label={`Excluir ${group.name}`}
                    title="Excluir"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              {group.inviteUrl ? (
                <p className="mt-1 truncate text-[11px] text-[var(--accent)]">{group.inviteUrl}</p>
              ) : null}
            </article>
          ),
        )}

        {editingId === "new" ? (
          <GroupForm
            draft={draft}
            error={error}
            submitLabel="Incluir"
            onChange={setDraft}
            onSubmit={save}
            onCancel={cancel}
          />
        ) : (
          <button
            type="button"
            onClick={startCreate}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-[var(--line)] px-3 py-2.5 text-sm text-[var(--muted)] hover:border-[var(--accent)]/40 hover:text-white"
          >
            <Plus className="h-4 w-4" />
            Incluir grupo
          </button>
        )}
      </div>
    </aside>
  );
}

function GroupForm({
  draft,
  error,
  submitLabel,
  onChange,
  onSubmit,
  onCancel,
}: {
  draft: Draft;
  error: string | null;
  submitLabel: string;
  onChange: (draft: Draft) => void;
  onSubmit: (e: FormEvent) => void;
  onCancel: () => void;
}) {
  const field =
    "mt-1 w-full rounded-xl border border-[var(--line)] bg-[var(--ink)] px-3 py-2 text-sm text-white outline-none focus:border-[var(--accent)]";
  return (
    <form
      onSubmit={onSubmit}
      className="space-y-2 rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent)]/5 p-3"
    >
      <label className="block text-[11px] text-[var(--muted)]">
        Nome do grupo
        <input
          value={draft.name}
          onChange={(e) => onChange({ ...draft, name: e.target.value })}
          placeholder="Grupo WhatsApp ASESI"
          className={field}
        />
      </label>
      <label className="block text-[11px] text-[var(--muted)]">
        Link de convite
        <input
          value={draft.inviteUrl}
          onChange={(e) => onChange({ ...draft, inviteUrl: e.target.value })}
          placeholder="https://chat.whatsapp.com/…"
          className={field}
        />
      </label>
      <label className="block text-[11px] text-[var(--muted)]">
        JID do grupo
        <input
          value={draft.jid}
          onChange={(e) => onChange({ ...draft, jid: e.target.value })}
          placeholder="120363430202949653@g.us"
          className={`${field} font-mono text-xs`}
        />
      </label>
      <label className="block text-[11px] text-[var(--muted)]">
        Notas
        <textarea
          value={draft.notes}
          onChange={(e) => onChange({ ...draft, notes: e.target.value })}
          placeholder="Para que serve este grupo neste board"
          rows={2}
          className={field}
        />
      </label>
      {error ? (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          className="flex-1 rounded-xl bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-[var(--accent-on)]"
        >
          {submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-[var(--line)] px-3 py-2 text-sm text-[var(--muted)] hover:text-white"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
