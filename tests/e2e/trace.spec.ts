// İzlenebilirlik (T2.2): teslim alınan parti tartılır, kanıt yüklenir ve kontrol edilir, üretim partisine bağlanır,
// soy ağacında görünür. Beklenen sayılar ekrandan değil alan işlevlerinden ve dosyanın kendisinden hesaplanır.
// Testler ortak veritabanına yazar: akış kendi ilanını açar, yalnızca kendi partisine bakar.
import { createHash } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { Decimal } from "../../src/domain/result";
import { EVIDENCE_MAX_BYTES, acceptedKg, declaredGap, splitByComposition } from "../../src/domain/traceability";
import { TAP_MIN, WIDTHS, escapedAbsolutes, gutterBreaches, overflow, personaPage, seriousViolations, signIn, smallTargets } from "./helpers";

// 1×1 PNG; içerik baytlarından tür okunur (D-018).
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const uniqueTitle = (tag: string) => `E2E ${tag} ${Date.now()}-${Math.floor(Math.random() * 1e4)}`;
const UUID = "[0-9a-f-]{36}";
const FLOW_TAG = "izlenebilirlik";

/** Sağlayıcı tek seferlik atık ilanı açar, üretici teklif eder, sağlayıcı kabul eder: üreticiye bir planlı teslim düşer. */
async function plannedDelivery(supplier: Page, producer: Page, title: string) {
  await supplier.goto("/tr/pazar/yeni");
  await supplier.getByLabel("Başlık").fill(title);
  await supplier.getByLabel("Miktar", { exact: true }).fill("500");
  await supplier.getByLabel("Tekrar").selectOption("once");
  await supplier.getByLabel("Pamuk", { exact: true }).fill("70");
  await supplier.getByLabel("Polyester", { exact: true }).fill("30");
  await supplier.getByLabel("Kim öder?").selectOption("none");
  await supplier.getByRole("button", { name: "İlanı yayımla" }).click();
  await expect(supplier).toHaveURL(/durum=created$/);
  const listingPath = new URL(supplier.url()).pathname;
  await producer.goto(listingPath);
  await producer.getByRole("button", { name: "Teklifi gönder" }).click();
  await expect(producer).toHaveURL(/durum=offered$/);
  await supplier.goto(listingPath);
  await supplier.locator('[data-offer-id][data-status="open"]').getByRole("button", { name: "Kabul et" }).click();
  await expect(supplier).toHaveURL(/durum=accepted$/);
}

test("parti tartılır, kantar fişi yüklenip kontrol edilir, üretime girer ve lotun soy ağacında görünür", async ({ browser }) => {
  test.setTimeout(120_000);
  const title = uniqueTitle(FLOW_TAG);
  const supplier = await personaPage(browser, "supplier");
  const producer = await personaPage(browser, "producer");
  await plannedDelivery(supplier, producer, title);

  // 1) Teslim alma: beyan ilandan gelir; tartım ve ayıklama girilir.
  await producer.getByRole("navigation").getByRole("link", { name: "İzlenebilirlik" }).click();
  await expect(producer).toHaveURL(/\/tr\/izlenebilirlik$/);
  await producer.locator("tr", { hasText: title }).getByRole("link", { name: "Teslim al" }).click();
  await expect(producer).toHaveURL(new RegExp(`/tr/izlenebilirlik/kabul/${UUID}$`));
  expect(await seriousViolations(producer)).toEqual([]);
  await expect(producer.getByLabel("Beyan edilen kg")).toHaveValue("500");
  await expect(producer.getByLabel("Pamuk", { exact: true })).toHaveValue("70");
  await expect(producer.getByLabel("İpek")).toHaveValue("no");
  await producer.getByLabel("Tartılan kg").fill("492");
  await producer.getByLabel("Ayıklanan kg").fill("0");
  await producer.getByLabel("Nem (%)").fill("8,5");
  await producer.getByRole("button", { name: "Kabulü kaydet" }).click();
  await expect(producer).toHaveURL(new RegExp(`/tr/izlenebilirlik/parti/${UUID}\\?durum=received$`));
  await expect(producer.getByRole("status")).toHaveText("Parti teslim alındı ve olay zincirine yazıldı.");
  const batch = producer.locator("article[data-batch-code]");
  const code = (await batch.getAttribute("data-batch-code"))!;
  expect(code).toMatch(/^WB-\d{4}-\d{4,}$/);
  await expect(batch).toHaveAttribute("data-verified", "false");
  const accepted = acceptedKg("492", "0")!;
  await expect(producer.locator('[data-testid="accepted"] [data-kg]')).toHaveAttribute("data-kg", accepted.toString());
  await expect(producer.locator("[data-gap]")).toHaveAttribute("data-gap", declaredGap("500", "492")!.toString());
  await expect(producer.locator('[data-step="receiving"]')).toHaveCount(1);
  const batchPath = new URL(producer.url()).pathname;

  // 2) Kanıt: SHA-256 dosyanın kendisinden hesaplanır; ekrandaki ve zincirdeki özet aynı olmalı.
  await expect(producer.getByLabel("Kanıt türü")).toHaveValue("weighbridge_ticket");
  await producer.getByLabel("Dosya").setInputFiles({ name: "kantar-fisi.png", mimeType: "image/png", buffer: PNG });
  await producer.getByRole("button", { name: "Yükle" }).click();
  await expect(producer).toHaveURL(/durum=uploaded$/);
  const evidence = producer.locator("[data-evidence-id]");
  await expect(evidence).toHaveCount(1);
  await expect(evidence).toHaveAttribute("data-status", "declared");
  const sha = createHash("sha256").update(PNG).digest("hex");
  await expect(evidence).toContainText(sha);
  await expect(producer.locator("[data-step]", { hasText: sha })).toHaveCount(1);
  expect(await seriousViolations(producer)).toEqual([]);
  // Yükleme notu 64 karakterlik kırılmaz bir özet taşır; genişlik testleri paralel koştuğu için bu sayfayı görmeyebilir.
  // Tohum verisinde böyle not yok; en dar ekranda burada ölçülür (önce 210 px taşıyordu).
  const viewport = producer.viewportSize()!;
  await producer.setViewportSize({ width: WIDTHS[0], height: 800 });
  expect(await overflow(producer)).toBeLessThanOrEqual(0);
  expect(await gutterBreaches(producer)).toEqual([]);
  expect(await escapedAbsolutes(producer)).toEqual([]);
  await producer.setViewportSize(viewport);

  // İndirme: sahibi aynı baytları ek olarak alır; başka kurum 404, oturumsuz 401.
  const href = (await evidence.getByRole("link", { name: "İndir" }).getAttribute("href"))!;
  const own = await producer.request.get(href);
  expect(own.status()).toBe(200);
  expect(Buffer.compare(await own.body(), PNG)).toBe(0);
  expect(own.headers()["content-type"]).toBe("image/png");
  expect(own.headers()["content-disposition"]).toMatch(/^attachment; filename\*=UTF-8''kantar-fisi\.png$/);
  expect(own.headers()["x-content-type-options"]).toBe("nosniff");
  expect(own.headers()["content-security-policy"]).toMatch(/^sandbox/);
  expect((await supplier.request.get(href)).status()).toBe(404);
  const anon = await browser.newContext();
  expect((await anon.request.get(href)).status()).toBe(401);
  await anon.close();

  // 3) Kontrol: kantar fişi belgeli olunca parti doğrulanır.
  await evidence.getByRole("button", { name: "Kontrol et" }).click();
  await expect(producer).toHaveURL(/durum=checked$/);
  await expect(producer.getByRole("status")).toHaveText("Kanıt kontrol edildi.");
  await expect(producer.locator("article[data-batch-code]")).toHaveAttribute("data-verified", "true");
  await expect(producer.locator("[data-evidence-id]")).toHaveAttribute("data-status", "documented");
  await expect(producer.getByRole("button", { name: "Kontrol et" })).toHaveCount(0);

  // Sağlayıcı kendi teslim ettiği partide alıcının tartımını ve doğrulamayı görür; kanıt ve form görmez.
  await supplier.goto("/tr/izlenebilirlik");
  await expect(supplier.locator(`tr[data-batch-code="${code}"]`)).toHaveAttribute("data-verified", "true");
  await supplier.goto(batchPath);
  await expect(supplier.locator('[data-testid="weighed"] [data-kg]')).toHaveAttribute("data-kg", "492");
  await expect(supplier.locator("[data-evidence-id]")).toHaveCount(0);
  await expect(supplier.locator("main form")).toHaveCount(0);

  // 4) Üretim: kalanın tamamı tahsis edilir; girdi = çıktı + fire + nem kaybı (492 = 470 + 10 + 12).
  await producer.goto("/tr/izlenebilirlik");
  await producer.getByRole("link", { name: "Yeni üretim partisi" }).click();
  await expect(producer).toHaveURL(/\/tr\/izlenebilirlik\/uretim\/yeni$/);
  expect(await seriousViolations(producer)).toEqual([]);
  const allocation = producer.getByLabel(`${code} tahsisi (kg)`);
  await expect(allocation).toHaveAttribute("data-remaining", accepted.toString());
  await allocation.fill(accepted.toString());
  await producer.getByLabel("Çıktı kg").fill("470");
  await producer.getByLabel("Fire kg").fill("10");
  await producer.getByLabel("Nem kaybı kg").fill("12");
  await producer.getByLabel("Bağlayıcı").selectOption("pet_copet");
  await producer.getByLabel("Levha sayısı").fill("6");
  await producer.getByLabel("Yoğunluk (kg/m³)").fill("650");
  await producer.getByRole("button", { name: "Üretimi kaydet" }).click();
  await expect(producer).toHaveURL(new RegExp(`/tr/izlenebilirlik/lot/${UUID}\\?durum=produced$`));
  await expect(producer.getByRole("status")).toHaveText("Üretim partisi kaydedildi.");

  // 5) Soy ağacı: parti, sağlayıcı, tekstil kg'ı, lif dağılımı, kütle dengesi, test durumu, zincir.
  const tree = producer.getByTestId("genealogy");
  const source = tree.locator(`[data-batch-code="${code}"]`);
  await expect(source).toHaveCount(1);
  await expect(source).toContainText("Konfeksiyon A");
  await expect(source).toHaveAttribute("data-verified", "true");
  await expect(producer.locator('[data-testid="textile-kg"] [data-kg]')).toHaveAttribute("data-kg", accepted.toString());
  await expect(producer.locator('[data-testid="verified-kg"] [data-kg]')).toHaveAttribute("data-kg", accepted.toString());
  const fibres = splitByComposition(new Decimal(accepted), { cotton: 70, polyester: 30 });
  await expect(producer.locator('[data-fibre="cotton"] [data-kg]')).toHaveAttribute("data-kg", fibres.cotton.toString());
  await expect(producer.locator('[data-fibre="polyester"] [data-kg]')).toHaveAttribute("data-kg", fibres.polyester.toString());
  await expect(producer.locator('[data-supplier="Konfeksiyon A"] [data-kg]')).toHaveAttribute("data-kg", accepted.toString());
  await expect(producer.locator("[data-balance]")).toHaveAttribute("data-balance", "within");
  await expect(producer.locator("[data-test-status]")).toHaveAttribute("data-test-status", "not_tested");
  await expect(producer.locator("[data-chain]")).toHaveAttribute("data-chain", "ok");
  await expect(producer.locator('[data-step="transforming"]')).toHaveCount(1);
  expect(await seriousViolations(producer)).toEqual([]);
  const lotPath = new URL(producer.url()).pathname;

  // Aynı kurumun izleyicisi soy ağacını okur; hiçbir form ve eylem bağlantısı görmez.
  const viewer = await personaPage(browser, "viewer");
  await viewer.goto(lotPath);
  await expect(viewer.getByTestId("genealogy").locator(`[data-batch-code="${code}"]`)).toHaveCount(1);
  await viewer.goto(batchPath);
  await expect(viewer.locator("article[data-batch-code]")).toHaveAttribute("data-verified", "true");
  await expect(viewer.locator("main form")).toHaveCount(0);
  await viewer.goto("/tr/izlenebilirlik");
  await expect(viewer.getByRole("note")).toHaveText("Bu rol kayıtları görür, değiştiremez.");
  await expect(viewer.getByRole("link", { name: "Teslim al" })).toHaveCount(0);
  await expect(viewer.getByRole("link", { name: "Yeni üretim partisi" })).toHaveCount(0);
});

test("kural hatası alanları silmez: ayıklanan tartımı aşınca uyarı çıkar, girilen değerler yerinde kalır", async ({ page }) => {
  await signIn(page, "producer");
  await page.goto("/tr/izlenebilirlik");
  // Kural tartımdan önce, veritabanına yazmadan denetlenir: ortak seed teslimi değişmez.
  await page.locator("tr[data-delivery-id]").filter({ hasNotText: FLOW_TAG }).first().getByRole("link", { name: "Teslim al" }).click();
  await page.getByLabel("Tartılan kg").fill("100");
  await page.getByLabel("Ayıklanan kg").fill("150");
  await page.getByRole("button", { name: "Kabulü kaydet" }).click();
  await expect(page.locator("main").getByRole("alert")).toHaveText("Ayıklanan kg tartılan kg'ı aşamaz.");
  await expect(page).toHaveURL(new RegExp(`/tr/izlenebilirlik/kabul/${UUID}$`));
  await expect(page.getByLabel("Tartılan kg")).toHaveValue("100");
  await expect(page.getByLabel("Ayıklanan kg")).toHaveValue("150");
});

test("kanıt: 4 MiB üstü tarayıcıda durur, içeriği PNG olmayan dosya sunucuda reddedilir", async ({ page }) => {
  await signIn(page, "producer");
  await page.goto("/tr/izlenebilirlik");
  // En eski seed partisi: eşzamanlı akış testinin yeni partisine dokunulmaz.
  await page.locator("tr[data-batch-code]").last().getByRole("link").click();
  await expect(page).toHaveURL(new RegExp(`/tr/izlenebilirlik/parti/${UUID}$`));
  const before = await page.locator("[data-evidence-id]").count();

  let posted = 0;
  page.on("request", (r) => r.method() === "POST" && posted++);
  await page.getByLabel("Dosya").setInputFiles({ name: "buyuk.pdf", mimeType: "application/pdf", buffer: Buffer.alloc(EVIDENCE_MAX_BYTES + 1, 0x25) });
  await page.getByRole("button", { name: "Yükle" }).click();
  await expect(page.locator("main").getByRole("alert")).toHaveText("Dosya en fazla 4 MiB olabilir.");
  expect(posted).toBe(0);

  await page.getByLabel("Dosya").setInputFiles({ name: "sahte.png", mimeType: "image/png", buffer: Buffer.from("bu bir resim değil") });
  await page.getByRole("button", { name: "Yükle" }).click();
  await expect(page.locator("main").getByRole("alert")).toHaveText("Yalnızca PDF, PNG, JPEG ve WebP kabul edilir; tür dosyanın içinden okunur.");
  expect(posted).toBe(1);
  await page.reload();
  await expect(page.locator("[data-evidence-id]")).toHaveCount(before);
});

/** Seed'den ölçülecek sayfalar: teslim alma, parti, yeni üretim ve lot. */
async function tracePaths(page: Page, locale: string) {
  await page.goto(`/${locale}/izlenebilirlik`);
  const hrefs = async (sel: string) => (await page.locator(sel).first().getAttribute("href"))!;
  // Akış testi kendi teslimini eşzamanlı teslim alır; o satır seçilirse sayfa ölçülmeden 404 olur.
  const receivable = page.locator("tr[data-delivery-id]").filter({ hasNotText: FLOW_TAG }).first();
  return [
    `/${locale}/izlenebilirlik`,
    (await receivable.getByRole("link").getAttribute("href"))!,
    await hrefs('a[href*="/izlenebilirlik/parti/"]'),
    `/${locale}/izlenebilirlik/uretim/yeni`,
    await hrefs('a[href*="/izlenebilirlik/lot/"]'),
  ];
}

for (const locale of ["tr", "en"] as const) {
  test(`/${locale}/izlenebilirlik sayfaları: 0 ciddi a11y ihlali`, async ({ page }) => {
    await signIn(page, "producer", locale);
    for (const path of await tracePaths(page, locale)) {
      await page.goto(path);
      expect(await seriousViolations(page), path).toEqual([]);
    }
  });
}

for (const width of WIDTHS) {
  test(`${width}px: izlenebilirlik sayfalarında taşma 0, dokunma hedefi ≥ ${TAP_MIN} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await signIn(page, "producer");
    for (const path of await tracePaths(page, "tr")) {
      await page.goto(path);
      expect(await overflow(page), path).toBeLessThanOrEqual(0);
      expect(await gutterBreaches(page), path).toEqual([]);
      expect(await escapedAbsolutes(page), path).toEqual([]);
      expect(await smallTargets(page), path).toEqual([]);
    }
  });
}
