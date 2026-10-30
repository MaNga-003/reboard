/** Marka işareti: üst üste üç panel katmanı. Üst katman currentColor; koyu yüzeyde açık, açık yüzeyde koyu olur. */
export function BrandMark({ className = "size-8" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 32 32" className={className} fill="none">
      <rect x="2" y="17" width="22" height="12" rx="3.5" fill="var(--rb-glow)" />
      <rect x="5" y="10" width="22" height="12" rx="3.5" fill="var(--rb-brand)" />
      <rect x="8" y="3" width="22" height="12" rx="3.5" fill="currentColor" />
    </svg>
  );
}

export function Wordmark({ children }: { children: string }) {
  return <span className="font-display text-xl leading-none tracking-tight">{children}</span>;
}
