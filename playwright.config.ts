import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PORT ?? 3100);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${port}`;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { baseURL, trace: "retain-on-failure" },
  // İki ölçüm paralel testlerle karışır, bu yüzden ayrı projedir; test:e2e onları paketten sonra tek işçiyle sırayla koşar.
  // Demo akışı (M-17) ortak veritabanında sayı farkı ölçer: paralel pazar testi araya ilan ekleyince +1 yerine +2 görüyordu.
  // Kare süresi (M-3) ana iş parçacığını ölçer: CI'da paralel testler vsync kaçırtıp p99'u 33–50 ms'ye çıkarıyordu.
  // Dosya yoluyla çağrılınca (canlı iş akışı, demo:offline) yalnız o dosyanın projesi seçilir.
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] }, testIgnore: /(demo|story-perf)\.spec\.ts$/ },
    { name: "demo", use: { ...devices["Desktop Chrome"] }, testMatch: /demo\.spec\.ts$/ },
    { name: "perf", use: { ...devices["Desktop Chrome"] }, testMatch: /story-perf\.spec\.ts$/ },
  ],
  // E2E_BASE_URL verilirse (canlı adres) yerel sunucu açılmaz.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: `pnpm start -p ${port}`, url: baseURL, reuseExistingServer: !process.env.CI, timeout: 120_000 },
});
