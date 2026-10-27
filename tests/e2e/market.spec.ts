// Pazar yeri (T2.1): ilan → teklif → kabul → anlaşma ve teslim planı; izleyici salt okur; erişilebilirlik, taşma, dokunma hedefi.
// Testler ortak veritabanına yazar: her ilan benzersiz başlıkla açılır, sayımlar yalnızca o ilana bakar.
import { expect, test, type Page } from "@playwright/test";
import { addDays, deliveryPlan, istanbulDay, planStart } from "../../src/domain/market";
import { TAP_MIN, WIDTHS, overflow, personaPage, seriousViolations, signIn, smallTargets } from "./helpers";

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
      expect(await smallTargets(page), path).toEqual([]);
    }
  });
}
