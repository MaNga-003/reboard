// Hikâye sayfası (T3.4, STORY.md §4): sayaç dürüstlüğü (D-011, D-013), kare dizisinin scroll'la ilerlemesi,
// hareket azaltma yedeği ve 9:16 seçimi. Kareler henüz kodlanmadıysa yalnızca sayaç denetlenir.
import { expect, test, type Page } from "@playwright/test";

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
  test.skip(!(await hasStory(page)), "kareler henüz kodlanmadı (public/story/manifest.json yok)");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/tr");
  const canvas = page.locator("section canvas");
  await expect(canvas).toHaveAttribute("data-frame", "0");
  const story = page.locator("section[aria-label]").first();
  const box = (await story.boundingBox())!;
  const scrollTo = async (f: number) => {
    await page.evaluate((y) => window.scrollTo(0, y), (box.height - 900) * f);
    await page.waitForTimeout(800);
  };
  await scrollTo(0.5);
  const mid = Number(await canvas.getAttribute("data-frame"));
  expect(mid).toBeGreaterThan(0);
  await scrollTo(1);
  expect(Number(await canvas.getAttribute("data-frame"))).toBeGreaterThan(mid);
  await scrollTo(0.5);
  await expect(canvas).toHaveAttribute("data-frame", String(mid));
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
