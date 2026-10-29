#!/usr/bin/env node
// Çevrimdışı demo (T4.2, D-003): Neon ve internet olmadan, production build ve yerel PGlite ile http://localhost:3000.
// Sıra: migrasyon → demo seed (.data/pglite boşaltılır) → derleme eskiyse derleme → sunucu (offline-guard ile).
// DATABASE_URL zorla boşaltılır; .env.local'de doluysa hiç başlamaz: canlı veritabanı yanlışlıkla boşaltılmasın.
// Kipler:
//   (yok)     sunucuyu açık tutar; sahnede yedek 1 (DEMO.md).
//   --check   demo testini bu sunucuda, tarayıcıda da yerel dışı istekler kesik koşar; sunucunun engellenen bağlantı sayısını yazar.
//   --video   demo testini DEMO.md süreleriyle koşar, 1920 × 1080 kaydı .private/demo/reboard-demo.mp4 yapar (yedek 2).
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = resolve(import.meta.dirname, "..");
const PORT = 3000;
const BASE = `http://localhost:${PORT}`;
const mode = process.argv.includes("--video") ? "video" : process.argv.includes("--check") ? "check" : "serve";

const localUrl = /^DATABASE_URL=(.*)$/m.exec(existsSync(join(ROOT, ".env.local")) ? readFileSync(join(ROOT, ".env.local"), "utf8") : "")?.[1]?.trim();
if (localUrl) {
  console.error(".env.local içinde DATABASE_URL dolu: çevrimdışı demo yerel PGlite ister, canlı veritabanına dokunmaz. Boşaltıp yeniden deneyin.");
  process.exit(1);
}

const env = {
  ...process.env,
  DATABASE_URL: "",
  DEMO_MODE: "true",
  BETTER_AUTH_URL: BASE,
  NEXT_TELEMETRY_DISABLED: "1",
};

function run(cmd, extra = {}) {
  console.log(`> ${cmd}`);
  const r = spawnSync(cmd, { cwd: ROOT, env: { ...env, ...extra }, stdio: "inherit", shell: true });
  if (r.status !== 0) throw new Error(`${cmd} başarısız (${r.status})`);
}

/** Derleme, kaynaktan (src, messages, next.config.ts, public/story manifest) yeniyse geçerlidir. */
function newestMtime(dir) {
  let max = 0;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    max = Math.max(max, e.isDirectory() ? newestMtime(p) : statSync(p).mtimeMs);
  }
  return max;
}
function buildIsStale() {
  const id = join(ROOT, ".next", "BUILD_ID");
  if (!existsSync(id)) return true;
  // Yapılandırma da derlemeyi değiştirir (başlıklar, derleme ipucu kancası; D-031).
  const sources = [newestMtime(join(ROOT, "src")), newestMtime(join(ROOT, "messages")), statSync(join(ROOT, "next.config.ts")).mtimeMs];
  const manifest = join(ROOT, "public", "story", "manifest.json");
  if (existsSync(manifest)) sources.push(statSync(manifest).mtimeMs);
  return Math.max(...sources) > statSync(id).mtimeMs;
}

async function waitReady(server, ms = 90_000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (server.exitCode !== null) throw new Error("sunucu kapandı");
    try {
      if ((await fetch(`${BASE}/tr`)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`${BASE} ${ms / 1000} sn içinde açılmadı`);
}

function stop(server) {
  if (server.exitCode !== null) return;
  if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"], { stdio: "ignore" });
  else server.kill("SIGTERM");
}

function findVideo(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      const v = findVideo(p);
      if (v) return v;
    } else if (e.name.endsWith(".webm")) return p;
  }
  return null;
}

run("pnpm db:migrate");
run("pnpm db:seed");
if (buildIsStale() || process.argv.includes("--build")) run("pnpm build");
else console.log("Derleme güncel; yeniden derlenmedi (--build ile zorlanır).");

// --import Windows yolunu URL şeması sanır ("c:"); dosya URL'si verilir.
const guard = `--import ${JSON.stringify(pathToFileURL(join(ROOT, "scripts", "offline-guard.mjs")).href)}`;
const server = spawn(`pnpm start -p ${PORT}`, {
  cwd: ROOT,
  env: { ...env, NODE_OPTIONS: `${env.NODE_OPTIONS ?? ""} ${guard}`.trim() },
  stdio: ["ignore", "inherit", "pipe"],
  shell: true,
});
let blocked = 0;
server.stderr.on("data", (b) => {
  const s = b.toString();
  blocked += (s.match(/\[çevrimdışı\] engellendi/g) ?? []).length;
  process.stderr.write(s);
});
process.on("SIGINT", () => {
  stop(server);
  process.exit(130);
});

try {
  await waitReady(server);
  if (mode === "serve") {
    console.log(`Çevrimdışı demo hazır: ${BASE}/tr (durdurmak için Ctrl+C)`);
    await new Promise((r) => server.on("exit", r));
  } else {
    const out = join(ROOT, ".private", "demo", mode === "video" ? "video-run" : "check-run");
    rmSync(out, { recursive: true, force: true });
    // Video internet varken önceden kaydedilir: tarayıcı harita döşemelerini indirir, DEMO.md 2. adımdaki "haritada
    // görünür" ekranda olur. Sunucu yine yerel PGlite'tadır ve yerel dışı bağlantıları kesiktir.
    run(`pnpm exec playwright test tests/e2e/demo.spec.ts --output ${JSON.stringify(out)}`, {
      E2E_BASE_URL: BASE,
      ...(mode === "video" ? { DEMO_PACE: "1" } : { DEMO_OFFLINE: "1" }),
    });
    console.log(`Sunucunun engellenen yerel dışı bağlantısı: ${blocked}`);
    if (mode === "video") {
      const webm = findVideo(out);
      if (!webm) throw new Error("video bulunamadı");
      const mp4 = join(ROOT, ".private", "demo", "reboard-demo.mp4");
      mkdirSync(join(ROOT, ".private", "demo"), { recursive: true });
      run(`ffmpeg -y -loglevel error -i ${JSON.stringify(webm)} -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p -movflags +faststart ${JSON.stringify(mp4)}`);
      const probe = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration:stream=width,height", "-of", "json", mp4], { encoding: "utf8" });
      const info = JSON.parse(probe.stdout);
      const s = info.streams.find((x) => x.width);
      const duration = Number(info.format.duration);
      console.log(`Video: ${mp4}, ${duration.toFixed(1)} s, ${s.width}×${s.height}, ${(statSync(mp4).size / 1e6).toFixed(1)} MB`);
      // Ölçüyle kabul: süre DEMO.md §2'nin son bitişine ±5 s, tam HD, siyah kesit yok (donmuş ya da boş kayıt sahnede fark edilmez).
      // Adımlar demo testinin ayrıştırıcısından okunur (Node .ts tiplerini siler); belge değişince kabul de değişir.
      const { demoSteps } = await import(pathToFileURL(join(ROOT, "tests", "e2e", "demo-doc.ts")).href);
      const expected = Math.max(...demoSteps(readFileSync(join(ROOT, "docs", "DEMO.md"), "utf8")).map((s) => s.end));
      const black = spawnSync("ffmpeg", ["-hide_banner", "-i", mp4, "-vf", "blackdetect=d=0.5:pix_th=0.10", "-an", "-f", "null", "-"], { encoding: "utf8" });
      const blackSpans = (black.stderr.match(/black_start/g) ?? []).length;
      const bad = [
        Math.abs(duration - expected) > 5 && `süre ${duration.toFixed(1)} s, DEMO.md ${expected} s`,
        (s.width !== 1920 || s.height !== 1080) && `boyut ${s.width}×${s.height}`,
        blackSpans > 0 && `${blackSpans} siyah kesit`,
      ].filter(Boolean);
      if (bad.length) throw new Error(`video kabul edilmedi: ${bad.join("; ")}`);
      console.log(`Video kabul: DEMO.md ${expected} s (fark ${(duration - expected).toFixed(1)} s), siyah kesit 0`);
    }
  }
} finally {
  stop(server);
}
