type AkibaLogoProps = {
  compact?: boolean;
  invert?: boolean;
  className?: string;
};

export function AkibaLogo({ compact = false, invert = false, className = "" }: AkibaLogoProps) {
  const textColor = invert ? "#F8F5EE" : "#123D32";

  return (
    <div className={`akiba-logo ${compact ? "compact" : ""} ${className}`.trim()}>
      <svg
        className="akiba-mark"
        viewBox="0 0 120 120"
        aria-hidden="true"
        role="img"
      >
        <defs>
          <linearGradient id="akiba-gradient" x1="0%" x2="100%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="#E5B75C" />
            <stop offset="100%" stopColor="#C7923A" />
          </linearGradient>
        </defs>
        <rect x="10" y="10" width="100" height="100" rx="28" fill={invert ? "#F8F5EE" : "#123D32"} />
        <path
          d="M38 84L60 30L82 84"
          fill="none"
          stroke={invert ? "#123D32" : "#F8F5EE"}
          strokeWidth="10"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M48 64H72"
          fill="none"
          stroke="url(#akiba-gradient)"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <path
          d="M30 84C45 62 48 52 60 52C72 52 75 62 90 84"
          fill="none"
          stroke={invert ? "#123D32" : "#F8F5EE"}
          strokeWidth="7"
          strokeLinecap="round"
          opacity="0.92"
        />
      </svg>

      {!compact ? (
        <span className="akiba-wordmark" style={{ color: textColor }}>
          Akiba
        </span>
      ) : null}
    </div>
  );
}
