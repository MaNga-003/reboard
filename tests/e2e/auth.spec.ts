// Kimlik akışı (T1.5): demo rolüyle giriş, rol değiştirme, çıkış; erişilebilirlik, taşma ve dokunma hedefi (M-12, M-13).
// Sunucu seed'li veritabanıyla ve DEMO_PASSWORD ile çalışır (CI: db:seed adımı).
import { expect, test } from "@playwright/test";
import { permissionList } from "../../src/domain/access";
import { TAP_MIN, WIDTHS, overflow, seriousViolations, signIn, smallTargets } from "./helpers";

const allowed = (role: string) => permissionList(role).filter((p) => p.allowed).length;

test("oturum yokken panel giriş sayfasına yönlenir", async ({ page }) => {
  await page.goto("/tr/panel");
  await expect(page).toHaveURL(/\/tr\/giris$/);
});

test("demo rolüyle giriş, rol değiştirme ve çıkış", async ({ page }) => {
  await signIn(page, "supplier");
  await expect(page.getByTestId("viewer")).toHaveText("Konfeksiyon A · Sahip");
  await expect(page.locator('[data-allowed="true"]')).toHaveCount(allowed("owner"));

  await page.getByText("Rol değiştir").click();
  await page.locator('header [data-persona="viewer"]').click();
  await expect(page.getByTestId("viewer")).toHaveText("ReBoard Pilot Tesisi · İzleyici");
  await expect(page.locator('[data-allowed="true"]')).toHaveCount(0);

  await page.getByRole("button", { name: "Çıkış" }).click();
  await expect(page).toHaveURL(/\/tr\/giris$/);
  await page.goto("/tr/panel");
  await expect(page).toHaveURL(/\/tr\/giris$/);
});

test("İngilizce arayüzde aynı akış", async ({ page }) => {
  await signIn(page, "buyer", "en");
  await expect(page.getByTestId("viewer")).toHaveText("Mobilya Atölyesi F · Owner");
});

test("hatalı parola tek ve genel bir hata verir", async ({ page }) => {
  await page.goto("/tr/giris");
  await page.getByRole("textbox", { name: "E-posta", exact: true }).fill("kaynak-a@demo.reboard.example");
  await page.getByLabel("Parola", { exact: true }).fill("yanlis-parola");
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await expect(page.locator("main").getByRole("alert")).toHaveText("E-posta ya da parola hatalı.");
  await expect(page).toHaveURL(/\/tr\/giris$/);
});

test("kayıt kapalı: e-postayla yeni hesap açılamaz", async ({ request }) => {
  const res = await request.post("/api/auth/sign-up/email", {
    data: { email: `smoke-${Date.now()}@example.test`, password: "duman-testi-parola-1", name: "Duman" },
  });
  expect(res.status(), await res.text()).toBeGreaterThanOrEqual(400);
  expect(res.status()).toBeLessThan(500);
});

for (const locale of ["tr", "en"] as const) {
  test(`/${locale}/giris ve /${locale}/panel: 0 ciddi a11y ihlali`, async ({ page }) => {
    await page.goto(`/${locale}/giris`);
    expect(await seriousViolations(page)).toEqual([]);
    await signIn(page, "producer", locale);
    await page.locator("header summary").click();
    expect(await seriousViolations(page)).toEqual([]);
  });
}

for (const width of WIDTHS) {
  test(`${width}px: giriş ve panelde taşma 0, dokunma hedefi ≥ ${TAP_MIN} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/tr/giris");
    expect(await overflow(page)).toBeLessThanOrEqual(0);
    expect(await smallTargets(page)).toEqual([]);
    await signIn(page, "producer");
    await page.locator("header summary").click();
    expect(await overflow(page)).toBeLessThanOrEqual(0);
    expect(await smallTargets(page)).toEqual([]);
  });
}
