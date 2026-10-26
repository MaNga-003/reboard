// D-003: yayın Frankfurt'ta; CLI yayını yalnızca izin listesindeki dosyaları yükler (M-18).
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const vercel = JSON.parse(readFileSync("vercel.json", "utf8"));
const rules = readFileSync(".vercelignore", "utf8")
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith("#"));
const allowed = new Set(rules.filter((r) => r.startsWith("!/")).map((r) => r.slice(2)));
// Kural kümesi "/*" ve "!/<ad>" biçiminde kaldıkça bir yol yalnızca üst klasörü izinliyse yüklenir.
const uploaded = (path: string) => allowed.has(path.split("/")[0]);

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

  it("derleme için gereken her yol yüklenir ve izinli her yol depoda vardır", () => {
    for (const path of ["src/app/[locale]/page.tsx", "messages/tr.json", "package.json", "pnpm-lock.yaml", "next.config.ts", "tsconfig.json"]) {
      expect(uploaded(path), path).toBe(true);
    }
    const top = new Set(readdirSync("."));
    expect([...allowed].filter((p) => !top.has(p))).toEqual([]);
  });
});
