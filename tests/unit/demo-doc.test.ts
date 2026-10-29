// DEMO.md ↔ demo testi (T4.3): belgedeki her adım testte aynı numara ve ekranla vardır, ekran gerçek bir sayfadır,
// süreler kesintisiz ve toplam 3 dakikadır. E2E koşmadan da belge ile test ayrışırsa burada düşer.
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEMO_MD, demoSteps } from "../e2e/demo-doc";

const steps = demoSteps();
const spec = readFileSync("tests/e2e/demo.spec.ts", "utf8");
const inSpec = [...spec.matchAll(/await step\((\d+), "([^"]+)"/g)].map((m) => ({ n: Number(m[1]), screen: m[2] }));

/** Ekran yolu → sayfa dosyası: [locale] altında, (grup) klasörleri yol dışında. */
const pageFile = (screen: string) =>
  [`src/app/[locale]${screen === "/" ? "" : screen}/page.tsx`, `src/app/[locale]/(app)${screen}/page.tsx`].find((f) => existsSync(f));

describe("DEMO.md akış tablosu", () => {
  it("adımlar 1'den sırayla gider, süreler kesintisiz, toplam 3:00", () => {
    expect(steps.map((s) => s.n)).toEqual(steps.map((_, i) => i + 1));
    expect(steps.length).toBeGreaterThanOrEqual(5);
    expect(steps[0].start).toBe(0);
    for (let i = 1; i < steps.length; i++) expect(steps[i].start, `${steps[i].n}. adım`).toBe(steps[i - 1].end);
    for (const s of steps) expect(s.end, `${s.n}. adım`).toBeGreaterThan(s.start);
    expect(steps.at(-1)!.end).toBe(180);
    expect(readFileSync(DEMO_MD, "utf8")).toMatch(/^> 3 dakikalık canlı demo/m);
  });

  it("her adımın ekranı uygulamada gerçek bir sayfadır", () => {
    for (const s of steps) expect(pageFile(s.screen), `${s.n}. adım: ${s.screen}`).toBeDefined();
  });

  it("demo testi belgedeki adımları aynı numara, ekran ve sırayla koşar", () => {
    expect(inSpec).toEqual(steps.map(({ n, screen }) => ({ n, screen })));
  });

  it("ayrıştırıcı bozuk satırı adım saymaz, rolü ayırır", () => {
    const md = ["## 2. Akış", "| # | Süre |", "| 1 | 0:00–0:40 | `/` | x |", "| 2 | 0:40–1:10 | `/pazar` (Üretici: ReBoard) | y |", "| 3 | 1:10 | `/panel` | z |", "## 3. Roller", "| 4 | 1:10–1:20 | `/senaryo` | w |"].join("\n");
    expect(demoSteps(md)).toEqual([
      { n: 1, start: 0, end: 40, screen: "/", persona: null },
      { n: 2, start: 40, end: 70, screen: "/pazar", persona: "Üretici: ReBoard" },
    ]);
  });
});
