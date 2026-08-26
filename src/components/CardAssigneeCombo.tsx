"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Search, UserPlus } from "lucide-react";
import type { TeamMember } from "@/lib/types";
import { MemberAvatar } from "@/components/MemberAvatar";
import { isExternalMember } from "@/lib/members";

const FACE_MAX = 3;

function filterMembers(members: TeamMember[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return members;
  return members.filter((member) => {
    const hay = `${member.name} ${member.email}`.toLowerCase();
    return hay.includes(q);
  });
}

function AssigneeRow({
  member,
  selected,
  onToggle,
}: {
  member: TeamMember;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onToggle}
      className="flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left hover:bg-white/8"
    >
      <span
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
          selected
            ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-on)]"
            : "border-white/25 bg-transparent"
        }`}
      >
        {selected ? <Check className="h-3 w-3" /> : null}
      </span>
      <MemberAvatar member={member} size="sm" className="ring-1 ring-black/20" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-white">{member.name}</span>
        {member.email ? (
          <span className="block truncate text-[10px] text-[var(--muted)]">
            {member.email}
          </span>
        ) : null}
      </span>
      {isExternalMember(member) ? (
        <span className="shrink-0 rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] text-[var(--muted)]">
          externo
        </span>
      ) : null}
    </button>
  );
}

export function CardAssigneeCombo({
  selectedIds,
  team,
  external,
  members,
  onChange,
  disabled,
  variant = "card",
}: {
  selectedIds: string[];
  team: TeamMember[];
  external: TeamMember[];
  members: Record<string, TeamMember>;
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  variant?: "card" | "form";
}) {
  const listId = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 272, openUp: false });

  const selected = useMemo(
    () => selectedIds.map((id) => members[id]).filter(Boolean),
    [selectedIds, members],
  );
  const teamMatches = filterMembers(team, query);
  const externalMatches = filterMembers(external, query);
  const empty = teamMatches.length === 0 && externalMatches.length === 0;
  const shown = selected.slice(0, FACE_MAX);
  const extra = Math.max(0, selected.length - FACE_MAX);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const place = () => {
      const el = triggerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const width = Math.min(Math.max(rect.width, 272), 340);
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUp = spaceBelow < 280 && rect.top > 280;
      let left = rect.left;
      if (left + width > window.innerWidth - 8) {
        left = Math.max(8, window.innerWidth - width - 8);
      }
      setPos({
        top: openUp ? rect.top - 8 : rect.bottom + 8,
        left,
        width,
        openUp,
      });
    };
    place();
    const t = window.setTimeout(() => searchRef.current?.focus(), 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
    };
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  const toggle = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((item) => item !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const names = selected.map((m) => m.name).join(", ");
  const triggerLabel = selected.length
    ? `Responsáveis: ${names}. Alterar`
    : "Atribuir responsáveis";

  const panel =
    open && mounted
      ? createPortal(
          <div
            ref={panelRef}
            id={listId}
            role="listbox"
            aria-multiselectable="true"
            aria-label="Pessoas do time"
            className="fixed z-[240] overflow-hidden rounded-2xl border border-white/15 bg-[#102818]/98 shadow-2xl shadow-black/40 backdrop-blur-md"
            style={{
              top: pos.openUp ? undefined : pos.top,
              bottom: pos.openUp ? window.innerHeight - pos.top : undefined,
              left: pos.left,
              width: pos.width,
            }}
          >
            <div className="relative border-b border-white/10">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted)]" />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar no time…"
                className="w-full bg-transparent py-2.5 pl-8 pr-3 text-sm text-white outline-none placeholder:text-[var(--muted)]"
              />
            </div>
            <div className="board-scroll max-h-64 overflow-y-auto p-1.5">
              {teamMatches.length > 0 ? (
                <div>
                  <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                    Time
                  </p>
                  {teamMatches.map((member) => (
                    <AssigneeRow
                      key={member.id}
                      member={member}
                      selected={selectedIds.includes(member.id)}
                      onToggle={() => toggle(member.id)}
                    />
                  ))}
                </div>
              ) : null}
              {externalMatches.length > 0 ? (
                <div>
                  <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                    Externos
                  </p>
                  {externalMatches.map((member) => (
                    <AssigneeRow
                      key={member.id}
                      member={member}
                      selected={selectedIds.includes(member.id)}
                      onToggle={() => toggle(member.id)}
                    />
                  ))}
                </div>
              ) : null}
              {empty ? (
                <p className="px-3 py-4 text-center text-xs text-[var(--muted)]">
                  {team.length + external.length === 0
                    ? "Ninguém no time deste board ainda."
                    : "Nenhuma pessoa encontrada."}
                </p>
              ) : null}
            </div>
          </div>,
          document.body,
        )
      : null;

  const face = (
    <span className="flex items-center">
      {shown.map((member, index) => (
        <span
          key={member.id}
          className={index === 0 ? "" : "-ml-1.5"}
          style={{ zIndex: shown.length - index }}
          title={member.name}
        >
          <MemberAvatar
            member={member}
            size={variant === "form" ? "md" : "sm"}
            className="ring-2 ring-white"
          />
        </span>
      ))}
      {extra > 0 ? (
        <span
          className="-ml-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-slate-700 text-[10px] font-semibold text-white ring-2 ring-white"
          title={selected
            .slice(FACE_MAX)
            .map((m) => m.name)
            .join(", ")}
        >
          +{extra}
        </span>
      ) : null}
      {selected.length === 0 ? (
        <span
          className={`flex items-center justify-center rounded-full border border-dashed border-black/20 bg-white/70 text-slate-500 ${
            variant === "form" ? "h-8 w-8" : "h-6 w-6"
          }`}
        >
          <UserPlus className={variant === "form" ? "h-4 w-4" : "h-3.5 w-3.5"} />
        </span>
      ) : (
        <span
          className={`-ml-1 flex items-center justify-center rounded-full border border-black/10 bg-white/90 text-slate-500 ${
            variant === "form" ? "h-8 w-8" : "h-6 w-6"
          }`}
        >
          <UserPlus className={variant === "form" ? "h-3.5 w-3.5" : "h-3 w-3"} />
        </span>
      )}
    </span>
  );

  if (variant === "form") {
    return (
      <div className="block text-xs text-[var(--muted)] sm:text-sm">
        Responsáveis
        <button
          ref={triggerRef}
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-label={triggerLabel}
          onClick={() => setOpen((value) => !value)}
          className="mt-1.5 flex w-full items-center justify-between gap-3 rounded-2xl border border-[var(--line)] bg-[var(--ink)] px-3 py-2.5 text-left outline-none hover:border-[var(--accent)]/50 focus:border-[var(--accent)] disabled:opacity-50"
        >
          <span className="flex min-w-0 items-center gap-2">
            {face}
            <span className="min-w-0 truncate text-sm text-white">
              {selected.length
                ? names
                : "Escolher pessoas do time"}
            </span>
          </span>
        </button>
        {selected.length > 0 ? (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {selected.map((member) => (
              <li key={member.id}>
                <button
                  type="button"
                  title={`Remover ${member.name}`}
                  onClick={() => toggle(member.id)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 py-0.5 pl-0.5 pr-2 text-xs text-white hover:border-rose-300/40 hover:text-rose-100"
                >
                  <MemberAvatar member={member} size="xs" />
                  {member.name.split(" ")[0]}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {panel}
      </div>
    );
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={triggerLabel}
        title={triggerLabel}
        onClick={() => setOpen((value) => !value)}
        onPointerDown={(e) => e.stopPropagation()}
        className="inline-flex max-w-full cursor-pointer items-center rounded-full p-0.5 hover:bg-black/5 disabled:cursor-default disabled:opacity-60"
      >
        {face}
      </button>
      {panel}
    </>
  );
}
