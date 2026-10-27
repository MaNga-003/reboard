// Etki ve tedarik paneli (T2.3): dürüstlük (M-15), sayfa içi tutarlılık, ekrandaki durum çipi kontrastı,
// grafik yazılarının çakışmaması (M-25) ve beş genişlikte yerleşim (M-12, M-13).
// Diğer E2E akışları ortak veritabanına parti ekler; bu yüzden sabit sayı değil, sayfadaki sayıların kendi tutarlılığı ölçülür.
import { expect, test, type Page } from "@playwright/test";
import { contrastRatio } from "../../src/design/color";
import { Decimal } from "../../src/domain/result";
import { coverLevel, coverThresholds } from "../../src/domain/supply";
import { TAP_MIN, WIDTHS, escapedAbsolutes, gutterBreaches, overflow, seriousViolations, signIn, smallTargets } from "./helpers";

/** Her gösterge sınıf rozeti taşır; bilinmeyen "bilinmiyor" yazar, 0 yazmaz; alt sınır "en az" der. */
async function honesty(page: Page) {
  return page.evaluate(() => {
    const out: string[] = [];
    for (const k of document.querySelectorAll<HTMLElement>("[data-kpi]"))
      if (!k.querySelector("[data-result-class]")) out.push(`rozetsiz gösterge: ${k.dataset.kpi}`);
    for (const el of document.querySelectorAll<HTMLElement>('main [data-kg="unknown"]'))
      if (el.textContent?.trim() !== document.documentElement.dataset.unknownText) out.push(`bilinmeyen kg "${el.textContent}"`);
    for (const el of document.querySelectorAll<HTMLElement>("main [data-unknown]"))
      if (Number(el.dataset.unknown) > 0 && !/^(en az|at least) /.test(el.textContent ?? "")) out.push(`alt sınır işaretsiz "${el.textContent}"`);
    return out;
  });
}

/**
 * Grafikteki yazılar birbirine, noktalara ve veri işaretine değmez: yazı kutusu 1 px adımla taranır, çizgi ve sütun üstünde nokta aranır.
 * Yerleşim yazı kutusunu tahminle kurar (chart-layout, CHAR_W); gerçek yazı kutusu o tahminin içinde kalmalı, yoksa birim testteki çakışmasızlık ekrana taşınmaz.
 */
async function chartCollisions(page: Page) {
  return page.evaluate(() => {
    const out: string[] = [];
    const overlap = (a: DOMRect, b: DOMRect) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
    for (const svg of document.querySelectorAll<SVGSVGElement>("main [role=group] svg")) {
      const texts = [...svg.querySelectorAll("text")].filter((t) => t.textContent);
      const boxes = texts.map((t) => t.getBBox());
      for (let i = 0; i < boxes.length; i++)
        for (let j = i + 1; j < boxes.length; j++) if (overlap(boxes[i], boxes[j])) out.push(`"${texts[i].textContent}" ~ "${texts[j].textContent}"`);
      texts.forEach((t, i) => {
        if (!t.dataset.box) return;
        const [x0, y0, x1, y1] = t.dataset.box.split(" ").map(Number);
        const b = boxes[i];
        // 0,5 px pay: harf çıkıntısı bağlantı ucunda 0,4 px ölçüldü ("7 gün: Kritik", 1024 px); toFixed(1) yuvarlaması 0,05 px.
        const tol = 0.5;
        if (b.x < x0 - tol || b.x + b.width > x1 + tol || b.y < y0 - tol || b.y + b.height > y1 + tol)
          out.push(`"${t.textContent}" tahmin kutusunu aşıyor: gerçek ${b.x.toFixed(1)},${b.y.toFixed(1)} ${b.width.toFixed(1)}×${b.height.toFixed(1)}, tahmin ${t.dataset.box}`);
      });
      for (const ln of svg.querySelectorAll<SVGLineElement>("g[data-threshold] line")) {
        const r = ln.getBBox();
        const stroke = new DOMRect(r.x, r.y - 0.5, r.width, 1);
        boxes.forEach((b, i) => {
          if (overlap(b, stroke)) out.push(`"${texts[i].textContent}" ${ln.closest("g")!.getAttribute("data-threshold")} günlük eşik çizgisine değiyor`);
        });
      }
      for (const c of svg.querySelectorAll<SVGCircleElement>("circle[data-mark]")) {
        // Noktanın 2 px zemin halkası da sayılır (stroke yarısı 1 px dışarı taşar).
        const r = c.getBBox();
        const ring = new DOMRect(r.x - 1, r.y - 1, r.width + 2, r.height + 2);
        boxes.forEach((b, i) => {
          if (overlap(b, ring)) out.push(`"${texts[i].textContent}" ${c.dataset.mark} noktasına değiyor`);
        });
      }
      const marks = [...svg.querySelectorAll<SVGPathElement>("path[data-series]")];
      const pt = svg.createSVGPoint();
      boxes.forEach((b, i) => {
        for (let x = Math.ceil(b.x); x <= b.x + b.width; x++)
          for (let y = Math.ceil(b.y); y <= b.y + b.height; y++) {
            pt.x = x;
            pt.y = y;
            const hit = marks.find((m) => (m.getAttribute("fill") === "none" ? m.isPointInStroke(pt) : m.isPointInFill(pt)));
            if (hit) {
              out.push(`"${texts[i].textContent}" ${hit.dataset.series} işaretine değiyor (${x},${y})`);
              return;
            }
          }
      });
    }
    return out;
  });
}

const rgbHex = (css: string) => {
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(css);
  if (!m) throw new Error(`renk okunamadı: ${css}`);
  return `#${m.slice(1, 4).map((v) => Number(v).toString(16).padStart(2, "0")).join("")}`;
};

async function openPanel(page: Page, persona: string, locale = "tr") {
  await signIn(page, persona, locale);
  await page.evaluate((t) => (document.documentElement.dataset.unknownText = t), locale === "tr" ? "bilinmiyor" : "unknown");
}

test("üretici: göstergeler sınıflı, gün sayısı stok ÷ ihtiyaç, düzey eşiklerden; uyarılar ve projeksiyon var", async ({ page }) => {
  await openPanel(page, "producer");
  expect(await honesty(page)).toEqual([]);
  const kpis = page.locator("[data-kpi]");
  expect(await kpis.count()).toBe(8);
  // Demo verisinin tamamı sentetik (D-011).
  await expect(page.locator("[data-kpi] [data-result-class]").first()).toHaveText("Sentetik");
  expect(new Set(await page.locator("main [data-result-class]").evaluateAll((els) => els.map((e) => e.getAttribute("data-result-class"))))).toEqual(new Set(["synthetic"]));

  const usable = new Decimal((await page.locator('[data-kpi="usable"] [data-kg]').getAttribute("data-kg"))!);
  const need = new Decimal((await page.locator('[data-kpi="need"] [data-kg]').getAttribute("data-kg"))!);
  const days = new Decimal((await page.locator("[data-days]").getAttribute("data-days"))!);
  expect(days.eq(usable.div(need))).toBe(true);
  const th = page.locator("[data-green]");
  const t = coverThresholds((await th.getAttribute("data-green"))!, (await th.getAttribute("data-yellow"))!);
  await expect(page.locator('[data-kpi="days"] [data-level]')).toHaveAttribute("data-level", coverLevel(days, t)!);

  // Kantar fişi kontrol bekleyen ve tartımı bilinmeyen birer parti var: bekleyen miktar alt sınırdır.
  await expect(page.locator('[data-kpi="pending"] [data-kg]')).toHaveAttribute("data-unknown", "1");
  await expect(page.locator('[data-alert="pending"]')).toHaveCount(1);
  await expect(page.locator('[data-alert="concentration"]')).toHaveCount(1);
  await expect(page.locator("[data-co2=hidden]")).toBeVisible();

  // Kırmızıya iniş günü grafikte işaretli ve uyarıyla aynı gün.
  const alert = page.locator('[data-alert="projected_danger"]');
  if ((await alert.count()) > 0) {
    const day = /\((\d+)\. gün\)/.exec((await alert.textContent())!)![1];
    await expect(page.locator(`[data-marker-day="${day}"]`)).toHaveCount(1);
  }
});

test("durum çipleri ekranda okunur: yazı dolguya ≥ 4,5, kenarlık zemine ≥ 3", async ({ page }) => {
  await openPanel(page, "producer");
  const bg = rgbHex(await page.evaluate(() => getComputedStyle(document.body).backgroundColor));
  const chips = await page.locator("main [data-level]:not(li)").evaluateAll((els) =>
    els.map((e) => {
      const s = getComputedStyle(e);
      return { level: e.getAttribute("data-level"), color: s.color, fill: s.backgroundColor, border: s.borderTopColor };
    }),
  );
  expect(chips.length).toBeGreaterThan(0);
  for (const c of chips) {
    const text = contrastRatio(rgbHex(c.color), rgbHex(c.fill));
    const edge = contrastRatio(rgbHex(c.border), bg);
    expect(text, `${c.level} yazı/dolgu ${text.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
    expect(edge, `${c.level} kenarlık/zemin ${edge.toFixed(2)}`).toBeGreaterThanOrEqual(3);
  }
});

test("klavyeyle projeksiyon: ipucu ilk ve son günde kenara taşmaz, ekran okuyucuya okunur", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await openPanel(page, "producer");
  const chart = page.getByRole("group", { name: "30 günlük stok projeksiyonu" });
  await chart.focus();
  for (const key of ["Home", "End"]) {
    await page.keyboard.press(key);
    await expect(chart.locator("[aria-live]")).toContainText(" gün");
    expect(await gutterBreaches(page), key).toEqual([]);
    expect(await overflow(page)).toBeLessThanOrEqual(0);
  }
  await expect(chart.locator("[aria-live]")).toContainText(/Kritik|Dikkat|Yeterli/);
});

test("sağlayıcı yalnızca kendi teslim ettiğini görür; panel alıcısında iki bölüm de boş durumda", async ({ browser }) => {
  const supplier = await (await browser.newContext()).newPage();
  await openPanel(supplier, "supplier");
  expect(await honesty(supplier)).toEqual([]);
  await expect(supplier.locator('[data-kpi="verified"]')).toHaveCount(1);
  await expect(supplier.locator('[data-kpi="inPanel"]')).toHaveCount(0);
  await expect(supplier.locator('[data-section="supply"] [data-kpi]')).toHaveCount(0);
  await expect(supplier.locator("[data-counterparty]")).toHaveCount(1);

  const buyer = await (await browser.newContext()).newPage();
  await openPanel(buyer, "buyer");
  await expect(buyer.locator("[data-kpi]")).toHaveCount(0);
  await expect(buyer.locator('[data-section="impact"]')).toContainText("kayıtlı atık partisi yok");
  await expect(buyer.locator('[data-section="supply"]')).toContainText("hammadde teslim alan kurumlarda");
});

test("İngilizce panel: aynı göstergeler, 0 ciddi a11y ihlali", async ({ page }) => {
  await openPanel(page, "producer", "en");
  expect(await honesty(page)).toEqual([]);
  await expect(page.locator("[data-kpi]")).toHaveCount(8);
  await expect(page.locator("[data-kpi] [data-result-class]").first()).toHaveText("Synthetic");
  for (const d of await page.locator("main details").all()) await d.locator("summary").click();
  expect(await seriousViolations(page)).toEqual([]);
});

for (const width of WIDTHS) {
  test(`${width}px: tablolar açıkken taşma 0, dokunma hedefi ≥ ${TAP_MIN} px, grafik yazıları çakışmaz`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await openPanel(page, "producer");
    for (const d of await page.locator("main details").all()) await d.locator("summary").click();
    expect(await overflow(page)).toBeLessThanOrEqual(0);
    expect(await gutterBreaches(page)).toEqual([]);
    expect(await escapedAbsolutes(page)).toEqual([]);
    expect(await smallTargets(page)).toEqual([]);
    expect(await chartCollisions(page)).toEqual([]);
    // Demo verisinde iki eşik yazısı ve varsa iniş yazısı çizilir (sığmayan yazı düşer; birim test oranı ölçer).
    const labels = await page.evaluate(() => ({
      thresholds: document.querySelectorAll("g[data-threshold]").length,
      thresholdTexts: document.querySelectorAll("g[data-threshold] text").length,
      markers: document.querySelectorAll("g[data-marker-day]").length,
      markerTexts: document.querySelectorAll("g[data-marker-day] text").length,
    }));
    expect(labels.thresholds).toBe(2);
    expect(labels).toMatchObject({ thresholdTexts: 2, markerTexts: labels.markers });
    if (width === 390) expect(await seriousViolations(page)).toEqual([]);
  });
}
