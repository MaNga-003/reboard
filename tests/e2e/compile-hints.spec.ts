// R-7: derleme ipucu üretim çıktısında. Next'in rootMainFiles listesindeki her parça sayfada yüklenir ve sunucudan ipucuyla
// gelir; sayfanın yüklediği diğer parçalar ipucusuz kalır (V8: az kullanın). Liste diskteki build-manifest'ten okunur.
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { COMPILE_HINT } from "../../src/lib/compile-hints";

test("derleme ipucu: hikâye sayfasının çatı parçalarında var, diğer parçalarında yok", async ({ page }) => {
  test.skip(!!process.env.E2E_BASE_URL, "canlı adreste diskteki manifest o yayına ait değil");
  const root: string[] = JSON.parse(readFileSync(".next/build-manifest.json", "utf8")).rootMainFiles;
  const loaded = new Set<string>();
  page.on("response", (r) => {
    const m = new URL(r.url()).pathname.match(/^\/_next\/(static\/chunks\/.+\.js)$/);
    if (m) loaded.add(m[1]);
  });
  await page.goto("/tr");
  await page.waitForLoadState("networkidle");
  expect(root.filter((f) => !loaded.has(f)), "sayfa çatı parçasını yüklemedi").toEqual([]);
  expect(loaded.size, "çatı dışında parça yok; 'diğerleri ipucusuz' sınanmadı").toBeGreaterThan(root.length);
  for (const f of loaded) {
    const text = await (await page.request.get(`/_next/${f}`)).text();
    expect(text.startsWith(COMPILE_HINT), f).toBe(root.includes(f));
  }
});
