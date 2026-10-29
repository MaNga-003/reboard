// R-7: V8 açık derleme ipucu (v8.dev/blog/explicit-compile-hints). Dosyanın başındaki sihirli yorum V8'e dosyanın bütün
// işlevlerini indirme sürerken arka planda derlemesini söyler; ana iş parçacığı ilk çağrıda tembel derlemeyi beklemez.
// Yalnızca her sayfada açılışta çalışan çatı parçalarına konur (Next'in rootMainFiles listesi): V8 "az kullanın" diyor,
// fazla derleme zaman ve bellek yer. Derleme sonunda next.config.ts'teki runAfterProductionCompile kancası çağırır.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const COMPILE_HINT = "//# allFunctionsCalledOnLoad\n";

export function addCompileHints(distDir: string): string[] {
  const manifest = join(distDir, "build-manifest.json");
  if (!existsSync(manifest)) throw new Error(`derleme ipucu: ${manifest} yok`);
  // Satır eklemek SRI özetini ve kaynak haritasının satır eşlemesini bozar; ikisi de açılırsa sessiz bozulma yerine derleme düşer.
  if (existsSync(join(distDir, "server", "subresource-integrity-manifest.json"))) {
    throw new Error("derleme ipucu: SRI açıkken parçalar değiştirilemez");
  }
  const files: unknown = JSON.parse(readFileSync(manifest, "utf8")).rootMainFiles;
  if (!Array.isArray(files) || files.length === 0) throw new Error("derleme ipucu: rootMainFiles boş");
  for (const file of files as string[]) {
    const path = join(distDir, file);
    if (existsSync(`${path}.map`)) throw new Error(`derleme ipucu: ${file} kaynak haritalı; satır kayar`);
    const body = readFileSync(path);
    // Bayt düzeyinde ekleme: dosyanın geri kalanı aynen kalır. İkinci çağrı bir şey değiştirmez.
    if (!body.subarray(0, COMPILE_HINT.length).equals(Buffer.from(COMPILE_HINT))) {
      writeFileSync(path, Buffer.concat([Buffer.from(COMPILE_HINT), body]));
    }
  }
  return files as string[];
}
