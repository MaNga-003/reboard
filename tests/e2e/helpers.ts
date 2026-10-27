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
