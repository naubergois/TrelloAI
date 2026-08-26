type JangadaMood = "idle" | "thinking" | "happy";

const sizes = {
  sm: 28,
  md: 44,
  lg: 72,
} as const;

export function JangadaBuddy({
  size = "md",
  mood = "idle",
  title = "Jangadinha",
}: {
  size?: keyof typeof sizes | number;
  mood?: JangadaMood;
  title?: string;
}) {
  const px = typeof size === "number" ? size : sizes[size];
  const thinking = mood === "thinking";
  const happy = mood === "happy";

  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 96 100"
      role="img"
      aria-label={title}
      className={`jangada-buddy shrink-0 ${thinking ? "jangada-buddy-thinking" : ""} ${
        happy ? "jangada-buddy-happy" : ""
      }`}
    >
      <ellipse cx="48" cy="90" rx="34" ry="6" fill="#0b3d22" opacity="0.28" />
      <path
        d="M18 86c8 4 52 4 60 0 2-1 3 1 1 3-8 6-54 6-62 0-2-2-1-4 1-3Z"
        fill="#1d6b9a"
        opacity="0.55"
      />

      <path d="M48 14v46" stroke="#6B4C2F" strokeWidth="3.4" strokeLinecap="round" />
      <path
        d="M50 16 L50 54 L84 38 Z"
        fill="#FFD100"
        stroke="#e6bc00"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <circle cx="62" cy="36" r="3.2" fill="#00863B" />
      <path
        d="M62 33.4 62.7 35.4 64.9 35.6 63.2 37 63.7 39.1 62 37.9 60.3 39.1 60.8 37 59.1 35.6 61.3 35.4Z"
        fill="#FFD100"
      />

      <ellipse cx="48" cy="72" rx="40" ry="20" fill="#d9a066" />
      <ellipse cx="48" cy="74" rx="36" ry="16" fill="#c48a4a" />
      <path d="M16 72h64" stroke="#a56b32" strokeWidth="2" strokeLinecap="round" opacity="0.55" />
      <path d="M18 78h60" stroke="#8f5724" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
      <path d="M20 66h56" stroke="#f0c48a" strokeWidth="1.6" strokeLinecap="round" opacity="0.45" />

      <ellipse cx="28" cy="78" rx="5" ry="3.2" fill="#f4b4b4" opacity="0.85" />
      <ellipse cx="68" cy="78" rx="5" ry="3.2" fill="#f4b4b4" opacity="0.85" />

      <g className="jangada-eyes">
        <ellipse cx="34" cy="70" rx="11" ry="12.5" fill="#fffdf6" />
        <ellipse cx="62" cy="70" rx="11" ry="12.5" fill="#fffdf6" />
        <g className="jangada-pupils">
          <circle cx={thinking ? 37 : 35} cy={thinking ? 72 : 71} r="5.2" fill="#14301f" />
          <circle cx={thinking ? 65 : 63} cy={thinking ? 72 : 71} r="5.2" fill="#14301f" />
          <circle cx={thinking ? 35.2 : 33.2} cy={thinking ? 69.5 : 68.6} r="1.7" fill="#fff" />
          <circle cx={thinking ? 63.2 : 61.2} cy={thinking ? 69.5 : 68.6} r="1.7" fill="#fff" />
        </g>
        <path className="jangada-lids" d="M23 64h22" stroke="#c48a4a" strokeWidth="7" strokeLinecap="round" />
        <path className="jangada-lids" d="M51 64h22" stroke="#c48a4a" strokeWidth="7" strokeLinecap="round" />
      </g>

      {happy ? (
        <path
          d="M42 81c2.2 3.2 9.8 3.2 12 0"
          fill="none"
          stroke="#8f5724"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      ) : (
        <path
          d="M44 81c1.6 1.8 6.4 1.8 8 0"
          fill="none"
          stroke="#8f5724"
          strokeWidth="2"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}
