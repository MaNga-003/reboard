import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PORT ?? 3100);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${port}`;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { baseURL, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // E2E_BASE_URL verilirse (canlı adres) yerel sunucu açılmaz.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: `pnpm start -p ${port}`, url: baseURL, reuseExistingServer: !process.env.CI, timeout: 120_000 },
});
