// R-7: derleme ipucu yalnız rootMainFiles'a, bayt düzeyinde ve bir kez eklenir. Varsayımlar (manifest var, liste dolu,
// SRI yok, kaynak haritası yok) bozulursa derleme sessizce devam etmez, düşer. next.config.ts kancası bu modülü gerçekten çağırır.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { addCompileHints, COMPILE_HINT } from "@/lib/compile-hints";
import nextConfig from "../../next.config";

const ROOT = ["static/chunks/cati-a.js", "static/chunks/turbopack-b.js"];
const OTHER = "static/chunks/sayfa-c.js";
// Çok baytlı karakterler ve satır ayırıcı: metin olarak okuyup yazmak bunları bozabilirdi.
const body = (name: string) => Buffer.from(`(globalThis.TURBOPACK||=[]).push(["${name}",{"ğüş":" "}]);\n`);
let dir = "";

function fixture(manifest: object = { rootMainFiles: ROOT }) {
  dir = mkdtempSync(join(tmpdir(), "ipucu-"));
  mkdirSync(join(dir, "static", "chunks"), { recursive: true });
  for (const f of [...ROOT, OTHER]) writeFileSync(join(dir, f), body(f));
  writeFileSync(join(dir, "build-manifest.json"), JSON.stringify(manifest));
}
const read = (f: string) => readFileSync(join(dir, f));

afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("derleme ipucu", () => {
  it("yalnız çatı parçalarının başına eklenir; dosyanın geri kalanı bayt bayt aynı", () => {
    fixture();
    expect(addCompileHints(dir)).toEqual(ROOT);
    for (const f of ROOT) expect(read(f).equals(Buffer.concat([Buffer.from(COMPILE_HINT), body(f)])), f).toBe(true);
    expect(read(OTHER).equals(body(OTHER))).toBe(true);
  });

  it("ikinci çağrı hiçbir şeyi değiştirmez", () => {
    fixture();
    addCompileHints(dir);
    const once = ROOT.map(read);
    addCompileHints(dir);
    ROOT.forEach((f, i) => expect(read(f).equals(once[i]), f).toBe(true));
  });

  it("V8'in tanıdığı biçim: dosyanın ilk satırı, tek başına", () => {
    expect(COMPILE_HINT).toBe("//# allFunctionsCalledOnLoad\n");
  });

  it.each([
    ["manifest yok", () => rmSync(join(dir, "build-manifest.json")), /build-manifest\.json yok/],
    ["liste boş", () => writeFileSync(join(dir, "build-manifest.json"), JSON.stringify({ rootMainFiles: [] })), /rootMainFiles boş/],
    ["liste yok", () => writeFileSync(join(dir, "build-manifest.json"), "{}"), /rootMainFiles boş/],
    ["parça yok", () => rmSync(join(dir, ROOT[1])), /ENOENT/],
    ["SRI açık", () => (mkdirSync(join(dir, "server")), writeFileSync(join(dir, "server", "subresource-integrity-manifest.json"), "{}")), /SRI/],
    ["kaynak haritası var", () => writeFileSync(join(dir, `${ROOT[0]}.map`), "{}"), /kaynak haritalı/],
  ])("%s: derleme düşer", (_, spoil, message) => {
    fixture();
    spoil();
    expect(() => addCompileHints(dir)).toThrow(message);
  });

  it("next.config.ts kancası derleme çıktısına ipucunu ekler", async () => {
    fixture();
    await nextConfig.compiler?.runAfterProductionCompile?.({ distDir: dir, projectDir: process.cwd() });
    for (const f of ROOT) expect(read(f).subarray(0, COMPILE_HINT.length).toString(), f).toBe(COMPILE_HINT);
  });
});
