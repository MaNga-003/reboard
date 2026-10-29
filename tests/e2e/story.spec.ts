// Hikâye sayfası (T3.4, STORY.md §4): sayaç dürüstlüğü (D-011, D-013), kare dizisinin scroll'la ilerlemesi,
// hareket azaltma yedeği ve 9:16 seçimi. Kareler henüz kodlanmadıysa yalnızca sayaç denetlenir.
import { expect, test, type Page } from "@playwright/test";
import { expoOut } from "../../src/components/story/sequence";

async function hasStory(page: Page) {
  return (await page.request.get("/story/manifest.json")).ok();
}

test("sayaç ucu: platform geneli doğrulanmış kg, sınıfıyla; kurum ayrıntısı yok", async ({ request }) => {
  const res = await request.get("/api/counter");
  expect(res.ok()).toBe(true);
  expect(res.headers()["cache-control"]).toContain("s-maxage");
  const { counter } = await res.json();
  expect(Object.keys(counter).sort()).toEqual(["batches", "kg", "resultClass", "unknown"]);
  expect(counter.resultClass).toBe("synthetic");
  expect(Number(counter.kg)).toBeGreaterThan(0);
});

for (const locale of ["tr", "en"] as const) {
  test(`/${locale} sayaç ekranda: uçla aynı sayı, Sentetik rozeti`, async ({ page }) => {
    const { counter } = await (await page.request.get("/api/counter")).json();
    await page.goto(`/${locale}`);
    const value = page.getByTestId("story-counter");
    await value.scrollIntoViewIfNeeded();
    await expect(value).toHaveAttribute("data-kg", counter.kg);
    const kpi = page.locator('[data-kpi="story-counter"]');
    await expect(kpi.locator('[data-result-class="synthetic"]')).toHaveCount(1);
    const shown = Number((await value.textContent())!.replace(/[^\d]/g, ""));
    expect(shown).toBe(Math.round(Number(counter.kg)));
  });
}

test("kare dizisi scroll'la ilerler; ileri ve geri aynı kareye döner", async ({ page }) => {
  const res = await page.request.get("/story/manifest.json");
  test.skip(!res.ok(), "kareler henüz kodlanmadı (public/story/manifest.json yok)");
  const count = (await res.json()).variants.d.frames.length as number;
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/tr");
  const canvas = page.locator("section canvas");
  await expect(canvas).toHaveAttribute("data-frame", "0");
  // Hedef kare inmemişse oynatıcı en yakın yüklü kareyi gösterir. Tam pakette yük altında ilk okuma kareler
  // inmeden yapılıyor, dönüşte 120 geliyordu. Ölçülen indirme değil scroll → kare eşlemesi; önce hepsi iner.
  await expect(canvas).toHaveAttribute("data-loaded", String(count), { timeout: 60_000 });
  const story = page.locator("section[aria-label]").first();
  const box = (await story.boundingBox())!;
  const scrollTo = async (f: number) => {
    await page.evaluate((y) => window.scrollTo(0, y), (box.height - 900) * f);
    await page.waitForTimeout(800);
  };
  // Scrub yumuşatması yük altında geç oturur: kare iki ardışık okumada (300 ms arayla) aynı kalınca okunur.
  const settled = async () => {
    let last = -1;
    const read = async () => {
      const f = Number(await canvas.getAttribute("data-frame"));
      const same = f === last;
      last = f;
      return same;
    };
    await expect.poll(read, { intervals: [300], timeout: 10_000 }).toBe(true);
    return last;
  };
  await scrollTo(0.5);
  const mid = await settled();
  expect(mid).toBeGreaterThan(0);
  await scrollTo(1);
  expect(Number(await canvas.getAttribute("data-frame"))).toBeGreaterThan(mid);
  await scrollTo(0.5);
  await expect(canvas).toHaveAttribute("data-frame", String(mid));
});

// Yumuşatma gsap ScrollTrigger'ın `scrub: 0.35`'iyle kurulan hissi korur (R-7). Eğrinin kendisi birim testte gsap'e karşı
// doğrulanır (story-sequence.test); burada oynatıcının bağlantısı ölçülür: kaydırmadan sonraki ilk karede ilerlemesi
// (bir önceki karenin zamanına yaslanır, boştayken 60 Hz varsayılır), 350 ms süre ve tam hedefte durması.
// Kare zamanı gözlemciden document.timeline.currentTime ile okunur: rAF'ın aldığı zamanla aynıdır (120/120 karede ölçüldü).
// Ölçülen en büyük fark 5,4e-6 (data-progress 5 basamak); eşik 5e-5. Bir kare gecikme 2e-2, ders kitabı expo'su 6e-4 sapar.
test("scroll yumuşatması: ilk karede başlar, gsap'in eğrisiyle 350 ms'de tam hedefe oturur", async ({ page }) => {
  test.skip(!(await hasStory(page)), "kareler henüz kodlanmadı (public/story/manifest.json yok)");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/tr");
  const canvas = page.locator("section canvas");
  await expect(canvas).toHaveAttribute("data-progress", "0.00000");
  const { rows, target } = await page.evaluate(
    () =>
      new Promise<{ rows: [number, number][]; target: number }>((resolve) => {
        const el = document.querySelector<HTMLCanvasElement>("section canvas")!;
        const rows: [number, number][] = [];
        const mo = new MutationObserver(() => rows.push([document.timeline.currentTime as number, Number(el.dataset.progress)]));
        mo.observe(el, { attributeFilter: ["data-progress"] });
        // Kaydırma iki kare arasında, kullanıcı girdisi gibi: bir karenin çiziminden hemen sonra.
        requestAnimationFrame(() => {
          const ch = new MessageChannel();
          ch.port1.onmessage = () => window.scrollBy(0, 600);
          ch.port2.postMessage(null);
        });
        setTimeout(() => {
          mo.disconnect();
          // Hedef sayfanın kendi ölçüsünden: yapışkan alan kaydırılabilir boyunun ne kadarını geçti.
          const r = el.closest("section")!.getBoundingClientRect();
          resolve({ rows, target: -r.top / (r.height - el.parentElement!.clientHeight) });
        }, 800);
      }),
  );
  expect(rows.length).toBeGreaterThan(5);
  const [t1, p1] = rows[0];
  const [tEnd, to] = rows.at(-1)!;
  expect(to).toBeCloseTo(target, 4);
  expect(p1, "ilk karede ilerlemeli").toBeGreaterThan(0);
  const at = t1 - 1000 / 60;
  const off = rows.map(([t, p]) => ({ t: Math.round(t - t1), p, want: to * expoOut((t - at) / 350) })).filter((r) => Math.abs(r.p - r.want) > 5e-5);
  expect(off, "eğriden sapan kareler").toEqual([]);
  // Kare düşse de geçerli: son değişim süre dolduktan sonraki ilk karede, ondan önceki süre dolmadan.
  expect(tEnd - at, "son değişim 350 ms dolunca").toBeGreaterThanOrEqual(350);
  expect(rows.at(-2)![0] - at, "süre dolmadan duran kare yok").toBeLessThan(350);
});

test("hareket azaltma: canvas yok, her bölüm tek statik kare ve metniyle", async ({ page }) => {
  test.skip(!(await hasStory(page)), "kareler henüz kodlanmadı (public/story/manifest.json yok)");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/tr");
  await expect(page.locator("section canvas")).toHaveCount(0);
  const figures = page.locator("section figure");
  expect(await figures.count()).toBeGreaterThan(0);
  for (const f of await figures.all()) await expect(f.locator("figcaption")).not.toBeEmpty();
});

test("AVIF çözülemezse statik hikâye: canvas yok, her bölümün durağan karesi WebP olarak sunucuda", async ({ page }) => {
  test.skip(!(await hasStory(page)), "kareler henüz kodlanmadı (public/story/manifest.json yok)");
  await page.setViewportSize({ width: 1440, height: 900 });
  // AVIF'siz tarayıcının yerine: AVIF istekleri düşer, oynatıcı ilk kareyi çözemez (D-004). Chromium <picture>'da
  // yine AVIF kaynağını seçtiği için görüntünün kendisi burada ölçülmez; yedeğin dosyası ve yerleşimi ölçülür.
  await page.route("**/story/**/*.avif", (r) => r.abort());
  await page.goto("/tr");
  await expect(page.locator("section figure").first()).toBeVisible();
  await expect(page.locator("section canvas")).toHaveCount(0);
  const figures = await page.locator("section figure").all();
  const manifest = await (await page.request.get("/story/manifest.json")).json();
  expect(figures.length).toBe(manifest.variants.d.stills.length);
  for (const f of figures) {
    await expect(f.locator("figcaption")).not.toBeEmpty();
    const src = (await f.locator("img").getAttribute("src"))!;
    expect(src).toMatch(/\.webp$/);
    expect((await page.request.get(src)).ok(), src).toBe(true);
  }
});

test("dikey ekranda 9:16 dizisi seçilir", async ({ page }) => {
  test.skip(!(await hasStory(page)), "kareler henüz kodlanmadı (public/story/manifest.json yok)");
  const manifest = await (await page.request.get("/story/manifest.json")).json();
  test.skip(!manifest.variants.m, "9:16 dizisi yok");
  await page.setViewportSize({ width: 390, height: 844 });
  const asked: string[] = [];
  page.on("request", (r) => r.url().includes("/story/") && asked.push(new URL(r.url()).pathname));
  await page.goto("/tr");
  await expect(page.locator("section canvas")).toHaveAttribute("data-frame", "0");
  expect(asked.filter((p) => p.startsWith("/story/d/"))).toEqual([]);
  expect(asked.some((p) => p.startsWith("/story/m/"))).toBe(true);
});
