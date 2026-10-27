// Pazar yeri (T2.1): ilan → teklif → kabul → anlaşma ve teslim planı; izleyici salt okur; erişilebilirlik, taşma, dokunma hedefi.
// Testler ortak veritabanına yazar: her ilan benzersiz başlıkla açılır, sayımlar yalnızca o ilana bakar.
import { expect, test, type Page } from "@playwright/test";
import { contrastRatio } from "../../src/design/color";
import { MARKER, markerColors } from "../../src/design/map";
import { addDays, deliveryPlan, istanbulDay, planStart } from "../../src/domain/market";
import { TAP_MIN, WIDTHS, gutterBreaches, overflow, personaPage, seriousViolations, signIn, smallTargets } from "./helpers";

const uniqueTitle = (tag: string) => `E2E ${tag} ${Date.now()}-${Math.floor(Math.random() * 1e4)}`;

/** Başkasının atık teklifinin ayrıntı adresi: üretici için teklif formu görünür. */
async function othersListing(page: Page, locale: string) {
  await page.goto(`/${locale}/pazar?tur=waste_offer&sirala=yeni`);
  const card = page.locator('article[data-kind="waste_offer"]').first();
  return `/${locale}/pazar/${await card.getAttribute("data-listing-id")}`;
}

test("sağlayıcı ilan verir, üretici teklif eder, sağlayıcı kabul eder; anlaşma ve teslim planı oluşur", async ({ browser }) => {
  const title = uniqueTitle("kesim artığı");
  const supplier = await personaPage(browser, "supplier");

  await supplier.getByRole("navigation").getByRole("link", { name: "Pazar yeri" }).click();
  await supplier.getByRole("link", { name: "Yeni ilan ver" }).click();
  // Konfeksiyon kurumu için varsayılan tür atık teklifidir; tekrar haftalık.
  await expect(supplier.getByLabel("İlan türü")).toHaveValue("waste_offer");
  await expect(supplier.getByLabel("Tekrar")).toHaveValue("weekly");
  await supplier.getByLabel("Başlık").fill(title);
  await supplier.getByLabel("Miktar", { exact: true }).fill("500");
  await supplier.getByLabel("Pamuk", { exact: true }).fill("70");
  await supplier.getByLabel("Polyester", { exact: true }).fill("30");
  await supplier.getByLabel("Kim öder?").selectOption("seller");
  await supplier.getByLabel("Birim fiyat (TL, KDV hariç)").fill("450");
  await supplier.getByRole("button", { name: "İlanı yayımla" }).click();
  await expect(supplier).toHaveURL(/\/tr\/pazar\/[0-9a-f-]{36}\?durum=created$/);
  await expect(supplier.getByRole("status")).toHaveText("İlan yayımlandı.");
  await expect(supplier.locator("[data-silk]")).toHaveAttribute("data-silk", "no");
  await expect(supplier.locator("[data-payer]")).toHaveAttribute("data-payer", "seller");
  const listingPath = new URL(supplier.url()).pathname;

  // Üretici ilanı listede eşleşme skoruyla görür ve teklif verir (varsayılanlar ilandan gelir).
  const producer = await personaPage(browser, "producer");
  await producer.goto("/tr/pazar?tur=waste_offer&sirala=yeni");
  const card = producer.locator("article", { hasText: title });
  await expect(card.locator("[data-result-class]")).toHaveAttribute("data-result-class", "synthetic");
  await expect(card.locator("[data-match-score]")).toHaveAttribute("data-match-score", /^\d{1,3}$/);
  await card.getByRole("link", { name: title }).click();
  await expect(producer).toHaveURL(new RegExp(`${listingPath}$`));
  await expect(producer.locator("[data-part]")).toHaveCount(4);
  await producer.getByRole("button", { name: "Teklifi gönder" }).click();
  await expect(producer).toHaveURL(/durum=offered$/);
  await expect(producer.locator('[data-offer-id][data-status="open"]')).toHaveCount(1);
  // Teklif veren kabul edemez; yalnızca geri çekebilir.
  await expect(producer.getByRole("button", { name: "Kabul et" })).toHaveCount(0);
  await expect(producer.getByRole("button", { name: "Teklifi geri çek" })).toHaveCount(1);

  // Sağlayıcı kabul eder: anlaşma ve haftalık teslim planı oluşur.
  await supplier.goto(listingPath);
  await supplier.locator('[data-offer-id][data-status="open"]').getByRole("button", { name: "Kabul et" }).click();
  await expect(supplier).toHaveURL(/durum=accepted$/);
  await expect(supplier.getByRole("status")).toHaveText("Teklif kabul edildi; anlaşma ve teslim planı oluştu.");
  await expect(supplier.locator('[data-offer-id][data-status="accepted"]')).toHaveCount(1);
  const deal = supplier.locator("[data-deal-id]");
  await expect(deal).toHaveCount(1);
  await expect(deal).toContainText("Konfeksiyon A");
  await expect(deal).toContainText("ReBoard Pilot Tesisi");
  const today = istanbulDay(new Date());
  const expected = deliveryPlan(planStart(today, today), "weekly", addDays(today, 30)).length;
  await expect(deal.locator("[data-delivery-id]")).toHaveCount(expected);
  await expect(deal.locator('[data-planned-kg="unknown"]')).toHaveCount(0);
  expect(await seriousViolations(supplier)).toEqual([]);

  // Alıcı tarafı da anlaşmayı görür; aynı kurumun izleyicisi okur ama form görmez.
  await producer.reload();
  await expect(producer.locator("[data-deal-id] [data-delivery-id]")).toHaveCount(expected);
  const viewer = await personaPage(browser, "viewer");
  await viewer.goto(listingPath);
  await expect(viewer.locator("[data-deal-id]")).toHaveCount(1);
  await expect(viewer.locator("main form")).toHaveCount(0);
  await viewer.goto("/tr/pazar");
  await expect(viewer.getByRole("note")).toHaveText("İzleyici rolü ilan ve teklif veremez; kayıtları yalnızca okur.");
  await expect(viewer.getByRole("link", { name: "Yeni ilan ver" })).toHaveCount(0);
});

test("eksik başlık sunucuda reddedilir; alan işaretlenir, ilan açılmaz", async ({ page }) => {
  await signIn(page, "supplier");
  await page.goto("/tr/pazar/yeni");
  await page.getByLabel("Miktar", { exact: true }).fill("100");
  await page.getByRole("button", { name: "İlanı yayımla" }).click();
  await expect(page.locator("main").getByRole("alert")).toHaveText("Girdiyi denetleyin.");
  await expect(page.getByLabel("Başlık")).toHaveAttribute("aria-invalid", "true");
  await expect(page).toHaveURL(/\/tr\/pazar\/yeni$/);
});

test("kendi ilanına teklif formu çıkmaz; ipeksiz süzgeci ipekli ve bilinmeyeni gizler", async ({ page }) => {
  await signIn(page, "producer");
  await page.goto("/tr/pazar");
  // Süzgeç boşa geçmesin: seed'de ipekli ilan var, süzgeçsiz listede görünür.
  expect(await page.locator('[data-silk="yes"]').count()).toBeGreaterThan(0);
  await page.goto("/tr/pazar?ipeksiz=1");
  await expect(page.locator('[data-silk="yes"], [data-silk="unknown"]')).toHaveCount(0);
  await page.goto("/tr/pazar");
  const own = page.locator("article", { hasText: "Sizin ilanınız" }).first();
  await own.getByRole("heading").getByRole("link").click();
  // Olumsuz denetim yeni sayfa yüklendikten sonra: önce sayfaya özgü düğme beklenir.
  await expect(page).toHaveURL(/\/tr\/pazar\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("button", { name: "İlanı kapat" })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Teklifi gönder" })).toHaveCount(0);
});

/**
 * Ekran görüntüsünde dolgu rengindeki ilk beneği bulur; halkanın ve beneğin hemen dışındaki altlığın gerçek renklerini
 * (kanal medyanı) döndürür. Görüntü CSP'siz boş sayfada çözülür: ölçü, kullanıcının gördüğü son render üzerindedir.
 */
async function measureDot(page: Page, png: Buffer, fillHex: string, ringPx: number) {
  const scratch = await page.context().newPage();
  try {
    return await scratch.evaluate(
      async ({ b64, fillHex, ringPx }) => {
        const img = new Image();
        img.src = `data:image/png;base64,${b64}`;
        await img.decode();
        const cv = document.createElement("canvas");
        cv.width = img.width;
        cv.height = img.height;
        const ctx = cv.getContext("2d")!;
        ctx.drawImage(img, 0, 0);
        const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
        const [r, g, b] = [1, 3, 5].map((i) => parseInt(fillHex.slice(i, i + 2), 16));
        const fill: [number, number][] = [];
        for (let k = 0; k < d.length; k += 4) if (Math.abs(d[k] - r) + Math.abs(d[k + 1] - g) + Math.abs(d[k + 2] - b) <= 6) fill.push([(k / 4) % cv.width, Math.floor(k / 4 / cv.width)]);
        if (!fill.length) return null;
        // İlk vuruştan yakın piksellerin ağırlık merkezine yürü: benek merkezine oturur; yarıçap alandan çıkar.
        let [cx, cy] = fill[0];
        let near = fill;
        for (let i = 0; i < 4; i++) {
          near = fill.filter(([x, y]) => Math.hypot(x - cx, y - cy) <= 16);
          cx = near.reduce((s, p) => s + p[0], 0) / near.length;
          cy = near.reduce((s, p) => s + p[1], 0) / near.length;
        }
        const radius = Math.sqrt(near.length / Math.PI);
        const band = (from: number, to: number, leftOnly: boolean) => {
          const ch: number[][] = [[], [], []];
          for (let y = Math.floor(cy - to); y <= cy + to; y++)
            for (let x = Math.floor(cx - to); x <= cx + to; x++) {
              const dist = Math.hypot(x - cx, y - cy);
              if (dist < from || dist > to || (leftOnly && x > cx - 2) || x < 0 || y < 0 || x >= cv.width || y >= cv.height) continue;
              const k = (y * cv.width + x) * 4;
              for (let c = 0; c < 3; c++) ch[c].push(d[k + c]);
            }
          const hex = ch.map((v) => v.sort((a, b) => a - b)[v.length >> 1].toString(16).padStart(2, "0")).join("");
          return `#${hex}`;
        };
        // Halka bandının kenarları kenar yumuşatmalı: ortası alınır. Dış bant yalnız solda: sayı etiketi sağda.
        return { x: cx, y: cy, radius, ring: band(radius + 0.75, radius + ringPx - 0.75, false), outside: band(radius + ringPx + 3, radius + ringPx + 7, true) };
      },
      { b64: png.toString("base64"), fillHex, ringPx },
    );
  } finally {
    await scratch.close();
  }
}

test("harita: açılır ya da yedek metne düşer; aynı ilçedekiler tek noktada; kendi noktası halkalı ve dokununca ilanları listeler", async ({ page }) => {
  await signIn(page, "producer");
  await page.goto("/tr/pazar");
  const map = page.locator("[data-map-state]");
  await expect(map).not.toHaveAttribute("data-map-state", "loading", { timeout: 20_000 });
  const cards = await page.locator("article[data-listing-id]").count();
  const points = Number(await map.getAttribute("data-points"));
  const groups = Number(await map.getAttribute("data-groups"));
  expect(points).toBeGreaterThan(0);
  expect(points).toBeLessThanOrEqual(cards);
  // Seed'de aynı ilçede birden çok ilan var: birleşmezse noktalar üst üste biner.
  expect(groups).toBeLessThan(points);
  if ((await map.getAttribute("data-map-state")) !== "ready") {
    await expect(page.getByText("Harita bu cihazda açılamadı", { exact: false })).toBeVisible();
    return;
  }

  // Üreticinin seed'de iki ilanı aynı ilçede: vurgu dolgulu benek ekranda bulunur. Halka ya da dolgu, çevresindeki
  // gerçek altlığa karşı ≥ 3:1 olmalı (WCAG 1.4.11). Beklenen renk kaynaktan değil ekrandan okunur: döngüsel test olmaz.
  const c = markerColors();
  let spot: Awaited<ReturnType<typeof measureDot>> = null;
  for (let i = 0; i < 20 && !spot; i++) {
    spot = await measureDot(page, await map.screenshot(), c.own.fill, MARKER.ownRing);
    if (!spot) await page.waitForTimeout(500);
  }
  expect(spot, "kendi ilanı beneği ekranda bulunamadı").not.toBeNull();
  const seen = Math.max(contrastRatio(spot!.ring, spot!.outside), contrastRatio(c.own.fill, spot!.outside));
  expect(seen, `halka ${spot!.ring}, dolgu ${c.own.fill}, altlık ${spot!.outside}`).toBeGreaterThanOrEqual(3);

  // Görünen beneğin dışına ama 44 px dokunma alanının içine dokun.
  await map.click({ position: { x: spot!.x + MARKER.hitRadius - 4, y: spot!.y } });
  const popup = page.locator(".rb-map-popup");
  await expect(popup.getByRole("list", { name: "Bu konumdaki ilanlar" })).toBeVisible();
  const links = popup.getByRole("link");
  expect(await links.count()).toBeGreaterThanOrEqual(2);
  for (const href of await links.evaluateAll((els) => els.map((a) => a.getAttribute("href")))) expect(href).toMatch(/^\/tr\/pazar\/[0-9a-f-]{36}$/);
  expect(await seriousViolations(page)).toEqual([]);
  expect(await smallTargets(page)).toEqual([]);
  const first = (await links.first().textContent()) ?? "";
  await links.first().click();
  await expect(page).toHaveURL(/\/tr\/pazar\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(first);
});

for (const locale of ["tr", "en"] as const) {
  test(`/${locale}/pazar, ilan ayrıntısı ve yeni ilan: 0 ciddi a11y ihlali`, async ({ page }) => {
    await signIn(page, "producer", locale);
    const detail = await othersListing(page, locale);
    expect(await seriousViolations(page)).toEqual([]);
    await page.goto(detail);
    expect(await seriousViolations(page)).toEqual([]);
    await page.goto(`/${locale}/pazar/yeni`);
    expect(await seriousViolations(page)).toEqual([]);
  });
}

for (const width of WIDTHS) {
  test(`${width}px: pazar sayfalarında taşma 0, dokunma hedefi ≥ ${TAP_MIN} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await signIn(page, "producer");
    const detail = await othersListing(page, "tr");
    for (const path of ["/tr/pazar", detail, "/tr/pazar/yeni"]) {
      await page.goto(path);
      expect(await overflow(page), path).toBeLessThanOrEqual(0);
      expect(await gutterBreaches(page), path).toEqual([]);
      expect(await smallTargets(page), path).toEqual([]);
    }
  });
}
