// Kare dizisi oynatıcısının saf hesapları (STORY.md §4). DOM ve ağ yok; birim testli.

export type Aspect = "d" | "m";

/** Her kare AVIF'tir; WebP yalnızca posterde ve bölümlerin durağan karesinde vardır (D-004). ssim: kendi PNG'sine karşı. */
export type ManifestFrame = {
  index: number;
  avif: string;
  webp: string | null;
  quality: number;
  ssim: number;
  bytes: { avif: number; webp: number | null };
};
export type ManifestVariant = { width: number; height: number; step: number; ssimTarget: number; stills: number[]; frames: ManifestFrame[] };
export type Manifest = { framesPerSection: number; sections: number; variants: Partial<Record<Aspect, ManifestVariant>> };

/** Dikey ya da dar ekranda 9:16 dizisi; yoksa eldeki öteki dizi. */
export function pickAspect(width: number, height: number, available: readonly Aspect[]): Aspect | null {
  const want: Aspect = height > width ? "m" : "d";
  return available.includes(want) ? want : (available[0] ?? null);
}

/**
 * Yapışkan alanın scroll ilerlemesi (0–1): üst kenarı ekranın üstüne değince 0, alt kenarı yapışkan kabın altına değince 1.
 * top, alanın getBoundingClientRect().top'u; viewport, yapışkan kabın yüksekliği (svh: adres çubuğu oynayınca kaymaz).
 */
export function scrollProgress(top: number, height: number, viewport: number): number {
  const span = height - viewport;
  return span > 0 ? Math.min(1, Math.max(0, -top / span)) : 0;
}

/**
 * gsap ScrollTrigger scrub'ının eğrisi: gsap 3.15'in "expo"su (expo.out). Ders kitabındaki 1 − 2^(−10k) değil; gsap uçları
 * tam 0 ve 1'e oturtan bir terim ekler (gsap.js, _insertEase("Expo")) ve fark kare aralığı kadar büyür (k=0,1'de 0,003).
 * k: geçen süre ÷ yumuşatma süresi.
 */
export function expoOut(k: number): number {
  if (k <= 0) return 0;
  if (k >= 1) return 1;
  const q = 1 - k;
  return 1 - (2 ** (-10 * k) * q + q ** 6 * k);
}

/** Yumuşatılan ilerleme: `at` anında `from`'dan `to`'ya giden tek eğri. */
export type Scrub = { from: number; to: number; at: number };

/** Süre dolunca tam hedef: kayan nokta 1'in altında kalıp son kareyi kaçırmasın. */
export function scrubAt(s: Scrub, now: number, duration: number): number {
  const k = (now - s.at) / duration;
  return k >= 1 ? s.to : s.from + (s.to - s.from) * expoOut(k);
}

/** Hedef değişince eğri o anki değerden yeniden başlar (ScrollTrigger'daki resetTo); hedef aynıysa eğri sürer. */
export function retarget(s: Scrub, to: number, now: number, duration: number): Scrub {
  return to === s.to ? s : { from: scrubAt(s, now, duration), to, at: now };
}

/** Scroll ilerlemesi (0–1) → dizideki sıra. Uçlar kenetlenir; NaN ilk kareye düşer. */
export function frameAt(progress: number, count: number): number {
  if (count <= 0) return -1;
  const p = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0;
  return Math.round(p * (count - 1));
}

/** Dizideki sıranın bölümü (0'dan). Mobil dizi kare atladığı için bölüm sınırı kare numarasından okunur. */
export function sectionOf(frame: { index: number }, framesPerSection: number): number {
  return Math.floor(frame.index / framesPerSection);
}

/**
 * Yükleme sırası: önce ilk bölüm, sonra kalanlar baştan sona. saveData ya da yavaş bağlantıda ilk bölüm dışındaki
 * kareler birer atlanır; atlanan kare oynatılırken en yakın yüklü kare çizilir.
 */
export function loadOrder(frames: readonly { index: number }[], framesPerSection: number, skip: boolean): number[] {
  const first: number[] = [];
  const rest: number[] = [];
  frames.forEach((f, i) => (sectionOf(f, framesPerSection) === 0 ? first : rest).push(i));
  return [...first, ...(skip ? rest.filter((_, k) => k % 2 === 0) : rest)];
}

/** Yüklü kareler arasında istenen sıraya en yakını; eşitlikte geride kalan (scroll yönünden bağımsız, titremesiz). */
export function nearestLoaded(target: number, loaded: { has(i: number): boolean }, count: number): number {
  if (loaded.has(target)) return target;
  for (let d = 1; d < count; d++) {
    if (loaded.has(target - d)) return target - d;
    if (loaded.has(target + d)) return target + d;
  }
  return -1;
}

/** Çözülmüş karelerin LRU önbelleği. Taşan kare kapatılır (ImageBitmap.close), bellek hemen geri döner. */
export class LruCache<V extends { close?: () => void }> {
  private map = new Map<number, V>();
  constructor(readonly capacity: number) {}

  get(key: number): V | undefined {
    const v = this.map.get(key);
    if (v !== undefined) {
      this.map.delete(key);
      this.map.set(key, v);
    }
    return v;
  }

  has(key: number): boolean {
    return this.map.has(key);
  }

  set(key: number, value: V): void {
    this.map.get(key)?.close?.();
    this.map.delete(key);
    this.map.set(key, value);
    while (this.map.size > this.capacity) {
      const [oldest, v] = this.map.entries().next().value!;
      this.map.delete(oldest);
      v.close?.();
    }
  }

  get size(): number {
    return this.map.size;
  }

  clear(): void {
    for (const v of this.map.values()) v.close?.();
    this.map.clear();
  }
}

/** Şu anki karenin çevresinde çözülecek sıralar: önce ileri yön, sonra geri; dizinin dışına taşmaz. */
export function decodeWindow(current: number, count: number, ahead: number, behind: number, direction: 1 | -1): number[] {
  const out: number[] = [current];
  const fwd = Array.from({ length: direction === 1 ? ahead : behind }, (_, k) => current + k + 1);
  const back = Array.from({ length: direction === 1 ? behind : ahead }, (_, k) => current - k - 1);
  const n = Math.max(fwd.length, back.length);
  for (let k = 0; k < n; k++) {
    if (k < fwd.length) out.push(fwd[k]);
    if (k < back.length) out.push(back[k]);
  }
  return out.filter((i) => i >= 0 && i < count);
}

/**
 * Bölüm metninin görünürlüğü (0–1): bölümün ilk %15'inde belirir, son %15'inde kaybolur.
 * İlk bölümün metni sayfa açılırken görünür; son bölümün metni (sayaç ve çağrı) kaybolmaz: hikâye orada biter.
 */
export function textOpacity(progress: number, section: number, sections: number): number {
  const local = progress * sections - section;
  if (local < 0 || local > 1) return 0;
  const edge = 0.15;
  const rise = section === 0 ? 1 : Math.min(1, local / edge);
  const fall = section === sections - 1 ? 1 : Math.min(1, (1 - local) / edge);
  const x = Math.min(rise, fall);
  return x * x * (3 - 2 * x);
}

/** Canvas'ı kaplayan çizim dikdörtgeni (object-fit: cover). */
export function coverRect(srcW: number, srcH: number, dstW: number, dstH: number) {
  const s = Math.max(dstW / srcW, dstH / srcH);
  const w = srcW * s;
  const h = srcH * s;
  return { x: (dstW - w) / 2, y: (dstH - h) / 2, w, h };
}
