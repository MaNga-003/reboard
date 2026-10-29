// M-37 (R-7): istemciye yalnız kapsamının çeviri ad alanları gider; her rota iki dilde açılınca istemcide çözülemeyen anahtar 0.
// Birim testi (client-messages.test.ts) kapsamı kaynak grafiğinden doğrular; bu test grafiğin göremediğini yakalar
// (alışılmadık içe aktarma, prop'la gelen anahtar). Gezilen sayfalar rota dosyalarıyla karşılaştırılır: yeni sayfa buraya girmeden geçmez.
import { readdirSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers";

const APP = join("src", "app", "[locale]");
const walk = (d: string): string[] =>
  readdirSync(d).flatMap((f) => {
    const p = join(d, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

/** Rota dosyası → yol kalıbı: grup klasörü düşer, dinamik parça tek bir yol parçasına uyar. */
const ROUTES = walk(APP)
  .filter((p) => p.endsWith(`${sep}page.tsx`))
  .map((p) => {
    const segs = relative(APP, dirname(p)).split(sep).filter((s) => s && !/^\(.*\)$/.test(s));
    const dynamic = segs.filter((s) => s.startsWith("[")).length;
    const re = new RegExp(`^/(?:tr|en)${segs.map((s) => (s.startsWith("[") ? "/[^/]+" : `/${s}`)).join("")}$`);
    return { route: `/${segs.join("/")}`, re, dynamic };
  });

/** Next'in eşleştirmesi gibi: sabit parça dinamikten önce gelir (/pazar/yeni, /pazar/[id] değildir). */
const routeOf = (path: string) =>
  ROUTES.filter((r) => r.re.test(path)).sort((a, b) => a.dynamic - b.dynamic)[0]?.route ?? `(rota yok) ${path}`;

function watchIntl(page: Page) {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (/MISSING_MESSAGE|INSUFFICIENT_PATH/.test(m.text())) errors.push(`${new URL(page.url()).pathname} · ${m.text().split("\n")[0].slice(0, 160)}`);
  });
  return errors;
}

for (const locale of ["tr", "en"] as const) {
  test(`/${locale}: bütün rotalarda istemcide çözülemeyen çeviri 0`, async ({ page }) => {
    test.setTimeout(120_000);
    const errors = watchIntl(page);
    const visited = new Set<string>();
    const visit = async (path: string) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      visited.add(routeOf(new URL(path, "http://x").pathname));
    };
    const first = async (sel: string) => (await page.locator(sel).first().getAttribute("href"))!;

    await visit(`/${locale}`);
    await visit(`/${locale}/giris`);
    await signIn(page, "producer", locale);
    await visit(`/${locale}/panel`);
    await visit(`/${locale}/senaryo`);
    await visit(`/${locale}/pazar`);
    const listing = await first(`main a[href^="/${locale}/pazar/"]:not([href$="/yeni"])`);
    await visit(`/${locale}/pazar/yeni`);
    await visit(listing);
    await visit(`/${locale}/izlenebilirlik`);
    // Akış testi (trace.spec) kendi teslimini eşzamanlı teslim alır; o satır seçilirse sayfa 404 olur.
    const receive = (await page.locator("tr[data-delivery-id]").filter({ hasNotText: "izlenebilirlik" }).first().getByRole("link").getAttribute("href"))!;
    const batch = await first('a[href*="/izlenebilirlik/parti/"]');
    const lot = await first('a[href*="/izlenebilirlik/lot/"]');
    const code = (await page.locator('a[href*="/izlenebilirlik/lot/"]').first().textContent())!.trim();
    for (const path of [receive, batch, `/${locale}/izlenebilirlik/uretim/yeni`, lot, `/${locale}/pasaport/${code}`]) await visit(path);

    expect(ROUTES.map((r) => r.route).filter((r) => !visited.has(r)), "gezilmeyen rota").toEqual([]);
    expect([...visited].filter((r) => r.startsWith("(rota yok)"))).toEqual([]);
    expect(errors).toEqual([]);
  });
}
