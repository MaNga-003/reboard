// Ortak arayüz sınıfları (T4.8): düğme, kart ve başlık biçimleri tek yerde. Renkler yalnızca tokenlardan gelir (D-014).
// Dokunma hedefi en az 44 px (min-h-11, M-12).

export const btn = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition-colors disabled:opacity-60";
export const btnPrimary = `${btn} bg-brand text-on-brand shadow-sm hover:brightness-110`;
export const btnSecondary = `${btn} border border-line-strong bg-surface text-ink hover:bg-canvas`;
/** Koyu yüzeyin üstünde (aurora): açık dolgu, koyu yazı. */
export const btnLight = `${btn} bg-side-ink text-ink hover:bg-side-ink/90`;
export const btnOutlineLight = `${btn} border border-side-ink/50 text-side-ink hover:bg-side-active`;

export const card = "rounded-2xl border border-line bg-surface shadow-card";
export const cardPad = `${card} p-5 sm:p-6`;

export const eyebrow = "text-xs font-semibold uppercase tracking-[0.14em] text-subtle";
export const h1 = "text-3xl font-semibold tracking-tight text-ink sm:text-4xl";
export const h2 = "text-xl font-semibold tracking-tight text-ink";
export const lead = "max-w-prose text-base leading-relaxed text-muted";
export const link = "font-semibold text-brand underline-offset-4 hover:underline";
export const note = "rounded-xl border border-line bg-canvas px-4 py-3 text-sm text-muted";
export const alertBox = "rounded-xl border-2 border-danger bg-surface px-4 py-3 text-ink";

/** Sayfa gövdesi: kenar çubuğunun yanında geniş sütun. Boşluk (gap-*) sayfaya göre eklenir. */
export const page = "mx-auto grid w-full max-w-6xl flex-1 content-start px-4 py-8 sm:px-6 lg:py-10";

/** Hikâyenin render edilmiş kareleri (public/story/d): arayüzde görsel olarak yeniden kullanılır. */
export const STILL = {
  fibre: "/story/d/f_0015.webp",
  fabric: "/story/d/f_0045.webp",
  scraps: "/story/d/f_0075.webp",
  weighing: "/story/d/f_0105.webp",
  shredding: "/story/d/f_0135.webp",
  press: "/story/d/f_0165.webp",
  room: "/story/d/f_0195.webp",
  earth: "/story/d/f_0225.webp",
} as const;
export type StillName = keyof typeof STILL;
