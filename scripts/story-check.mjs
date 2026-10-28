#!/usr/bin/env node
// Hikâye sahnesini render etmeden denetler (story/blender/check.py) ve ölçümleri story/checks.json'a yazar.
// Ölçüm sahne kodunun özetiyle saklanır: kod değişip denetim yeniden koşulmazsa tests/unit/story-scene.test.ts
// düşer. CI'da Blender yok; eşikleri test koyar, ölçüm buradan gelir. Kullanım: pnpm story:check (≈ 2 dk).
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
export const CHECKS_FILE = join(ROOT, "story", "checks.json");

/** story/blender/*.py içeriğinin özeti; satır sonu farkı (CRLF) sayılmaz. */
export function sceneHash(root = ROOT) {
  const dir = join(root, "story", "blender");
  const h = createHash("sha256");
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".py")).sort()) {
    h.update(`${f}\n`);
    h.update(readFileSync(join(dir, f), "utf8").replace(/\r\n/g, "\n"));
  }
  return h.digest("hex");
}

async function main() {
  const BLENDER =
    process.env.BLENDER ??
    (process.platform === "win32" ? "C:\\Program Files\\Blender Foundation\\Blender 4.5\\blender.exe" : "blender");
  if (process.platform === "win32" && !existsSync(BLENDER)) throw new Error(`Blender bulunamadı: ${BLENDER}`);
  const tmp = mkdtempSync(join(tmpdir(), "story-check-"));
  const out = join(tmp, "check.json");
  const hash = sceneHash();
  const started = Date.now();
  const code = await new Promise((ok) => {
    const p = spawn(BLENDER, ["-b", "--factory-startup", "-P", "story/blender/check.py", "--", "--out", out], {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "inherit"],
    });
    p.stdout.on("data", (d) => {
      for (const l of d.toString().split(/\r?\n/)) if (/^S\d .*curves|Error|Traceback/.test(l)) console.log(l);
    });
    p.on("close", ok);
  });
  if (code !== 0 || !existsSync(out)) throw new Error(`Blender ${code} ile çıktı`);
  const result = JSON.parse(readFileSync(out, "utf8"));
  rmSync(tmp, { recursive: true, force: true });
  // Ölçüm sürerken sahne kodu değiştiyse sonuç o koda ait değildir.
  if (sceneHash() !== hash) throw new Error("Denetim sürerken story/blender değişti; yeniden çalıştırın");
  writeFileSync(CHECKS_FILE, `${JSON.stringify({ scene: hash, ...result }, null, 2)}\n`);
  console.log(`story/checks.json yazıldı (${((Date.now() - started) / 60000).toFixed(1)} dk)`);
  console.log(JSON.stringify(result));
}

if (import.meta.main) await main();
