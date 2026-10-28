// Kare dizisi bütçesi (STORY.md §5). Manifest dolaşılır; baytlar diskteki dosyalardan okunur, manifestin kendi sayısına güvenilmez.
// Bölümler henüz tamamlanmadıysa toplam, eldeki karelerin ortalamasıyla tam diziye oranlanır (kodlayıcıyla aynı kural).
// Kareler henüz kodlanmadıysa yalnızca belge ile kodlayıcının bütçesi karşılaştırılır.
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Aspect, Manifest } from "@/components/story/sequence";
import { BUDGET, FRAMES_PER_SECTION, SECTIONS } from "../../scripts/story-encode.mjs";

const DIR = join(process.cwd(), "public", "story");
const file = join(DIR, "manifest.json");
const manifest: Manifest | null = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null;
const aspects = manifest ? (Object.keys(manifest.variants) as Aspect[]) : [];
const mb = (b: number) => `${(b / 1e6).toFixed(2)} MB`;

describe("bütçe belgeyle aynı", () => {
  // STORY.md §5 tablosundaki "≤ N MB" eşikleri kodlayıcının sabitleriyle karşılaştırılır.
  const doc = readFileSync(join(process.cwd(), "docs/STORY.md"), "utf8");
  const row = (label: string) => {
    const m = new RegExp(`\\| ${label} \\| ≤ ([\\d,]+) MB \\|`).exec(doc);
    return m ? Number(m[1].replace(",", ".")) * 1e6 : NaN;
  };
  it.each([
    ["Masaüstü dizisi toplamı", BUDGET.d],
    ["Mobil dizisi toplamı", BUDGET.m],
    ["İlk bölüm", BUDGET.firstSection],
  ])("%s", (label, code) => expect(row(label), `STORY.md "${label}" satırı`).toBe(code));
});

describe.skipIf(!manifest)("kodlanmış kare dizisi", () => {
  it("bölüm düzeni kodlayıcıyla aynı", () => {
    expect(manifest!.framesPerSection).toBe(FRAMES_PER_SECTION);
    expect(manifest!.sections).toBe(SECTIONS);
  });

  for (const aspect of aspects) {
    const v = manifest!.variants[aspect]!;
    const size = (p: string) => (existsSync(join(DIR, p)) ? statSync(join(DIR, p)).size : -1);
    const bytes = v.frames.map((f) => size(f.avif));

    it(`${aspect}: her kare diskte (AVIF ve WebP), baytlar manifestle aynı, adım ${v.step}`, () => {
      for (const [k, f] of v.frames.entries()) {
        expect(bytes[k], `${f.avif} yok`).toBeGreaterThan(0);
        expect(size(f.webp), `${f.webp} yok`).toBeGreaterThan(0);
        expect(bytes[k], `${f.avif} manifestte ${f.bytes.avif} B`).toBe(f.bytes.avif);
        if (k > 0) expect(f.index - v.frames[k - 1].index, `${f.avif} önceki kareden adım`).toBe(v.step);
      }
    });

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
