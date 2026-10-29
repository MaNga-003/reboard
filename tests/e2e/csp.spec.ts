// CSP (R-6): başlık her sayfada; ana akış sayfalarında ihlal 0, hikâye kareleri ve harita altlığı yüklenir.
// İhlal iki yoldan sayılır: belgedeki securitypolicyviolation olayı ve tarayıcının konsola yazdığı CSP hatası.
// Pazar testi harita yedek metnini de kabul eder (WebGL'siz CI); CSP karoları kesse orada fark edilmezdi.
import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("CSP: başlık var; hikâye, pazar, izlenebilirlik, panel, senaryo ve pasaportta ihlal 0", async ({ page, context }) => {
  test.setTimeout(90_000);
  await context.addInitScript(() =>
    document.addEventListener("securitypolicyviolation", (e) => console.error(`securitypolicyviolation ${e.violatedDirective} ${e.blockedURI}`)),
  );
  const seen: string[] = [];
  page.on("console", (m) => {
    if (/Content Security Policy|securitypolicyviolation/i.test(m.text())) seen.push(`${page.url()} · ${m.text().slice(0, 200)}`);
  });

  const manifest = await page.request.get("/story/manifest.json");
  expect(manifest.ok(), "hikâye kareleri kodlanmamış (pnpm story:encode)").toBe(true);
  const count = (await manifest.json()).variants.d.frames.length as number;
  await page.setViewportSize({ width: 1440, height: 900 });
  const res = await page.goto("/tr");
  const csp = res!.headers()["content-security-policy"] ?? "";
  for (const d of ["default-src 'self'", "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'"]) expect(csp, csp).toContain(d);
  expect(csp, "production'da eval kapalı").not.toContain("unsafe-eval");
  // Hikâye kareleri fetch ile iner ve createImageBitmap ile çözülür; hepsi inmeden ihlal sayımı eksik kalır.
  await expect(page.locator("section canvas")).toHaveAttribute("data-loaded", String(count), { timeout: 60_000 });

  await signIn(page, "producer");
  await page.goto("/tr/pazar");
  // Karo, stil, yazı tipi ve sprite dış adresten gelir; WebGL varsa harita çizilmeli.
  const webgl = await page.evaluate(() => !!document.createElement("canvas").getContext("webgl2"));
  // Yumuşak: düşerse de ihlal listesi sonda yazılsın (hangi yönergenin neyi kestiği orada görünür).
  await expect.soft(page.locator("[data-map-state]")).toHaveAttribute("data-map-state", webgl ? "ready" : "fallback", { timeout: 20_000 });
  test.info().annotations.push({ type: "harita", description: webgl ? "WebGL2 var: altlık çizildi" : "WebGL2 yok: yedek metin (altlık sınanmadı)" });

  await page.goto("/tr/izlenebilirlik");
  const code = (await page.locator('a[href*="/izlenebilirlik/lot/"]').allTextContents()).map((s) => s.trim()).sort()[0];
  expect(code).toBeTruthy();
  for (const path of ["/tr/panel", "/tr/senaryo", `/tr/pasaport/${code}`]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
  }
  expect(seen).toEqual([]);
});
