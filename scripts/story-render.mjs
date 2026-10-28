#!/usr/bin/env node
// Blender'ı arka planda çalıştırıp hikâye karelerini story/out/{d,m}/ altına üretir.
// Kullanım: node scripts/story-render.mjs [--aspect d,m] [--quality preview|animatic|final] [--sections 1-8]
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith("--") ? [...acc, [a.slice(2), all[i + 1]]] : acc), []),
);
const BLENDER =
  process.env.BLENDER ??
  (process.platform === "win32" ? "C:\\Program Files\\Blender Foundation\\Blender 4.5\\blender.exe" : "blender");
if (process.platform === "win32" && !existsSync(BLENDER)) throw new Error(`Blender bulunamadı: ${BLENDER}`);

const aspects = (args.aspect ?? "d,m").split(",");
const quality = args.quality ?? "animatic";
const sections = args.sections ?? "1-8";

function run(aspect) {
  return new Promise((ok, fail) => {
    const started = Date.now();
    const p = spawn(
      BLENDER,
      ["-b", "--factory-startup", "-P", "story/blender/build.py", "--", "--aspect", aspect, "--quality", quality, "--sections", sections],
      { cwd: ROOT, stdio: ["ignore", "pipe", "inherit"] },
    );
    let tail = "";
    p.stdout.on("data", (d) => {
      tail += d.toString();
      const lines = tail.split(/\r?\n/);
      tail = lines.pop();
      // Yalnız bölüm ve kare özetleri; Cycles'ın satır satır ilerlemesi gürültü.
      for (const l of lines) if (/^S\d|Error|Traceback/.test(l) && !/Fra:/.test(l)) console.log(`[${aspect}] ${l}`);
    });
    p.on("close", (code) => {
      const min = ((Date.now() - started) / 60000).toFixed(1);
      if (code !== 0) return fail(new Error(`Blender ${code} ile çıktı (${aspect})`));
      console.log(`[${aspect}] bitti, ${min} dk`);
      ok();
    });
  });
}

// Tek GPU: en-boy oranları sırayla.
for (const a of aspects) await run(a);
