// Demo akışı (T4.3): DEMO.md §2'deki her satır burada aynı numaralı bir adımdır; sunucunun sahnede yaptığı gibi tek sayfada,
// rol değiştirerek ilerler. Adım listesi belgeden okunur, sonda belgeyle birebir eşleştiği denetlenir (birim testi: demo-doc).
// DEMO_PACE=1 iken her adım belgedeki süresini doldurur ve 1920 × 1080 video kaydedilir (T4.2, scripts/demo-video.mjs).
import { expect, test, devices, type BrowserContext, type Page } from "@playwright/test";
import jsQR from "jsqr";
import sharp from "sharp";
import tr from "../../messages/tr.json";
import { SCENARIO_REFERENCES } from "../../src/db/repo/scenario";
import { DEMO_ORGS } from "../../src/db/seed/demo";
import { SCENARIO_FIELDS, formFromParams } from "../../src/domain/calc";
import { crowFliesKm } from "../../src/domain/geo";
import { Decimal } from "../../src/domain/result";
import { coverLevel, coverThresholds } from "../../src/domain/supply";
import { acceptedKg, declaredGap } from "../../src/domain/traceability";
import { fmtNumber } from "../../src/lib/format";
import { REPORT_SCENARIO } from "../fixtures/report-scenario";
import { demoSteps, skipTabs } from "./demo-doc";
import { signIn } from "./helpers";

const PACE = process.env.DEMO_PACE === "1";
// Çevrimdışı demo (scripts/demo-offline.mjs): tarayıcıda da yerel dışı her istek kesilir; harita listeye düşer, akış sürmeli.
const OFFLINE = process.env.DEMO_OFFLINE === "1";
const SIZE = { width: 1920, height: 1080 };
test.use(PACE ? { viewport: SIZE, video: { mode: "on", size: SIZE }, launchOptions: { slowMo: 350 } } : {});

const external: string[] = [];
async function offline(ctx: BrowserContext) {
  if (!OFFLINE) return;
  await ctx.route(
    (url) => !/^(localhost|127\.0\.0\.1)$/.test(url.hostname),
    (route) => {
      external.push(new URL(route.request().url()).hostname);
      return route.abort("internetdisconnected");
    },
  );
}

const STEPS = demoSteps();
const SKIP_TABS = skipTabs();
// 1×1 PNG: kantar fişi yerine; içerik baytlarından tür okunur (D-018).
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const UUID = "[0-9a-f-]{36}";

const nav = (page: Page, name: string) => page.getByRole("navigation").getByRole("link", { name, exact: true }).click();
// Menüyle gezinmede adres ve başlık yeni sayfaya geçtiği an eski sayfa bir an daha DOM'da kalabiliyor (ölçüldü: ilan
// sayfasına geçişin ilk anında 11 "Konum", 300 ms sonra 1). Katı kip ihlali yeniden denenmez; sayı denetimi denenir.
// Bu yüzden tek öğe beklenen yerde önce sayının bire inmesi beklenir, sonra okunur.
async function one(page: Page, selector: string, hasText?: string) {
  const l = page.locator(selector, { hasText });
  await expect(l, `${selector}${hasText ? ` "${hasText}"` : ""} tek olmalı`).toHaveCount(1);
  return l;
}
const kgOf = async (page: Page, kpi: string) => new Decimal((await (await one(page, `[data-kpi="${kpi}"] [data-kg]`)).getAttribute("data-kg"))!);
const factOf = async (page: Page, term: string) => (await one(page, "dt", term)).locator("xpath=following-sibling::dd[1]");

/** Sahnedeki gibi başlıktaki "Rol değiştir" menüsüyle (DEMO.md §3); oturum açıkken giriş sayfası panele yönlendirir. */
async function switchRole(page: Page, persona: string) {
  await page.locator("header").getByText(tr.auth.switchRole).click();
  await page.locator(`header [data-persona="${persona}"]`).click();
  await expect(page).toHaveURL(/\/tr\/panel$/);
}

/** Ekrandaki QR'ı çözer: sunumdaki QR'ı telefonun okuması gibi, sayfanın beyanından değil piksellerden. */
async function scanQr(page: Page) {
  const svg = page.locator("svg[data-qr]");
  await svg.scrollIntoViewIfNeeded();
  const { data, info } = await sharp(await svg.screenshot()).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return jsQR(new Uint8ClampedArray(data.buffer, data.byteOffset, data.length), info.width, info.height)?.data ?? null;
}

/** Sayfayı yukarıdan aşağı, verilen sürede yavaşça kaydırır (video): oynatıcı kareyi scroll'dan okur. */
async function glide(page: Page, from: number, to: number, ms: number) {
  const ticks = Math.max(1, Math.round(ms / 100));
  for (let i = 1; i <= ticks; i++) {
    await page.evaluate((y) => window.scrollTo(0, y), from + ((to - from) * i) / ticks);
    await page.waitForTimeout(ms / ticks);
  }
}

test("demo akışı: DEMO.md'deki adımlar sırayla ve aynı ekranlarda çalışır", async ({ page, browser }) => {
  test.setTimeout(PACE ? 360_000 : 180_000);
  await offline(page.context());
  const done: number[] = [];
  const title = PACE ? "Pamuk-polyester kesim artığı" : `E2E demo ${Date.now()}-${Math.floor(Math.random() * 1e4)}`;

  /** Belgedeki adım: ekran yolu tutmalı; adım bitince sayfa o ekranda olmalı. Video kipinde adım süresini doldurur. */
  async function step(n: number, screen: string, body: () => Promise<void>) {
    const doc = STEPS.find((s) => s.n === n);
    expect(doc, `DEMO.md'de ${n}. adım yok`).toBeDefined();
    expect(doc!.screen, `${n}. adımın ekranı`).toBe(screen);
    await test.step(`${n}. ${screen}${doc!.persona ? ` (${doc!.persona})` : ""}`, async () => {
      const t0 = Date.now();
      await body();
      const pattern = new RegExp(`^/tr${screen === "/" ? "" : screen.replace("[lot]", "[^/]+")}(/|$)`);
      expect(new URL(page.url()).pathname, `${n}. adım ${screen} ekranında bitmeli`).toMatch(pattern);
      if (PACE) await page.waitForTimeout(Math.max(0, (doc!.end - doc!.start) * 1000 - (Date.now() - t0)));
    });
    done.push(n);
  }

  // 1. Hikâye ve sayaç: platform geneli doğrulanmış kg, sentetik rozetiyle. Takılırsa (DEMO.md §4) Tab ile beliren
  // "Hikâyeyi geç" bağlantısı hikâyenin sonuna atlar; kaçıncı Tab'da belirdiği belgedeki sayıyla aynı olmalı.
  await step(1, "/", async () => {
    expect((await page.request.get("/story/manifest.json")).ok(), "hikâye kareleri kodlanmamış (pnpm story:encode)").toBe(true);
    await page.goto("/tr");
    if (!PACE) {
      const seen: string[] = [];
      while (seen.length < 20 && seen.at(-1) !== "#after-story") {
        await page.keyboard.press("Tab");
        seen.push(await page.evaluate(() => document.activeElement?.getAttribute("href") ?? document.activeElement?.tagName ?? "?"));
      }
      expect(seen.length, `"Hikâyeyi geç"e kadar odak sırası: ${seen.join(" → ")}`).toBe(SKIP_TABS);
      const skip = page.getByRole("link", { name: tr.story.skip });
      await expect(skip).toBeInViewport();
      await skip.press("Enter");
      await expect(page.locator("#after-story")).toBeInViewport();
      await page.goto("/tr");
    }
    if (PACE) {
      const story = (await page.locator("section[aria-label]").first().boundingBox())!;
      await glide(page, 0, story.height - SIZE.height, (STEPS[0].end - STEPS[0].start - 6) * 1000);
    }
    const counter = page.locator('[data-kpi="story-counter"]');
    await counter.scrollIntoViewIfNeeded();
    await expect(counter.locator('[data-result-class="synthetic"]')).toHaveCount(1);
    const value = page.getByTestId("story-counter");
    await expect(value).not.toHaveAttribute("data-kg", "");
    expect(Number(await value.getAttribute("data-kg"))).toBeGreaterThan(0);
  });

  // 2. Sağlayıcı atık ilanı verir: bileşim, ipeksiz, kg, ilçe; harita noktası bir artar.
  await step(2, "/pazar", async () => {
    await signIn(page, "supplier");
    await nav(page, tr.nav.market);
    const points = Number(await page.locator("[data-map-state]").getAttribute("data-points"));
    await page.getByRole("link", { name: tr.market.newListing }).click();
    await expect(page.getByLabel("İlan türü")).toHaveValue("waste_offer");
    await page.getByLabel("Başlık").fill(title);
    await page.getByLabel("Miktar", { exact: true }).fill("500");
    await page.getByLabel("Pamuk", { exact: true }).fill("70");
    await page.getByLabel("Polyester", { exact: true }).fill("30");
    await page.getByLabel("Kim öder?").selectOption("seller");
    await page.getByLabel("Birim fiyat (TL, KDV hariç)").fill("450");
    await page.getByRole("button", { name: "İlanı yayımla" }).click();
    await expect(page).toHaveURL(new RegExp(`/tr/pazar/${UUID}\\?durum=created$`));
    await expect(page.locator("[data-silk]")).toHaveAttribute("data-silk", "no");
    // İlan sahibi de kendi konumuna göre mesafeyi görür (0 km); etiket yine "kuş uçuşu" olmalı.
    const ownKm = fmtNumber(crowFliesKm(DEMO_ORGS.a, DEMO_ORGS.a), "tr", 1);
    await expect(await factOf(page, tr.market.location)).toHaveText(`${DEMO_ORGS.a.district} · ${ownKm} km ${tr.common.asTheCrowFlies}`);
    await expect(page.getByTestId("quantity")).toContainText("500 kg");
    await nav(page, tr.nav.market);
    await expect(page.locator("[data-map-state]")).toHaveAttribute("data-points", String(points + 1));
  });

  // 3. Üretici eşleşme skorunu ve kuş uçuşu mesafeyi görür, teklif verir; sağlayıcı kabul eder, teslim planı oluşur.
  let verifiedBefore = new Decimal(0);
  await step(3, "/pazar", async () => {
    await switchRole(page, "producer");
    verifiedBefore = await kgOf(page, "verified");
    await nav(page, tr.nav.market);
    const card = page.locator("article", { hasText: title });
    await expect(card.locator("[data-match-score]")).toHaveAttribute("data-match-score", /^\d{1,3}$/);
    await card.getByRole("link", { name: title }).click();
    const km = fmtNumber(crowFliesKm(DEMO_ORGS.reboard, DEMO_ORGS.a), "tr", 1);
    await expect(await factOf(page, tr.market.location)).toHaveText(`${DEMO_ORGS.a.district} · ${km} km ${tr.common.asTheCrowFlies}`);
    await expect(page.locator("[data-part]")).toHaveCount(4);
    await page.getByRole("button", { name: "Teklifi gönder" }).click();
    await expect(page).toHaveURL(/durum=offered$/);
    const listingPath = new URL(page.url()).pathname;
    await switchRole(page, "supplier");
    await page.goto(listingPath);
    await page.locator('[data-offer-id][data-status="open"]').getByRole("button", { name: "Kabul et" }).click();
    await expect(page.getByRole("status")).toHaveText("Teklif kabul edildi; anlaşma ve teslim planı oluştu.");
    await expect(page.locator("[data-deal-id] [data-delivery-id]").first()).toBeVisible();
    await expect(page.locator('[data-deal-id] [data-planned-kg="unknown"]')).toHaveCount(0);
  });

  // 4. Üretici teslim alır (beyan ile tartım farkı), kantar fişini yükleyip kontrol eder, üretime alır; soy ağacında görünür.
  let accepted = "";
  await step(4, "/izlenebilirlik", async () => {
    await switchRole(page, "producer");
    await nav(page, tr.nav.traceability);
    await page.locator("tr", { hasText: title }).first().getByRole("link", { name: "Teslim al" }).click();
    await expect(page.getByLabel("Beyan edilen kg")).toHaveValue("500");
    await page.getByLabel("Tartılan kg").fill("492");
    await page.getByLabel("Ayıklanan kg").fill("0");
    await page.getByLabel("Nem (%)").fill("8,5");
    await page.getByRole("button", { name: "Kabulü kaydet" }).click();
    await expect(page).toHaveURL(new RegExp(`/tr/izlenebilirlik/parti/${UUID}\\?durum=received$`));
    await expect(page.locator("[data-gap]")).toHaveAttribute("data-gap", declaredGap("500", "492")!.toString());
    const code = (await page.locator("article[data-batch-code]").getAttribute("data-batch-code"))!;
    accepted = acceptedKg("492", "0")!.toString();

    await page.getByLabel("Dosya").setInputFiles({ name: "kantar-fisi.png", mimeType: "image/png", buffer: PNG });
    await page.getByRole("button", { name: "Yükle" }).click();
    await page.locator("[data-evidence-id]").getByRole("button", { name: "Kontrol et" }).click();
    await expect(page.locator("article[data-batch-code]")).toHaveAttribute("data-verified", "true");

    await nav(page, tr.nav.traceability);
    await page.getByRole("link", { name: "Yeni üretim partisi" }).click();
    await page.getByLabel(`${code} tahsisi (kg)`).fill(accepted);
    await page.getByLabel("Çıktı kg").fill("470");
    await page.getByLabel("Fire kg").fill("10");
    await page.getByLabel("Nem kaybı kg").fill("12");
    await page.getByLabel("Bağlayıcı").selectOption("pet_copet");
    await page.getByLabel("Levha sayısı").fill("6");
    await page.getByLabel("Yoğunluk (kg/m³)").fill("650");
    await page.getByRole("button", { name: "Üretimi kaydet" }).click();
    await expect(page).toHaveURL(new RegExp(`/tr/izlenebilirlik/lot/${UUID}\\?durum=produced$`));
    await expect(page.getByTestId("genealogy").locator(`[data-batch-code="${code}"]`)).toHaveAttribute("data-verified", "true");
    await expect(page.locator("[data-balance]")).toHaveAttribute("data-balance", "within");
    await expect(page.locator("[data-chain]")).toHaveAttribute("data-chain", "ok");
  });

  // 5. Panel: doğrulanmış kg bu partiyle artar (paralel testler yalnız ekler); gün sayısı stok ÷ ihtiyaç; uyarılar düzeyli.
  await step(5, "/panel", async () => {
    await nav(page, tr.nav.dashboard);
    const verified = await kgOf(page, "verified");
    expect(verified.minus(verifiedBefore).gte(accepted), `doğrulanmış kg ${verifiedBefore} → ${verified}, en az +${accepted}`).toBe(true);
    await expect(page.locator('[data-kpi="declared"] [data-kg]')).toHaveCount(1);
    const days = new Decimal((await page.locator("[data-days]").getAttribute("data-days"))!);
    expect(days.eq((await kgOf(page, "usable")).div(await kgOf(page, "need")))).toBe(true);
    const th = page.locator("[data-green]");
    const t = coverThresholds((await th.getAttribute("data-green"))!, (await th.getAttribute("data-yellow"))!);
    await expect(page.locator('[data-kpi="days"] [data-level]')).toHaveAttribute("data-level", coverLevel(days, t)!);
    expect(await page.locator("[data-alert][data-level]").count()).toBeGreaterThan(0);
    expect(new Set(await page.locator("main [data-result-class]").evaluateAll((els) => els.map((e) => e.getAttribute("data-result-class"))))).toEqual(new Set(["synthetic"]));
  });

  // 6. Pasaport: satılan lotun QR'ı ekrandan okunur, telefonda girişsiz açılır; zincirler ve etiket çapası geçer.
  await step(6, "/pasaport/[lot]", async () => {
    await nav(page, tr.nav.traceability);
    // allTextContents beklemez: lot listesi aynı sunucu çiziminde gelir, başlık görününce listesi de oradadır.
    await expect(page.getByRole("heading", { level: 1, name: tr.trace.title })).toBeVisible();
    const codes = (await page.locator('a[href*="/izlenebilirlik/lot/"]').allTextContents()).map((s) => s.trim()).sort();
    await page.getByRole("link", { name: codes[0], exact: true }).click();
    await page.locator("[data-passport-link]").click();
    const url = await scanQr(page);
    expect(url, "QR çözülemedi").toMatch(new RegExp(`/tr/pasaport/${codes[0]}\\?a=\\d+-[0-9a-f]{64}$`));

    const phone = await browser.newContext({ ...devices["Pixel 7"] });
    await offline(phone);
    const mobile = await phone.newPage();
    for (const p of PACE ? [mobile, page] : [mobile]) {
      await p.goto(url!);
      await expect(p.locator("[data-verdict]")).toHaveAttribute("data-verdict", "ok");
      await expect(p.locator("[data-anchor]")).toHaveAttribute("data-anchor", "matched");
    }
    const roles = await mobile.locator("[data-chain-role]").evaluateAll((els) => els.map((e) => e.getAttribute("data-chain")));
    expect(roles.length).toBeGreaterThanOrEqual(3);
    expect(roles.every((r) => r === "ok")).toBe(true);
    await expect(mobile.locator("[data-test-status]")).toHaveAttribute("data-test-status", /^(not_tested|in_progress)$/);
    await expect(mobile.locator('[data-testid="sources"] li[data-batch-code]').first()).toBeVisible();
    await phone.close();
  });

  // 7. Senaryo: kaynaklı varsayılanda yalnız 10 t dolu, sonuçlar bilinmiyor; karşılaştırma değerleri kaynaklı;
  // rapor girdileri yazılıp atık satış geliri girilince fabrika tarafı kırmızı ve açıklamalı olur.
  await step(7, "/senaryo", async () => {
    // Pasaport uygulama menüsünün dışında: tarayıcıda geri gelinen lot sayfasından Senaryo'ya geçilir; üretici oturumu sürer.
    while (new URL(page.url()).pathname.includes("/pasaport/")) await page.goBack();
    await nav(page, tr.nav.scenario);
    for (const f of SCENARIO_FIELDS) await expect(page.locator(`#sc-${f.key}`), f.key).toHaveValue(f.key === "wasteT" ? "10" : "");
    await expect(page.locator('[data-kpi="scenario-factory"] [data-value]')).toHaveText(tr.common.unknown);
    await expect(page.locator("tr[data-reference]")).toHaveCount(SCENARIO_REFERENCES.length);
    for (const row of await page.locator("tr[data-reference]").all()) {
      await expect(row.locator("[data-source] a")).toHaveAttribute("href", /^https:\/\//);
      await expect(row.locator("[data-source]")).toContainText("Okunma:");
    }
    const form = { ...formFromParams(REPORT_SCENARIO), wasteSalePerT: "2000" };
    for (const f of SCENARIO_FIELDS) await page.locator(`#sc-${f.key}`).fill(form[f.key]);
    const factory = page.locator('[data-kpi="scenario-factory"]');
    await expect(factory).toHaveAttribute("data-alert", "true");
    await expect(factory.locator("[data-level=danger]")).toHaveText("Zarar");
    await expect(factory.locator("[data-explain]")).toContainText("atık bedeli");
  });

  expect(done, "DEMO.md'deki adımların hepsi, sırasıyla").toEqual(STEPS.map((s) => s.n));
  if (OFFLINE) {
    const description = `tarayıcıda kesilen dış istek: ${external.length} (${[...new Set(external)].join(", ") || "yok"})`;
    test.info().annotations.push({ type: "çevrimdışı", description });
    console.log(description);
  }
});
