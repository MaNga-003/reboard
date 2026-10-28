// Kare dizisi bütçesi ve kalitesi (STORY.md §5, D-004). Manifest dolaşılır; baytlar diskteki dosyalardan okunur,
// manifestin kendi sayısına güvenilmez. Bölümler henüz tamamlanmadıysa toplam, eldeki karelerin ortalamasıyla tam
// diziye oranlanır (kodlayıcıyla aynı kural). Ham PNG'ler (story/out, git dışı) diskteyse SSIM yeniden ölçülür;
// CI'da yalnızca kodlayıcının yazdığı değer denetlenir. Kareler henüz kodlanmadıysa yalnızca belge ile kodlayıcı karşılaştırılır.
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Aspect, Manifest } from "@/components/story/sequence";
import { readRgb, ssim } from "../../scripts/image-metrics.mjs";
import { BUDGET, FRAMES_PER_SECTION, SECTIONS, SSIM_FLOOR, SSIM_TARGET } from "../../scripts/story-encode.mjs";

const DIR = join(process.cwd(), "public", "story");
const RAW = join(process.cwd(), "story", "out");
const file = join(DIR, "manifest.json");
const manifest: Manifest | null = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null;
const aspects = manifest ? (Object.keys(manifest.variants) as Aspect[]) : [];
const mb = (b: number) => `${(b / 1e6).toFixed(2)} MB`;

describe("bütçe belgeyle aynı", () => {
  // STORY.md §5 tablosundaki eşikler kodlayıcının sabitleriyle karşılaştırılır.
  const doc = readFileSync(join(process.cwd(), "docs/STORY.md"), "utf8");
  const num = (s: string) => Number(s.replace(",", "."));
  const row = (label: string) => {
    const m = new RegExp(`\\| ${label} \\| ≤ ([\\d,]+) MB \\|`).exec(doc);
    return m ? num(m[1]) * 1e6 : NaN;
  };
  it.each([
    ["Masaüstü dizisi toplamı", BUDGET.d],
    ["Mobil dizisi toplamı", BUDGET.m],
    ["İlk bölüm", BUDGET.firstSection],
  ])("%s", (label, code) => expect(row(label), `STORY.md "${label}" satırı`).toBe(code));

  it("kare kalitesi: hedef ve taban", () => {
    const m = /\| Kare kalitesi \(SSIM, kendi PNG'sine karşı\) \| Hedef ([\d,]+); tavan için en çok ([\d,]+)'e iner \|/.exec(doc);
    expect(m, "STORY.md kare kalitesi satırı").not.toBeNull();
    expect([num(m![1]), num(m![2])]).toEqual([SSIM_TARGET, SSIM_FLOOR]);
  });
});

/** StaticStory'nin gösterdiği kare: bölümdeki karelerin ortancası. Kodlayıcının kuralından bağımsız yazıldı. */
function expectedStills(indices: number[]): number[] {
  const out: number[] = [];
  for (let s = 0; s < SECTIONS; s++) {
    const inSection = indices.filter((i) => Math.floor(i / FRAMES_PER_SECTION) === s);
    if (inSection.length) out.push(inSection[Math.floor(inSection.length / 2)]);
  }
  return out;
}

describe.skipIf(!manifest)("kodlanmış kare dizisi", () => {
  it("bölüm düzeni kodlayıcıyla aynı", () => {
    expect(manifest!.framesPerSection).toBe(FRAMES_PER_SECTION);
    expect(manifest!.sections).toBe(SECTIONS);
  });

  for (const aspect of aspects) {
    const v = manifest!.variants[aspect]!;
    const size = (p: string) => (existsSync(join(DIR, p)) ? statSync(join(DIR, p)).size : -1);
    const bytes = v.frames.map((f) => size(f.avif));

    it(`${aspect}: her kare AVIF olarak diskte, baytlar manifestle aynı, adım ${v.step}`, () => {
      for (const [k, f] of v.frames.entries()) {
        expect(bytes[k], `${f.avif} yok`).toBeGreaterThan(0);
        expect(bytes[k], `${f.avif} manifestte ${f.bytes.avif} B`).toBe(f.bytes.avif);
        if (k > 0) expect(f.index - v.frames[k - 1].index, `${f.avif} önceki kareden adım`).toBe(v.step);
      }
    });

    it(`${aspect}: WebP yalnızca posterde ve bölüm başına bir durağan karede`, () => {
      const indices = v.frames.map((f) => f.index);
      expect(v.stills).toEqual(expectedStills(indices));
      const want = new Set([indices[0], ...v.stills]);
      for (const f of v.frames) {
        if (want.has(f.index)) {
          expect(f.webp, `kare ${f.index} durağan, WebP'si olmalı`).not.toBeNull();
          expect(size(f.webp!), `${f.webp} manifestte ${f.bytes.webp} B`).toBe(f.bytes.webp);
        } else expect(f.webp, `kare ${f.index} durağan değil`).toBeNull();
      }
    });

    it(`${aspect}: her karenin SSIM'i ≥ ${SSIM_FLOOR} (dizinin hedefi ${v.ssimTarget})`, () => {
      expect(v.ssimTarget).toBeGreaterThanOrEqual(SSIM_FLOOR);
      const low = v.frames.filter((f) => f.ssim < v.ssimTarget).map((f) => `${f.index}: ${f.ssim} (q${f.quality})`);
      // En yüksek kaliteyle bile hedefe ulaşamayan kare olabilir; tabanın altında kalan olamaz.
      expect(v.frames.filter((f) => f.ssim < SSIM_FLOOR).map((f) => f.index), `hedefin altı: ${low.join(", ")}`).toEqual([]);
    });

    // Ham kareler yalnızca render alınan makinede var. Dizinin baştan, ortadan ve sondan 6 karesi yeniden ölçülür.
    const raw = (index: number) => join(RAW, aspect, `f_${String(index).padStart(4, "0")}.png`);
    const sample = v.frames.filter((_, k) => k % Math.max(1, Math.floor(v.frames.length / 6)) === 0).slice(0, 6);
    it.skipIf(!sample.every((f) => existsSync(raw(f.index))))(`${aspect}: SSIM ham PNG'ye karşı yeniden ölçülünce manifestle aynı`, async () => {
      for (const f of sample) {
        const s = ssim(await readRgb(raw(f.index)), await readRgb(join(DIR, f.avif)));
        expect(Math.abs(s - f.ssim), `kare ${f.index}: ölçülen ${s.toFixed(4)}, manifest ${f.ssim}`).toBeLessThan(0.002);
      }
    }, 120_000);

    it(`${aspect}: toplam ve tam diziye oranlanmış toplam ≤ ${mb(BUDGET[aspect])}`, () => {
      const total = bytes.reduce((a, b) => a + b, 0);
      const full = (SECTIONS * FRAMES_PER_SECTION) / v.step;
      const projected = (total / bytes.length) * full;
      expect(total, `${aspect} toplam ${mb(total)}`).toBeLessThanOrEqual(BUDGET[aspect]);
      expect(projected, `${aspect} tam dizi tahmini ${mb(projected)} (${bytes.length}/${full} kare)`).toBeLessThanOrEqual(BUDGET[aspect]);
    });

    it(`${aspect}: ilk bölüm ≤ ${mb(BUDGET.firstSection)}`, () => {
      const first = v.frames.reduce((s, f, k) => (f.index < FRAMES_PER_SECTION ? s + bytes[k] : s), 0);
      expect(first, `${aspect} ilk bölüm ${mb(first)}`).toBeLessThanOrEqual(BUDGET.firstSection);
    });
  }
});
