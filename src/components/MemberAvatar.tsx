"use client";

import { useRef } from "react";
import { Camera } from "lucide-react";
import type { TeamMember } from "@/lib/types";
import { labelStyles } from "@/lib/utils";
import { compressMemberPhoto } from "@/lib/compress-image";

const SIZE: Record<"xs" | "sm" | "md" | "lg", string> = {
  xs: "h-4 w-4 text-[8px]",
  sm: "h-6 w-6 text-[10px]",
  md: "h-8 w-8 text-xs",
  lg: "h-10 w-10 text-sm",
};

export function MemberAvatar({
  member,
  size = "md",
  className = "",
}: {
  member: Pick<TeamMember, "name" | "color" | "image">;
  size?: keyof typeof SIZE;
  className?: string;
}) {
  const initial = (member.name || "?").slice(0, 1).toUpperCase();
  const cls = `${SIZE[size]} ${className}`;
  if (member.image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={member.image}
        alt=""
        className={`shrink-0 rounded-full object-cover ${cls}`}
        referrerPolicy="no-referrer"
      />
    );
  }
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full font-bold ${labelStyles[member.color]} ${cls}`}
    >
      {initial}
    </span>
  );
}

export function MemberPhotoButton({
  member,
  onChange,
  size = "md",
  label = "Trocar foto",
}: {
  member: Pick<TeamMember, "name" | "color" | "image">;
  onChange: (dataUrl: string) => void;
  size?: keyof typeof SIZE;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const dataUrl = await compressMemberPhoto(file);
    if (dataUrl) onChange(dataUrl);
  };

  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={() => inputRef.current?.click()}
      className="relative shrink-0 rounded-full"
    >
      <MemberAvatar member={member} size={size} />
      <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--accent-on)] ring-2 ring-[var(--panel)]">
        <Camera className="h-2.5 w-2.5" />
      </span>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          void onFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </button>
  );
}

export function PhotoFileButton({
  onChange,
  preview,
  label = "Foto",
}: {
  onChange: (dataUrl: string | null) => void;
  preview?: string | null;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--line)] px-3 py-2 text-xs text-[var(--muted)] hover:text-white"
      >
        <Camera className="h-3.5 w-3.5" />
        {preview ? "Trocar foto" : label}
      </button>
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="" className="h-8 w-8 rounded-full object-cover" />
      ) : null}
      {preview ? (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="text-[11px] text-[var(--muted)] hover:text-rose-300"
        >
          Remover
        </button>
      ) : null}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          void compressMemberPhoto(file).then((dataUrl) => {
            if (dataUrl) onChange(dataUrl);
          });
        }}
      />
    </div>
  );
}
