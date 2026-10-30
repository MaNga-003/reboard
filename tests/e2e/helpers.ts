// E2E ortak ölçüleri: erişilebilirlik, dokunma hedefi (M-12), yatay taşma (M-13) ve demo girişi.
import AxeBuilder from "@axe-core/playwright";
import { expect, type Browser, type Page } from "@playwright/test";

export const WIDTHS = [360, 390, 768, 1024, 1440];
export const TAP_MIN = 44;

export async function seriousViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).analyze();
  return violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id}: ${v.nodes.length}`);
}

/** Görünür her etkileşimli öğenin en küçük kenarı; hata mesajı öğeyi ve ölçüyü söyler. */
export async function smallTargets(page: Page) {
  return page.evaluate((min) => {
    const out: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>("a, button, input:not([type=hidden]), select, textarea, summary")) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height || getComputedStyle(el).visibility === "hidden") continue;
      if (Math.min(r.width, r.height) < min) out.push(`${el.tagName.toLowerCase()} "${(el.textContent ?? "").trim().slice(0, 30)}" ${Math.round(r.width)}×${Math.round(r.height)}`);
    }
    return out;
  }, TAP_MIN);
}

export const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

/**
 * main içindeki öğeler kenar boşluğuna taşmaz: main'in içerik kutusu dışına çıkan her öğe ve kaç px taştığı.
 * Yalnızca sayfa taşmasına bakmak yetmiyor: Windows'ta tarih alanı boşluğa 16 px girip ekran kenarında duruyor,
 * Linux'ta 3 px daha geniş çizildiği için taşıyordu. Kaydırılan ya da kırpılan kapların içi sayılmaz.
 */
export async function gutterBreaches(page: Page) {
  return page.evaluate(() => {
    const main = document.querySelector("main");
    if (!main) return ["main yok"];
    const cs = getComputedStyle(main);
    const box = main.getBoundingClientRect();
    const left = box.left + parseFloat(cs.paddingLeft);
    const right = box.right - parseFloat(cs.paddingRight);
    const clipped = (el: Element) => {
      for (let p = el.parentElement; p && p !== main; p = p.parentElement) if (getComputedStyle(p).overflowX !== "visible") return true;
      return false;
    };
    const out: string[] = [];
    for (const el of main.querySelectorAll<HTMLElement>("*")) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height || clipped(el)) continue;
      const over = Math.max(r.right - right, left - r.left);
      if (over > 0.5) out.push(`${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""} "${(el.textContent ?? "").trim().slice(0, 25)}" ${over.toFixed(1)} px`);
    }
    return out;
  });
}

/**
 * Kaydırılan kabın içindeki mutlak konumlu öğe (ör. sr-only başlık) konumunu o kabın içinden almalı; yoksa kırpılmaz,
 * sayfayı taşırır. Taşma veriye bağlı: yalnızca tablo ekrandan genişken görünür (uzun ilan başlığıyla 16 px).
 * Bu ölçü veriden bağımsızdır: kaçan her öğeyi tablo dar da olsa yakalar.
 */
export async function escapedAbsolutes(page: Page) {
  return page.evaluate(() => {
    const out: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>("body *")) {
      if (getComputedStyle(el).position !== "absolute") continue;
      // display:none altındaki öğenin yerleşimi yok (offsetParent null); sayfayı taşıramaz. Mobilde gizlenen kenar çubuğu ve
      // başlık görselleri bu yüzden sayılmaz. sr-only gibi 1 px'lik görünmez öğelerin kutusu vardır ve sayılmaya devam eder.
      if (!el.getClientRects().length) continue;
      let scroller: HTMLElement | null = null;
      for (let p = el.parentElement; p && !scroller; p = p.parentElement) if (getComputedStyle(p).overflowX !== "visible") scroller = p;
      if (scroller && !(el.offsetParent && scroller.contains(el.offsetParent))) out.push(`${el.tagName.toLowerCase()} "${(el.textContent ?? "").trim().slice(0, 25)}"`);
    }
    return out;
  });
}

export async function signIn(page: Page, persona: string, locale = "tr") {
  await page.goto(`/${locale}/giris`);
  await page.locator(`main [data-persona="${persona}"]`).click();
  await expect(page).toHaveURL(new RegExp(`/${locale}/panel$`));
}

/** Her rol kendi tarayıcı bağlamında: çerezler karışmaz, iki taraf aynı anda açık kalır. */
export async function personaPage(browser: Browser, persona: string, locale = "tr") {
  const page = await (await browser.newContext()).newPage();
  await signIn(page, persona, locale);
  return page;
}
