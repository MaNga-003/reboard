// Scroll akıcılığı (M-3, STORY.md §5). Hikâye baştan sona sabit hızla kaydırılır, ardışık rAF aralıkları kaydedilir.
// Kareler önce tümüyle indirilir: ölçülen ağ değil, çözme ve çizim maliyetidir.
import { expect, test } from "@playwright/test";

const P99_MS = 25;
const SECONDS = 10; // 8 bölüm, bölüm başına ≈ 1,25 s: hızlı ama gerçekçi bir kaydırma
const WARMUP = 10; // ilk aralıklar sayfa açılışının artığıdır

test("masaüstü: hikâye boyunca kare süresi p99 ≤ 25 ms", async ({ page }) => {
  const res = await page.request.get("/story/manifest.json");
  test.skip(!res.ok(), "kareler henüz kodlanmadı (public/story/manifest.json yok)");
  const count = (await res.json()).variants.d.frames.length as number;
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/tr");
  const canvas = page.locator("section canvas");
  await expect(canvas).toHaveAttribute("data-loaded", String(count), { timeout: 90_000 });

  const run = await page.evaluate(async (seconds) => {
    const story = document.querySelector("section[aria-label]") as HTMLElement;
    const total = story.offsetHeight - innerHeight;
    const frames = new Set<string>();
    const gaps: number[] = [];
    await new Promise<void>((done) => {
      let t0 = 0;
      let last = 0;
      const tick = (t: number) => {
        if (!t0) t0 = t;
        if (last) gaps.push(t - last);
        last = t;
        const f = Math.min(1, (t - t0) / (seconds * 1000));
        window.scrollTo(0, story.offsetTop + total * f);
        frames.add((document.querySelector("section canvas") as HTMLElement).dataset.frame ?? "");
        if (f < 1) requestAnimationFrame(tick);
        else done();
      };
      requestAnimationFrame(tick);
    });
    return { gaps, distinct: frames.size };
  }, SECONDS);

  const gaps = run.gaps.slice(WARMUP).sort((a, b) => a - b);
  const at = (q: number) => gaps[Math.min(gaps.length - 1, Math.floor(q * gaps.length))];
  const mean = gaps.reduce((s, g) => s + g, 0) / gaps.length;
  const summary = `n ${gaps.length}, ort ${mean.toFixed(1)} ms, p95 ${at(0.95).toFixed(1)}, p99 ${at(0.99).toFixed(1)}, en uzun ${gaps.at(-1)!.toFixed(1)}, ${run.distinct}/${count} kare çizildi`;
  test.info().annotations.push({ type: "kare süresi", description: summary });
  console.log(summary);
  // Kaydırma gerçekten diziyi gezdi mi: karelerin çoğu çizilmiş olmalı (scrub yumuşatması birkaçını atlatır).
  expect(run.distinct, summary).toBeGreaterThan(count * 0.5);
  expect(at(0.99), summary).toBeLessThanOrEqual(P99_MS);
});
