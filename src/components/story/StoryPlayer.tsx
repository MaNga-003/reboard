"use client";
// Kare dizisi oynatıcısı (D-004, STORY.md §4). Scroll ilerlemesi yapışkan bir canvas'ta kareye çevrilir; metin HTML'dir.
// Hesaplar sequence.ts'te; burada yalnızca ağ, çözme ve çizim var. Hareket azaltma tercihinde ve AVIF çözemeyen
// tarayıcıda her bölüm tek durağan kare (WebP yalnızca bunlarda var, D-004).
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { LruCache, coverRect, decodeWindow, frameAt, loadOrder, nearestLoaded, pickAspect, sectionOf, textOpacity, type Aspect } from "./sequence";
import type { StorySource, StoryVariant } from "./source";

const KEYS = ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8"] as const;
// Bölüm başına scroll uzunluğu (ekran yüksekliği): 30 kare ~1,2 ekranda akar; hızlı kaydırmada kare atlamaz.
const VH_PER_SECTION = 120;
const AHEAD = 8;
const BEHIND = 3;

const frameUrl = (aspect: Aspect, index: number, ext: "avif" | "webp") => `/story/${aspect}/f_${String(index).padStart(4, "0")}.${ext}`;

function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

const never = () => () => {};
/** Sunucu çiziminde ve hidrasyonun ilk geçişinde false. Yön ve hareket tercihi o anda henüz bilinmez;
 * oynatıcı ağa çıkarsa telefon yanlış diziyi istemeye başlar. */
function useHydrated(): boolean {
  return useSyncExternalStore(never, () => true, () => false);
}

/** saveData ya da 2G bağlantıda ilk bölüm dışındaki kareler birer atlanır. */
function lightMode(): boolean {
  const c = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  return !!c && (c.saveData === true || c.effectiveType === "2g" || c.effectiveType === "slow-2g");
}

/** Çözülmüş kare 1920×1080 RGBA ≈ 8 MB; düşük bellekli cihazda pencere küçülür ama çözme penceresinden büyük kalır. */
function cacheCapacity(): number {
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  return mem !== undefined && mem <= 4 ? AHEAD + BEHIND + 4 : 28;
}

// Safari'de requestIdleCallback yok.
const idle = (fn: () => void) =>
  typeof window.requestIdleCallback === "function" ? window.requestIdleCallback(fn, { timeout: 2000 }) : setTimeout(fn, 200);

function sectionsOf(v: StoryVariant, perSection: number): number[] {
  return [...new Set(v.indices.map((index) => sectionOf({ index }, perSection)))].sort((a, b) => a - b);
}

export function StoryPlayer({ source, headline, finale }: { source: StorySource; headline: ReactNode; finale: ReactNode }) {
  const t = useTranslations("story");
  const reduced = useMedia("(prefers-reduced-motion: reduce)");
  const portrait = useMedia("(orientation: portrait)");
  const hydrated = useHydrated();
  // Kimliği sabit: oynatıcı etkisine bağımlılık olarak gider, etki her çizimde yeniden kurulmaz.
  const [noAvif, setNoAvif] = useState(false);
  const aspect = pickAspect(portrait ? 9 : 16, portrait ? 16 : 9, Object.keys(source.variants) as Aspect[]);
  const variant = aspect ? source.variants[aspect] : undefined;
  // Kimliği sabit kalmalı: oynatıcının etkisi buna bağlı, her çizimde yeniden kurulmasın.
  const sections = useMemo(() => (variant ? sectionsOf(variant, source.framesPerSection) : []), [variant, source.framesPerSection]);
  if (!aspect || !variant) return null;

  const text = (s: number) => (s === 7 ? finale : <p className="text-lg leading-snug sm:text-xl">{t(`sections.${KEYS[s]}`)}</p>);

  if (reduced || noAvif) return <StaticStory aspect={aspect} variant={variant} perSection={source.framesPerSection} sections={sections} headline={headline} text={text} />;
  // Anahtar yok: hidrasyondan sonra 16:9'dan 9:16'ya geçişte poster (LCP öğesi) yeniden takılmasın; etki temizlenip yeniden kurulur.
  return (
    <Sequence
      aspect={aspect}
      variant={variant}
      perSection={source.framesPerSection}
      sections={sections}
      headline={headline}
      text={text}
      poster={<Poster variants={source.variants} />}
      active={hydrated}
      onUnsupported={setNoAvif}
    />
  );
}

/** İlk kare. Sunucu yönü bilmez; seçimi tarayıcı media ile yapar, böylece telefon yalnızca 9:16 kareyi indirir.
 * Yön sorgusu useMedia ile aynı: oynatıcı hangi diziyi seçerse poster de o dizinin ilk karesidir. */
function Poster({ variants }: { variants: StorySource["variants"] }) {
  const base: Aspect = variants.d ? "d" : "m";
  const first = (a: Aspect, ext: "avif" | "webp") => frameUrl(a, variants[a]!.indices[0], ext);
  const v = variants[base]!;
  return (
    <picture>
      {base === "d" && variants.m && <source media="(orientation: portrait)" srcSet={first("m", "avif")} type="image/avif" />}
      {base === "d" && variants.m && <source media="(orientation: portrait)" srcSet={first("m", "webp")} type="image/webp" />}
      <source srcSet={first(base, "avif")} type="image/avif" />
      {/* İlk kare LCP öğesidir: canvas hazır olana kadar görünür. next/image kare dizisinin önceden kodlanmış dosyalarını yeniden işlemesin diye düz img. */}
      <img src={first(base, "webp")} alt="" fetchPriority="high" width={v.width} height={v.height} className="absolute inset-0 h-full w-full object-cover" />
    </picture>
  );
}

type Props = {
  aspect: Aspect;
  variant: StoryVariant;
  perSection: number;
  sections: number[];
  headline: ReactNode;
  text: (section: number) => ReactNode;
};

function Card({ children }: { children: ReactNode }) {
  return <div className="max-w-xl rounded bg-bg/90 px-5 py-4 text-fg shadow-sm">{children}</div>;
}

function Sequence({
  aspect,
  variant,
  perSection,
  sections,
  headline,
  text,
  poster,
  active,
  onUnsupported,
}: Props & { poster: ReactNode; active: boolean; onUnsupported: (unsupported: boolean) => void }) {
  const t = useTranslations("story");
  const root = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const cards = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (!active) return;
    gsap.registerPlugin(ScrollTrigger);
    const el = canvas.current!;
    const ctx = el.getContext("2d")!;
    const count = variant.indices.length;
    const blobs: (Blob | null)[] = Array(count).fill(null);
    const loaded = new Set<number>();
    const cache = new LruCache<ImageBitmap>(cacheCapacity());
    const abort = new AbortController();
    let current = 0;
    let drawn = -1;
    let dir: 1 | -1 = 1;
    let decoding = false;
    let disposed = false;

    const draw = (i: number) => {
      const bmp = cache.get(i);
      if (!bmp) return;
      const r = coverRect(bmp.width, bmp.height, el.width, el.height);
      ctx.drawImage(bmp, r.x, r.y, r.w, r.h);
      drawn = i;
      // Testler çizilen kareyi buradan okur (story.spec, story-perf).
      el.dataset.frame = String(i);
    };

    // Önce şu anki kareye en yakın yüklü kare; o çözülmediyse çözülmüşlerin en yakını çizilir, boş kare kalmaz.
    const render = () => {
      const want = nearestLoaded(current, loaded, count);
      const ready = cache.has(want) ? want : nearestLoaded(current, cache, count);
      if (ready >= 0 && ready !== drawn) draw(ready);
      void pump();
    };

    const pump = async () => {
      if (decoding) return;
      decoding = true;
      try {
        while (!disposed) {
          const next = [...new Set(decodeWindow(current, count, AHEAD, BEHIND, dir).map((i) => nearestLoaded(i, loaded, count)))].find(
            (i) => i >= 0 && !cache.has(i),
          );
          if (next === undefined) break;
          const bmp = await createImageBitmap(blobs[next]!);
          if (disposed) return bmp.close();
          cache.set(next, bmp);
          if (next === nearestLoaded(current, loaded, count)) draw(next);
        }
      } finally {
        decoding = false;
      }
    };

    const fetchFrame = async (i: number) => {
      const res = await fetch(frameUrl(aspect, variant.indices[i], "avif"), { signal: abort.signal });
      if (!res.ok) throw new Error(`${res.status}`);
      blobs[i] = await res.blob();
      loaded.add(i);
      // story-perf ağı ölçmemek için bütün kareler inene kadar bekler.
      el.dataset.loaded = String(loaded.size);
    };

    const load = async () => {
      // AVIF desteği ilk kareyi çözerek sınanır; çözülemezse statik hikâyeye geçilir. Dizinin WebP kopyası yok:
      // aynı kalitede 1,7–2,4 kat büyük, yayın paketini 100 MB sınırının üstüne taşırdı (D-004).
      try {
        await fetchFrame(0);
        cache.set(0, await createImageBitmap(blobs[0]!));
      } catch {
        if (!abort.signal.aborted) onUnsupported(true);
        return;
      }
      render();
      const frames = variant.indices.map((index) => ({ index }));
      const order = loadOrder(frames, perSection, lightMode()).filter((i) => i !== 0);
      const first = order.filter((i) => sectionOf(frames[i], perSection) === sections[0]);
      const rest = order.slice(first.length);
      const run = async (list: number[], workers: number) => {
        let k = 0;
        await Promise.all(
          Array.from({ length: workers }, async () => {
            while (k < list.length && !disposed) {
              const i = list[k++];
              await fetchFrame(i).catch(() => undefined);
              if (Math.abs(i - current) <= AHEAD) render();
            }
          }),
        );
      };
      await run(first, 4);
      if (!disposed) idle(() => void run(rest, 3));
    };

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      el.width = Math.round(el.clientWidth * dpr);
      el.height = Math.round(el.clientHeight * dpr);
      drawn = -1;
      render();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    const n = sections.length;
    const state = { p: 0 };
    const update = () => {
      const i = frameAt(state.p, count);
      if (i !== current) dir = i > current ? 1 : -1;
      current = i;
      render();
      cards.current.forEach((c, k) => {
        if (!c) return;
        const o = textOpacity(state.p, k, n);
        c.style.opacity = String(o);
        // Görünmeyen kart tıklanmaz ve ekran okuyucuda sıradaki metni gölgelemez.
        c.style.visibility = o > 0 ? "visible" : "hidden";
      });
    };
    const tween = gsap.to(state, {
      p: 1,
      ease: "none",
      onUpdate: update,
      scrollTrigger: { trigger: root.current, start: "top top", end: "bottom bottom", scrub: 0.35 },
    });
    update();
    void load().catch(() => undefined);

    return () => {
      disposed = true;
      abort.abort();
      ro.disconnect();
      tween.scrollTrigger?.kill();
      tween.kill();
      cache.clear();
    };
  }, [active, aspect, variant, perSection, sections, onUnsupported]);

  return (
    <section ref={root} aria-label={t("label")} className="relative" style={{ height: `${sections.length * VH_PER_SECTION}svh` }}>
      <a href="#after-story" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-20 focus:rounded focus:bg-bg focus:px-4 focus:py-2">
        {t("skip")}
      </a>
      <div className="sticky top-0 h-svh w-full overflow-hidden">
        {poster}
        <canvas ref={canvas} aria-hidden className="absolute inset-0 h-full w-full" />
        <div className="absolute inset-x-0 bottom-0 grid p-4 sm:p-10">
          {sections.map((s, k) => (
            <div
              key={s}
              ref={(c) => {
                cards.current[k] = c;
              }}
              className="col-start-1 row-start-1 self-end"
              style={{ opacity: k === 0 ? 1 : 0, visibility: k === 0 ? "visible" : "hidden" }}
            >
              <Card>
                {k === 0 && headline}
                {text(s)}
              </Card>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Hareket azaltma ve AVIF'siz tarayıcı: her bölümün durağan karesi (ortadaki kare) ve metni, alt alta, düz akışta. */
function StaticStory({ aspect, variant, perSection, sections, headline, text }: Props) {
  const t = useTranslations("story");
  return (
    <section aria-label={t("label")} className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-10">
      {sections.map((s, k) => {
        const mid = variant.stills.find((index) => sectionOf({ index }, perSection) === s);
        if (mid === undefined) return null;
        return (
          <figure key={s} className="flex flex-col gap-3">
            <picture>
              <source srcSet={frameUrl(aspect, mid, "avif")} type="image/avif" />
              <img
                src={frameUrl(aspect, mid, "webp")}
                alt=""
                loading={k === 0 ? "eager" : "lazy"}
                width={variant.width}
                height={variant.height}
                className="h-auto w-full rounded"
              />
            </picture>
            <figcaption>
              {k === 0 && headline}
              {text(s)}
            </figcaption>
          </figure>
        );
      })}
    </section>
  );
}
