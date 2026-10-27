// Ürün pasaportu (T2.4, D-025): girişsiz açılır, bütün zincirler doğrulanır, QR ekrandan okunur (M-26), iç bilgi sızmaz (M-27).
// Lot kodu iç ekrandan, çapa açık uçtan okunur; beklenen QR adresi ikisinden kurulur, sayfanın kendi beyanından değil.
import { expect, test, type Browser, type Page } from "@playwright/test";
import jsQR from "jsqr";
import sharp from "sharp";
import { DEMO_ORGS } from "../../src/db/seed/demo";
import { relativeLuminance } from "../../src/design/color";
import { WIDTHS, escapedAbsolutes, gutterBreaches, overflow, personaPage, seriousViolations, smallTargets } from "./helpers";

const SC_MIN = 0.55; // ISO/IEC 15415 "B"; birim testteki eşikle aynı (qr.test.ts).
const MODULE_PX_MIN = 4;

const hex = (r: number, g: number, b: number) => `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;

/** QR'ın ekran görüntüsü: çözülen metin, modül başına piksel ve sembol kontrastı (en açık − en koyu pikselin göreli parlaklığı). */
async function readQr(page: Page) {
  const svg = page.locator("svg[data-qr]");
  await svg.scrollIntoViewIfNeeded();
  const box = (await svg.boundingBox())!;
  const size = Number(await svg.getAttribute("data-qr-size"));
  const { data, info } = await sharp(await svg.screenshot()).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const decoded = jsQR(new Uint8ClampedArray(data.buffer, data.byteOffset, data.length), info.width, info.height, { inversionAttempts: "dontInvert" })?.data ?? null;
  const seen = new Map<number, number>();
  let lo = 1;
  let hi = 0;
  for (let i = 0; i < data.length; i += 4) {
    const key = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
    let l = seen.get(key);
    if (l === undefined) seen.set(key, (l = relativeLuminance(hex(data[i], data[i + 1], data[i + 2]))));
    lo = Math.min(lo, l);
    hi = Math.max(hi, l);
  }
  return { decoded, text: await svg.getAttribute("data-qr"), modulePx: box.width / size, sc: hi - lo };
}

/** Satılan lot tohumda ilk üretilendir: en küçük lot kodu. Üretici kendi listesinden okur. */
async function soldLot(browser: Browser) {
  const producer = await personaPage(browser, "producer");
  await producer.goto("/tr/izlenebilirlik");
  const codes = (await producer.locator('a[href*="/izlenebilirlik/lot/"]').allTextContents()).map((s) => s.trim()).sort();
  await producer.context().close();
  return codes[0];
}

const flip = (anchor: string) => anchor.slice(0, -1) + (anchor.endsWith("0") ? "1" : "0");

test("üretici lot sayfasından açık pasaporta geçer; girişsiz ziyaretçi sağlam zincirleri, okunur QR'ı görür, iç bilgi görmez", async ({ browser, baseURL }) => {
  test.setTimeout(90_000);
  const producer = await personaPage(browser, "producer");
  await producer.goto("/tr/izlenebilirlik");
  const codes = (await producer.locator('a[href*="/izlenebilirlik/lot/"]').allTextContents()).map((s) => s.trim()).sort();
  const code = codes[0];
  await producer.getByRole("link", { name: code, exact: true }).click();
  await expect(producer).toHaveURL(/\/tr\/izlenebilirlik\/lot\//);
  const notes = (await producer.locator("[data-note]").allTextContents()).map((s) => s.trim()).filter(Boolean);
  expect(notes.length).toBeGreaterThan(0);
  await producer.locator("[data-passport-link]").click();
  await expect(producer).toHaveURL(new RegExp(`/tr/pasaport/${code}$`));
  await producer.context().close();

  // Girişsiz bağlam: çerez yok. Çapa QR'daki adresten değil, açık uçtan alınır.
  const anon = await browser.newContext();
  const page = await anon.newPage();
  const api = await (await anon.request.get(`/api/verify/${code}`)).json();
  expect(api).toMatchObject({ lot: code, ok: true, resultClass: "synthetic" });
  const expected = `${baseURL}/tr/pasaport/${code}?a=${api.anchor}`;
  const res = await page.goto(expected);
  expect(res!.status()).toBe(200);
  await expect(page).toHaveTitle(`Ürün pasaportu ${code} · ReBoard`);
  await expect(page.locator(`article[data-lot-code="${code}"]`)).toHaveAttribute("data-passport", "ok");
  await expect(page.locator("[data-verdict]")).toHaveAttribute("data-verdict", "ok");
  await expect(page.locator("[data-anchor]")).toHaveAttribute("data-anchor", "matched");
  const roles = await page.locator("[data-chain-role]").evaluateAll((els) => els.map((e) => `${e.getAttribute("data-chain-role")}:${e.getAttribute("data-chain")}`));
  expect(roles[0]).toBe("producer:ok");
  expect(roles).toContain("supplier:ok");
  expect(roles.at(-1)).toBe("buyer:ok");
  expect(roles.every((r) => r.endsWith(":ok"))).toBe(true);
  await expect(page.locator('[data-chain-role="producer"]')).toContainText(DEMO_ORGS.reboard.name);
  await expect(page.locator("[data-test-status]")).toHaveAttribute("data-test-status", /^(not_tested|in_progress)$/);
  expect(new Set(await page.locator("[data-result-class]").evaluateAll((els) => els.map((e) => e.getAttribute("data-result-class"))))).toEqual(new Set(["synthetic"]));
  await expect(page.locator('[data-testid="sources"] li[data-batch-code]').first()).toBeVisible();
  await expect(page.locator('[data-step="transforming"]')).not.toHaveCount(0);

  // M-27: iç ekranda görünen notlar, alıcının adı ve kanıt bağlantısı açık sayfada yok.
  const html = await page.content();
  expect(notes.filter((n) => html.includes(n))).toEqual([]);
  expect(html.includes(DEMO_ORGS.f.name)).toBe(false);
  expect(html.includes("/api/evidence/")).toBe(false);
  expect(await seriousViolations(page)).toEqual([]);

  // M-26: QR ekrandan çözülür; adres açık uçtan kurulan adresin kendisi.
  const qr = await readQr(page);
  expect(qr.decoded).toBe(expected);
  expect(qr.text).toBe(expected);
  expect(qr.modulePx).toBeGreaterThanOrEqual(MODULE_PX_MIN);
  expect(qr.sc, `SC ${qr.sc.toFixed(3)}`).toBeGreaterThanOrEqual(SC_MIN);

  // Yeniden doğrulama açık uçtan gelir.
  await page.getByRole("button", { name: "Yeniden doğrula" }).click();
  await expect(page.locator("[data-verify-result]")).toHaveAttribute("data-verify-result", "ok");
  await expect(page.locator("[data-verify-result]")).toContainText("Doğrulama geçti");

  // İngilizce: çapa korunur, QR İngilizce adresi taşır.
  await page.getByRole("link", { name: "English" }).click();
  await expect(page).toHaveURL(`${baseURL}/en/pasaport/${code}?a=${api.anchor}`);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("[data-anchor]")).toHaveAttribute("data-anchor", "matched");
  await expect(page.locator("[data-verdict]")).toContainText("Verification passed");
  expect((await readQr(page)).decoded).toBe(`${baseURL}/en/pasaport/${code}?a=${api.anchor}`);
  expect(await seriousViolations(page)).toEqual([]);
  await anon.close();
});

test("etiket çapası: eşleşmeyen, okunamayan ve eksik çapa ayrı söylenir; açık uç 400 ve 404 döner", async ({ browser }) => {
  const code = await soldLot(browser);
  const anon = await browser.newContext();
  const page = await anon.newPage();
  const ok = await anon.request.get(`/api/verify/${code}`);
  expect(ok.status()).toBe(200);
  expect(ok.headers()["cache-control"]).toBe("no-store");
  expect(ok.headers()["access-control-allow-origin"]).toBe("*");
  const { anchor } = await ok.json();
  expect(anchor).toMatch(/^\d+-[0-9a-f]{64}$/);

  // Başka bir çapa: üretici zinciri o çapaya göre düşer, diğer zincirler sağlam kalır.
  const wrong = flip(anchor);
  const bad = await (await anon.request.get(`/api/verify/${code}?a=${wrong}`)).json();
  expect(bad).toMatchObject({ ok: false, anchorChecked: true });
  expect(bad.chains[0]).toMatchObject({ role: "producer", ok: false, reason: "anchor_mismatch" });
  expect(bad.chains.slice(1).every((c: { ok: boolean }) => c.ok)).toBe(true);
  await page.goto(`/tr/pasaport/${code}?a=${wrong}`);
  await expect(page.locator("article[data-lot-code]")).toHaveAttribute("data-passport", "broken");
  await expect(page.locator("[data-anchor]")).toHaveAttribute("data-anchor", "mismatch");
  await expect(page.locator('[data-chain-role="producer"]')).toHaveAttribute("data-chain", "broken");
  await expect(page.locator("main").getByRole("alert")).toHaveText("Doğrulama geçmedi: en az bir olay zinciri bozuk.");
  expect(await seriousViolations(page)).toEqual([]);

  await page.goto(`/tr/pasaport/${code}?a=zzz`);
  await expect(page.locator("[data-anchor]")).toHaveAttribute("data-anchor", "invalid");
  await expect(page.locator("article[data-lot-code]")).toHaveAttribute("data-passport", "ok");
  await page.goto(`/tr/pasaport/${code}`);
  await expect(page.locator("[data-anchor]")).toHaveAttribute("data-anchor", "missing");
  // Çapasız açılsa da QR çapayı taşır: etikete basılacak olan budur.
  expect((await readQr(page)).decoded).toMatch(new RegExp(`/tr/pasaport/${code}\\?a=${anchor}$`));

  expect((await anon.request.get(`/api/verify/${code}?a=zzz`)).status()).toBe(400);
  expect((await anon.request.get("/api/verify/PL-1999-999")).status()).toBe(404);
  expect((await page.goto("/tr/pasaport/PL-1999-999"))!.status()).toBe(404);
  expect((await page.goto("/tr/pasaport/yok"))!.status()).toBe(404);
  await anon.close();
});

for (const locale of ["tr", "en"]) {
  test(`pasaport (${locale}) beş genişlikte taşmaz, dokunma hedefleri ≥ 44 px, QR okunur ve modül ≥ ${MODULE_PX_MIN} px`, async ({ browser }) => {
    test.setTimeout(90_000);
    const code = await soldLot(browser);
    const anon = await browser.newContext();
    const page = await anon.newPage();
    await page.goto(`/${locale}/pasaport/${code}`);
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      expect(await overflow(page), `${width} px`).toBeLessThanOrEqual(0);
      expect(await gutterBreaches(page), `${width} px`).toEqual([]);
      expect(await escapedAbsolutes(page), `${width} px`).toEqual([]);
      expect(await smallTargets(page), `${width} px`).toEqual([]);
      const qr = await readQr(page);
      expect(qr.decoded, `${width} px`).toBe(qr.text);
      expect(qr.modulePx, `${width} px`).toBeGreaterThanOrEqual(MODULE_PX_MIN);
      expect(qr.sc, `${width} px`).toBeGreaterThanOrEqual(SC_MIN);
      test.info().annotations.push({ type: "M-26", description: `${locale} ${width} px: ${qr.modulePx.toFixed(2)} px/modül, SC ${qr.sc.toFixed(3)}` });
    }
    await anon.close();
  });
}
