// D-003: yayın Frankfurt'ta; CLI yayını yalnızca izin listesindeki dosyaları yükler (M-18).
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Depoda izlenen ama bilerek yüklenmeyen üst düzey yollar. Yeni bir yol eklenince test düşer ve karar ister.
const EXCLUDED = [
  ".claude", ".env.example", ".gitattributes", ".githooks", ".github", ".gitignore", ".gitleaksignore", ".vercelignore",
  ".mcp.json", "AGENTS.md", "ARCHITECTURE.md", "CLAUDE.md", "LICENSE", "README.md", "docs", "drizzle", "drizzle.config.ts",
  "eslint.config.mjs", "playwright.config.ts", "scripts", "state.json", "story", "tests", "vitest.config.mts",
];

const vercel = JSON.parse(readFileSync("vercel.json", "utf8"));
const rules = readFileSync(".vercelignore", "utf8")
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith("#"));
const allowed = new Set(rules.filter((r) => r.startsWith("!/")).map((r) => r.slice(2)));
// Kural kümesi "/*" ve "!/<ad>" biçiminde kaldıkça bir yol yalnızca üst klasörü izinliyse yüklenir.
const uploaded = (path: string) => allowed.has(path.split("/")[0]);
// Vercel Hobby'de CLI yüklemesi en çok 100 MB (vercel.com/docs/limits, okunma 2026-10-28); 10 MB pay (D-004).
const UPLOAD_LIMIT = 90e6;
const du = (p: string): number =>
  statSync(p).isDirectory() ? readdirSync(p).reduce((s, n) => s + du(join(p, n)), 0) : statSync(p).size;

describe("yayın ayarı", () => {
  it("fonksiyonlar fra1'de, çatı Next.js", () => {
    expect(vercel).toMatchObject({ framework: "nextjs", regions: ["fra1"] });
  });

  it(".vercelignore yalnızca '/*' ve '!/<ad>' kurallarından oluşur", () => {
    expect(rules[0]).toBe("/*");
    expect(rules.slice(1).filter((r) => !/^!\/[^/*]+$/.test(r))).toEqual([]);
  });

  it.each([".private/kaynak/rapor.docx", ".env.neon", ".env.local", ".data/pglite/base", ".git/config", ".vercel/project.json", "coverage/index.html", "state.json"])(
    "%s yüklenmez",
    (path) => expect(uploaded(path)).toBe(false),
  );

  it("derleme için gereken her yol yüklenir", () => {
    for (const path of ["src/app/[locale]/page.tsx", "messages/tr.json", "package.json", "pnpm-lock.yaml", "next.config.ts", "tsconfig.json"]) {
      expect(uploaded(path), path).toBe(true);
    }
  });

  it(`yüklenen dosyaların toplamı ≤ ${UPLOAD_LIMIT / 1e6} MB (hikâye kareleri dahil)`, () => {
    const total = [...allowed].filter((p) => existsSync(p)).reduce((s, p) => s + du(p), 0);
    expect(total, `${(total / 1e6).toFixed(1)} MB`).toBeLessThanOrEqual(UPLOAD_LIMIT);
  });

  it.skipIf(!existsSync("public/story/manifest.json"))("kodlanmış hikâye kareleri yüklenir", () => {
    expect(uploaded("public/story/manifest.json")).toBe(true);
  });

  it("izlenen her üst düzey yol ya yüklenir ya da bilerek dışarıda bırakılır; izinli her yol depoda vardır", () => {
    const tracked = new Set(execFileSync("git", ["ls-files"], { encoding: "utf8" }).split("\n").filter(Boolean).map((p) => p.split("/")[0]));
    expect([...tracked].filter((p) => !allowed.has(p) && !EXCLUDED.includes(p))).toEqual([]);
    expect([...allowed].filter((p) => !tracked.has(p))).toEqual([]);
  });
});
