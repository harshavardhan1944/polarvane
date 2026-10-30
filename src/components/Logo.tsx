export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <span
      className="brand-gradient inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size, borderRadius: size * 0.28 }}
    >
      {/* A stylised vane: a needle pointing north-east over a ring */}
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
        <circle cx="16" cy="16" r="8.5" fill="none" stroke="white" strokeOpacity="0.35" strokeWidth="1.5" />
        <path d="M22.5 9.5 L17.2 17.2 L14.8 14.8 Z" fill="white" />
        <path d="M9.5 22.5 L14.8 14.8 L17.2 17.2 Z" fill="white" fillOpacity="0.45" />
      </svg>
    </span>
  );
}

export function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark />
      <span className="font-display text-[23px] leading-none">Polarvane</span>
    </div>
  );
}
