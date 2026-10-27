import type { Level } from "@/domain/supply";

const CHIP: Record<Level, string> = {
  ok: "bg-ok text-on-ok",
  warn: "bg-warn text-on-warn",
  danger: "bg-danger text-on-danger",
};

/** Durum hiçbir zaman yalnızca renkle anlatılmaz: simge + yazı + renk. Kenarlık metin renginde; açık dolgu zemine 3:1 tutmaz. */
export function StatusChip({ level, label }: { level: Level; label: string }) {
  return (
    <span data-level={level} className={`inline-flex items-center gap-1 rounded-full border border-fg px-2 text-sm font-semibold leading-6 ${CHIP[level]}`}>
      <StatusIcon level={level} />
      {label}
    </span>
  );
}

export function StatusIcon({ level }: { level: Level }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      {level === "ok" && (
        <>
          <circle cx="8" cy="8" r="6.25" />
          <path d="M5.2 8.3l1.9 1.9 3.8-4.2" />
        </>
      )}
      {level === "warn" && (
        <>
          <path d="M8 1.9l6.4 11.6H1.6z" />
          <path d="M8 6.4v3.3M8 11.6v.01" />
        </>
      )}
      {level === "danger" && (
        <>
          <path d="M5.4 1.6h5.2l3.8 3.8v5.2l-3.8 3.8H5.4l-3.8-3.8V5.4z" />
          <path d="M6 6l4 4M10 6l-4 4" />
        </>
      )}
    </svg>
  );
}
