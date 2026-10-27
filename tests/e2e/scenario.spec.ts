// Senaryo ekranı (T2.5, M-28): kaynaklı varsayılan girdiler ve dayanakları (D-029), karşılaştırma için kaynaklı değerler,
// rapor girdileri elle yazılınca rapor sayıları, olumsuz senaryonun kırmızı ve açıklamalı gösterilmesi, bilinmeyen ve
// geçersiz girdi, ekrandaki kırmızının okunurluğu ve beş genişlikte yerleşim (M-12, M-13).
import { expect, test, type Page } from "@playwright/test";
import en from "../../messages/en.json";
import tr from "../../messages/tr.json";
import { SCENARIO_REFERENCES } from "../../src/db/repo/scenario";
import { contrastRatio } from "../../src/design/color";
import { statusHex } from "../../src/design/tokens";
import { buildDemo } from "../../src/db/seed/demo";
import { SCENARIO_FIELDS, formFromParams, paramsFromForm, runScenario, type ScenarioForm } from "../../src/domain/calc";
import type { Decimal } from "../../src/domain/result";
import { fmtMoney } from "../../src/lib/format";
import { REPORT_SCENARIO } from "../fixtures/report-scenario";
import { WIDTHS, escapedAbsolutes, gutterBreaches, overflow, seriousViolations, signIn, smallTargets } from "./helpers";

const rgbHex = (css: string) => {
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(css);
  if (!m) throw new Error(`renk okunamadı: ${css}`);
  return `#${m.slice(1, 4).map((v) => Number(v).toString(16).padStart(2, "0")).join("")}`;
};

async function openScenario(page: Page, locale = "tr") {
  await signIn(page, "producer", locale);
  // Menüden gelinir: bağlantı da ölçülür.
  await page.getByRole("navigation").getByRole("link", { name: locale === "tr" ? "Senaryo" : "Scenario" }).click();
  await expect(page).toHaveURL(new RegExp(`/${locale}/senaryo$`));
  // Kaynaklı girdilerle açılır; dönülecek bir şey olmadığı için düğme kapalı.
  await expect(page.locator("[data-preset=sourced]")).toBeDisabled();
}

const card = (page: Page, id: string) => page.locator(`[data-kpi="scenario-${id}"]`);
const value = (page: Page, id: string) => card(page, id).locator("[data-value]");
const field = (page: Page, key: string) => page.locator(`#sc-${key}`);

/** Raporun yeniden kurulan girdileri (yalnız testte; D-029) forma elle yazılır. */
async function typeReport(page: Page, extra: Partial<ScenarioForm> = {}) {
  const form = { ...formFromParams(REPORT_SCENARIO), ...extra };
  for (const f of SCENARIO_FIELDS) await field(page, f.key).fill(form[f.key]);
  await expect(page.locator("[data-preset=sourced]")).toBeEnabled();
}

test("kaynaklı varsayılan: yalnız ekip planındaki 10 t dolu, sonuçlar bilinmiyor; her girdinin altında dayanağı yazar", async ({ page }) => {
  await openScenario(page);
  for (const f of SCENARIO_FIELDS) {
    await expect(field(page, f.key), f.key).toHaveValue(f.key === "wasteT" ? "10" : "");
    await expect(field(page, f.key), f.key).toHaveAttribute("aria-describedby", `sc-${f.key}-hint`);
    await expect(page.locator(`#sc-${f.key}-hint`), f.key).toHaveText(tr.scenario.basis[f.basis]);
  }
  for (const id of ["factory", "customer", "reboard", "corridor", "saas"]) await expect(value(page, id), id).toHaveText("bilinmiyor");
  const kpis = page.locator('[data-kpi^="scenario-"]');
  await expect(kpis).toHaveCount(5);
  for (const k of await kpis.all()) await expect(k.locator("[data-result-class]")).toHaveAttribute("data-result-class", "synthetic");
  await expect(page.locator('[data-kpi][data-alert="true"]')).toHaveCount(0);
  expect(await seriousViolations(page)).toEqual([]);
});

test("karşılaştırma için kaynaklı değerler: hesaba girmez; her satırda tutar, KDV durumu, kaynak bağlantısı, okunma tarihi ve sınıf", async ({ page }) => {
  await openScenario(page);
  // Beklenen tutarlar kaynak belgelerden (İBB tarifesi, satıcı sayfaları, Eurostat); seed'den değil.
  const want: Record<string, { value: string; note: RegExp; read: string }> = {
    ibbSeymen: { value: "700 TL/t", note: /KDV dahil/, read: "27 Eki 2026" },
    ibbKomurcuoda: { value: "785 TL/t", note: /KDV dahil/, read: "27 Eki 2026" },
    particleboard: { value: "1.471 – 1.911 TL/levha", note: /KDV durumu yazmıyor/, read: "28 Eki 2026" },
    mdf: { value: "3.155 – 3.260 TL/levha", note: /KDV dahil/, read: "28 Eki 2026" },
    electricity: { value: "3,975 TL/kWh", note: /KDV ve geri alınabilir vergiler hariç/, read: "27 Eki 2026" },
  };
  const refs = buildDemo(new Date()).referenceValues;
  const rows = page.locator("tr[data-reference]");
  await expect(rows).toHaveCount(SCENARIO_REFERENCES.length);
  for (const r of SCENARIO_REFERENCES) {
    const row = page.locator(`tr[data-reference="${r.id}"]`);
    const w = want[r.id];
    await expect(row.locator("td[data-value] > span").first(), r.id).toHaveText(w.value);
    await expect(row.locator("th"), r.id).toContainText(w.note);
    await expect(row.locator(`[data-input="${r.input}"]`), r.id).toHaveText(`İlgili girdi: ${tr.scenario.fields[r.input]}`);
    const url = refs.find((x) => x.key === r.keys[0])!.sourceUrl;
    expect(url).toMatch(/^https:\/\//);
    // Aralığın iki ucu aynı sayfadan okunur.
    for (const k of r.keys) expect(refs.find((x) => x.key === k)!.sourceUrl, k).toBe(url);
    const src = row.locator("[data-source]");
    await expect(src.getByRole("link")).toHaveAttribute("href", url);
    await expect(src.getByRole("link")).toHaveText(new URL(url).host);
    await expect(src).toContainText(`Okunma: ${w.read}`);
    await expect(row.locator("[data-result-class]")).toHaveAttribute("data-result-class", "sourced_estimate");
  }
  await expect(page.locator("#sc-references [data-result-class]")).toHaveAttribute("data-result-class", "sourced_estimate");
  // Hesaba girmez: kaynaklı değerler ekrandayken sonuçlar hâlâ bilinmiyor.
  await expect(value(page, "factory")).toHaveText("bilinmiyor");
  expect(await seriousViolations(page)).toEqual([]);
});

test("rapor girdileri yazılınca rapor sayıları çıkar; olumsuz senaryo kırmızı, açıklamalı ve okunur; atık bedeli farkı kapatır", async ({ page }) => {
  await openScenario(page);
  await typeReport(page);
  // Beklenen sayılar raporun metninden (DATA_DICTIONARY §6), alan işlevinden değil.
  await expect(value(page, "factory")).toHaveText("10.000 TL");
  await expect(value(page, "customer")).toHaveText("31.111 TL");
  await expect(value(page, "reboard")).toHaveText("17.500 TL");
  await expect(value(page, "corridor")).toHaveText("222,50 – 271,11 TL/m²");
  await expect(value(page, "saas")).toHaveText("bilinmiyor");
  await expect(card(page, "factory").locator("[data-parts]")).toHaveText("20.000 TL − 10.000 TL = 10.000 TL");
  await expect(card(page, "corridor").locator("[data-parts]")).toHaveText(
    "Alt: 222.500 TL ÷ 1.000 m² = 222,50 TL/m². Üst: 271.111 TL ÷ 1.000 m² = 271,11 TL/m².",
  );
  await expect(card(page, "customer").locator("[data-condition=equivalence_unverified]")).toBeVisible();
  await expect(card(page, "reboard").locator("[data-condition=before_financing_and_tax]")).toBeVisible();
  await expect(card(page, "customer")).toContainText("850 m²");
  await expect(page.locator('[data-kpi][data-alert="true"]')).toHaveCount(0);

  // Raporun olumsuz senaryosu: atık bugün 2.000 TL/t'ye satılıyor.
  await field(page, "wasteSalePerT").fill("2000");
  const factory = card(page, "factory");
  await expect(factory).toHaveAttribute("data-alert", "true");
  await expect(value(page, "factory")).toHaveText(/^[−-]10\.000 TL$/);
  await expect(factory.locator("[data-level=danger]")).toHaveText("Zarar");
  await expect(factory.locator("[data-explain]")).toContainText("atık bedeli");
  await expect(value(page, "customer")).toHaveText("31.111 TL");
  await expect(value(page, "reboard")).toHaveText("17.500 TL");
  await expect(page.locator('[data-kpi][data-alert="true"]')).toHaveCount(1);
  await expect(page.getByRole("status")).toHaveText("Sonuçlar güncellendi. Kırmızı sonuç sayısı: 1.");

  // Kırmızı: kutunun üst çizgisi tehlike dolgusu, zemine ≥ 3:1; çipte yazı dolguya ≥ 4,5:1.
  const danger = statusHex().danger.fill;
  const bg = rgbHex(await page.evaluate(() => getComputedStyle(document.body).backgroundColor));
  const s = await factory.evaluate((e) => {
    const chip = e.querySelector("[data-level=danger]")!;
    return { edge: getComputedStyle(e).borderTopColor, width: getComputedStyle(e).borderTopWidth, text: getComputedStyle(chip).color, fill: getComputedStyle(chip).backgroundColor };
  });
  expect(rgbHex(s.edge)).toBe(danger);
  expect(rgbHex(s.fill)).toBe(danger);
  expect(s.width).toBe("4px");
  expect(contrastRatio(rgbHex(s.edge), bg)).toBeGreaterThanOrEqual(3);
  expect(contrastRatio(rgbHex(s.text), rgbHex(s.fill))).toBeGreaterThanOrEqual(4.5);
  expect(await seriousViolations(page)).toEqual([]);

  // ReBoard 1.000 TL/t atık bedeli öderse fabrikanın 10.000 TL'lik zararı kapanır, ReBoard'un sonucu aynı tutarda düşer.
  await field(page, "wastePaymentPerT").fill("1000");
  await expect(value(page, "factory")).toHaveText("0 TL");
  await expect(factory).toHaveAttribute("data-alert", "false");
  await expect(value(page, "reboard")).toHaveText("7.500 TL");

  // Kaynaklı girdilere dönünce yazılanlar silinir, sonuçlar yeniden bilinmiyor.
  await page.locator("[data-preset=sourced]").click();
  await expect(page.locator("[data-preset=sourced]")).toBeDisabled();
  await expect(field(page, "wasteT")).toHaveValue("10");
  await expect(field(page, "wasteSalePerT")).toHaveValue("");
  await expect(value(page, "factory")).toHaveText("bilinmiyor");
});

test("bilinmeyen ve geçersiz girdi: sonuç bilinmiyor olur, 0 olmaz; zarar ve koridor yokluğu kırmızı; ekran alan işleviyle aynı", async ({ page }) => {
  await openScenario(page);
  await typeReport(page);
  await field(page, "wasteT").fill("");
  await expect(value(page, "factory")).toHaveText("bilinmiyor");
  await expect(value(page, "reboard")).toHaveText("bilinmiyor");
  await expect(value(page, "corridor")).toHaveText("bilinmiyor – 271,11 TL/m²");
  await expect(value(page, "customer")).toHaveText("31.111 TL");
  await expect(page.locator('[data-kpi][data-alert="true"]')).toHaveCount(0);

  await field(page, "wasteT").fill("10");
  await field(page, "collection").fill("-5");
  await expect(field(page, "collection")).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator("#sc-collection-hint")).toHaveText("Sıfır ya da pozitif bir sayı girin. Bu alan bilinmiyor sayıldı.");
  await expect(value(page, "factory")).toHaveText("bilinmiyor");
  await field(page, "customerCutYield").fill("120");
  await expect(page.locator("#sc-customerCutYield-hint")).toContainText("0 ile 100");
  await expect(card(page, "customer")).toContainText("kullanılabilir alanı: bilinmiyor.");

  // Düzeltilen alanın altında yeniden dayanağı yazar.
  await field(page, "collection").fill("6150");
  await expect(field(page, "collection")).not.toHaveAttribute("aria-invalid", "true");
  await expect(page.locator("#sc-collection-hint")).toHaveText(tr.scenario.basis.supplierData);
  await field(page, "customerCutYield").fill("85");
  await field(page, "material").fill("200000");
  await expect(card(page, "reboard")).toHaveAttribute("data-alert", "true");
  await expect(card(page, "corridor")).toHaveAttribute("data-alert", "true");
  await expect(card(page, "corridor").locator("[data-level=danger]")).toHaveText("Koridor yok");
  await field(page, "subscriptionPerMonth").fill("100");
  await field(page, "customerCostPerMonth").fill("150");
  await expect(value(page, "saas")).toHaveText(/^[−-]50 TL$/);
  await expect(page.getByRole("status")).toHaveText("Sonuçlar güncellendi. Kırmızı sonuç sayısı: 3.");

  // Ekrandaki her sonuç, aynı girdilerle alan işlevinin sonucudur (virgüllü ondalık dahil).
  const typed: Partial<ScenarioForm> = { panelPricePerM2: "251,75", sellableAreaM2: "1200", disposalPerT: "700", operations: "70000" };
  for (const [k, v] of Object.entries(typed)) await field(page, k).fill(v!);
  const form = { ...formFromParams(REPORT_SCENARIO), material: "200000", subscriptionPerMonth: "100", customerCostPerMonth: "150", ...typed };
  const r = runScenario(paramsFromForm(form).params);
  const money = (v: Decimal | null) => (v === null ? "bilinmiyor" : `${fmtMoney(v, "tr")} TL`);
  await expect(value(page, "factory")).toHaveText(money(r.factory.value));
  await expect(value(page, "customer")).toHaveText(money(r.customer.value));
  await expect(value(page, "reboard")).toHaveText(money(r.reboard.value));
  await expect(value(page, "saas")).toHaveText(money(r.saas.value));
  await expect(value(page, "corridor")).toHaveText(`${fmtMoney(r.corridor.lower.value!, "tr")} – ${fmtMoney(r.corridor.upper.value!, "tr")} TL/m²`);
});

test("İngilizce: aynı sonuçlar, İngilizce biçim, 0 ciddi a11y ihlali", async ({ page }) => {
  await openScenario(page, "en");
  await expect(page.locator("#sc-wasteT-hint")).toHaveText(en.scenario.basis.teamPlan);
  await expect(page.locator('tr[data-reference="particleboard"] td[data-value] > span').first()).toHaveText("1,471 – 1,911 TL/sheet");
  await expect(page.locator('tr[data-reference="electricity"] td[data-value] > span').first()).toHaveText("3.975 TL/kWh");
  await typeReport(page, { wasteSalePerT: "2000" });
  await expect(value(page, "customer")).toHaveText("31,111 TL");
  await expect(value(page, "corridor")).toHaveText("222.50 – 271.11 TL/m²");
  await expect(value(page, "saas")).toHaveText("unknown");
  await expect(card(page, "factory").locator("[data-result-class]")).toHaveText("Synthetic");
  await expect(card(page, "factory").locator("[data-level=danger]")).toHaveText("Loss");
  await expect(saasValue(page, "commercial-monthly")).toHaveText("at least 991.05 TL/month");
  await expect(saasKpi(page, "commercial-monthly").locator("[data-unknown]")).toHaveText("Unknown: Domain name.");
  await expect(line(page, "commercial", "neon_launch_compute").locator("[data-unit-price]")).toHaveText("Usage-based: 0.106 USD/CU-hour");
  await expect(line(page, "commercial", "domain").locator("th")).toContainText("Vendor not chosen");
  await expect(page.locator("[data-fx]")).toContainText("Rate: 49.5523 TL/USD, 19 Oct 2026 selling rate");
  expect(await seriousViolations(page)).toEqual([]);
});

const saasKpi = (page: Page, id: string) => page.locator(`[data-kpi="saas-${id}"]`);
const saasValue = (page: Page, id: string) => saasKpi(page, id).locator("[data-value]");
const line = (page: Page, stage: string, key: string) => page.locator(`[data-stage="${stage}"] tr[data-line="${key}"]`);

test("SaaS gider tablosu: iki kurulum, her fiyatta kaynak ve tarih; bilinmeyen kalem toplamı bilinmiyor yapar, bilinen kısım alt sınırdır", async ({ page }) => {
  await openScenario(page);
  // Beklenen: Vercel Pro 20 USD × TCMB 49,5523 TL/USD = 991,046 TL (fiyat sayfası ve kur; alan işlevinden değil).
  await expect(saasValue(page, "demo-monthly")).toHaveText("0 TL/ay");
  await expect(saasValue(page, "demo-per-customer")).toHaveText("0 TL/ay");
  await expect(saasValue(page, "commercial-monthly")).toHaveText("en az 991,05 TL/ay");
  await expect(saasKpi(page, "commercial-monthly").locator("[data-unknown]")).toHaveText("Bilinmeyen: Alan adı.");
  await expect(saasValue(page, "commercial-per-customer")).toHaveText("bilinmiyor");
  await expect(saasKpi(page, "commercial-per-customer").locator("[data-unknown]")).toHaveText(
    "Bilinmeyen: Barındırma, Veritabanı işlem gücü ve Veritabanı depolama.",
  );
  const kpis = page.locator('[data-kpi^="saas-"]');
  await expect(kpis).toHaveCount(4);
  for (const k of await kpis.all()) await expect(k.locator("[data-result-class]")).toHaveAttribute("data-result-class", "sourced_estimate");
  await expect(page.locator("#sc-saas [data-result-class]")).toHaveAttribute("data-result-class", "sourced_estimate");

  // Her seed satırı kendi kurulumunda (ortak satır ikisinde de) bir kez; her satırda https kaynak bağlantısı ve okunma tarihi.
  const rows = buildDemo(new Date()).saasCosts;
  for (const stage of ["demo", "commercial"]) {
    const want = rows.filter((r) => r.stage === stage || r.stage === "both").map((r) => r.key);
    const got = await page.locator(`[data-stage="${stage}"] tr[data-line]`).evaluateAll((es) => es.map((e) => e.getAttribute("data-line")));
    expect([...got].sort(), stage).toEqual([...want].sort());
    for (const key of want) {
      const src = line(page, stage, key).locator("[data-source]");
      const url = rows.find((r) => r.key === key)!.sourceUrl;
      expect(url).toMatch(/^https:\/\//);
      await expect(src.getByRole("link")).toHaveAttribute("href", url);
      await expect(src.getByRole("link")).toHaveText(new URL(url).host);
      await expect(src).toContainText("Okunma: 27 Eki 2026");
    }
  }
  await expect(line(page, "commercial", "vercel_pro").locator("[data-monthly]")).toHaveText("20 USD");
  await expect(line(page, "commercial", "vercel_pro").locator("[data-per-customer]")).toHaveText("bilinmiyor");
  await expect(line(page, "commercial", "neon_launch_storage").locator("[data-unit-price]")).toHaveText("Kullanıma bağlı: 0,35 USD/GB-ay");
  await expect(line(page, "commercial", "domain").locator("[data-monthly]")).toHaveText("bilinmiyor");
  await expect(line(page, "commercial", "domain").locator("th")).toContainText("Sağlayıcı seçilmedi");
  await expect(line(page, "demo", "vercel_hobby").locator("th")).toContainText("ticari olmayan");
  const fx = page.locator("[data-fx]");
  await expect(fx).toContainText("Kur: 49,5523 TL/USD, 19 Eki 2026 döviz satış");
  await expect(fx.getByRole("link", { name: "TCMB" })).toHaveAttribute("href", /^https:\/\/www\.tcmb\.gov\.tr\//);
  await expect(fx.locator("[data-result-class]")).toHaveAttribute("data-result-class", "sourced_estimate");
  expect(await seriousViolations(page)).toEqual([]);
});

for (const locale of ["tr", "en"]) {
  test(`senaryo (${locale}) beş genişlikte taşmaz, dokunma hedefi ≥ 44 px`, async ({ page }) => {
    await openScenario(page, locale);
    // En uzun durum: olumsuz senaryo açıklaması ve geçersiz alan uyarısı açık.
    await typeReport(page, { wasteSalePerT: "2000", customerCutYield: "120" });
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      expect(await overflow(page), `${width} px`).toBeLessThanOrEqual(0);
      expect(await gutterBreaches(page), `${width} px`).toEqual([]);
      expect(await escapedAbsolutes(page), `${width} px`).toEqual([]);
      expect(await smallTargets(page), `${width} px`).toEqual([]);
      // Kaynaklı tablolar kendi içinde de kaymaz: kaynak bağlantısı her genişlikte kaydırmadan görünür (T2.6, D-029).
      const hidden = await page.locator("[data-stage] [role=region], section[aria-labelledby=sc-references] [role=region]").evaluateAll((rs) =>
        rs.flatMap((r) => {
          const box = r.getBoundingClientRect();
          const out = r.scrollWidth - r.clientWidth > 0 ? [`${r.getAttribute("aria-label")} ${r.scrollWidth - r.clientWidth} px kayıyor`] : [];
          for (const a of r.querySelectorAll("[data-source] a")) {
            const b = a.getBoundingClientRect();
            if (b.left < box.left || b.right > box.right) out.push(`${a.textContent} görünür alanın dışında`);
          }
          return out;
        }),
      );
      expect(hidden, `${width} px`).toEqual([]);
    }
  });
}
