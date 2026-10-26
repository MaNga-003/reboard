import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    testTimeout: 30_000,
    coverage: {
      provider: "v8",
      include: ["src/domain/**/*.ts", "src/design/**/*.ts"],
      reporter: ["text-summary", "json-summary"],
      // M-5: alan mantığı kapsamı en az %90.
      thresholds: { "src/domain/**": { lines: 90, functions: 90, branches: 90, statements: 90 } },
    },
  },
});
