// Temel duman testi: dil yönlendirmesi, iki dilde açılış, erişilebilirlik, yatay taşma. Kimlik akışı auth.spec.ts'de.
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("Türkçe tarayıcı", () => {
  test.use({ locale: "tr-TR" });
  test("/ → /tr yönlenir", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/tr$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "tr");
  });
});

for (const locale of ["tr", "en"] as const) {
  test(`/${locale} açılır, demo uyarısı görünür, ciddi a11y ihlali yok`, async ({ page }) => {
    await page.goto(`/${locale}`);
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("note")).toBeVisible();
    const { violations } = await new AxeBuilder({ page }).analyze();
    const serious = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  });

  for (const width of [360, 390, 768, 1024, 1440]) {
    test(`/${locale} ${width}px'te yatay taşma yok`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(`/${locale}`);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
}
