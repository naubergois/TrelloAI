type BrandMarkProps = {
  size?: "sm" | "md" | "lg";
  subtitle?: string;
  stacked?: boolean;
};

const sizes = {
  sm: { mark: 28, title: "text-lg", gap: "gap-2" },
  md: { mark: 36, title: "text-xl sm:text-2xl", gap: "gap-2.5" },
  lg: { mark: 52, title: "text-3xl sm:text-4xl", gap: "gap-3" },
};

/** Marca Jangada com estrela e verde da bandeira do Ceará. */
export function BrandMark({ size = "md", subtitle, stacked = false }: BrandMarkProps) {
  const s = sizes[size];
  return (
    <div className={`flex min-w-0 items-center ${s.gap} ${stacked ? "flex-col text-center" : ""}`}>
      <CearaMark size={s.mark} />
      <div className="min-w-0">
        <p
          className={`font-[family-name:var(--font-display)] leading-none tracking-tight text-white ${s.title}`}
        >
          Jangada
        </p>
        {subtitle ? (
          <p className="mt-1 truncate text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--ce-gold)] max-[380px]:hidden">
            {subtitle}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function CearaMark({ size = 36 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      aria-hidden="true"
      className="shrink-0 drop-shadow-[0_2px_6px_rgba(0,0,0,0.35)]"
    >
      <rect width="48" height="48" rx="12" fill="#00863B" />
      <circle cx="24" cy="16" r="7" fill="#FFD100" />
      <path
        d="M24 10.5 25.6 14.8 30.2 15.2 26.7 18.2 27.8 22.7 24 20.4 20.2 22.7 21.3 18.2 17.8 15.2 22.4 14.8Z"
        fill="#00863B"
      />
      <path d="M8 36.5h32" stroke="#F4E6C3" strokeWidth="1.4" strokeLinecap="round" />
      <path
        d="M12 36.2 24 22.5 36 36.2"
        fill="none"
        stroke="#F8F4E8"
        strokeWidth="2.1"
        strokeLinejoin="round"
      />
      <path d="M24 22.5V36.2" stroke="#FFD100" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M16.5 36.2h15" stroke="#6B4C2F" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}
