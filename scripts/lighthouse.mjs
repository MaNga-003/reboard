#!/usr/bin/env node
// Hızlı açılır (M-11): Lighthouse, production build'de, mobil ve masaüstü. Sonuçlar .lighthouseci/ altına yazılır (git dışı).
// Kullanım: pnpm perf:lh [https://adres]. Adres verilmezse yerel production sunucusu 3300'de açılır (önce pnpm build ve seed).
// Yöntem: her sayfa benzetimle (Lantern) 3 kez, ortanca alınır. Mobil LCP ayrıca uygulanan yavaşlatmayla (devtools) ölçülür ve eşik
// ona uygulanır: localhost'ta JS ilk boyamadan önce indiği için benzetim LCP'yi JS'e bağlı sayıp ikiye katlıyor (FCP 0,9 s, LCP 3,8 s;
// uygulanan yavaşlatmada ikisi de 1,8 s). TBT benzetimden okunur: uygulanan yavaşlatmada hikâye kareleri ağı boşa düşürmez, TBT çıkmaz.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium } from "@playwright/test";

const ROOT = resolve(import.meta.dirname, "..");
const OUT = join(ROOT, ".lighthouseci");
const LIGHTHOUSE = "lighthouse@13.5.0";
const RUNS = 3;
const LIMIT = { lcp: 2500, cls: 0.1, tbt: 200, jsKiB: 200 };
const PAGES = [
  { name: "/tr mobil", path: "/tr", preset: "mobile", jsBudget: true },
  { name: "/tr masaüstü", path: "/tr", preset: "desktop", jsBudget: true },
  // Jüri pasaportu QR'la telefonda açar.
  { name: "pasaport mobil", path: "/tr/pasaport/PL-2026-001", preset: "mobile", jsBudget: false },
];

const given = process.argv[2];
const BASE = given ?? "http://localhost:3300";
mkdirSync(OUT, { recursive: true });

let server = null;
let serverLog = "";
if (!given) {
  if (!existsSync(join(ROOT, ".next", "BUILD_ID"))) throw new Error("production build yok: önce pnpm build");
  server = spawn("pnpm start -p 3300", { cwd: ROOT, stdio: ["ignore", "ignore", "pipe"], shell: true });
  server.stderr.on("data", (b) => (serverLog = (serverLog + b).slice(-2000)));
  const t0 = Date.now();
  for (;;) {
    try {
      if ((await fetch(`${BASE}/tr`)).ok) break;
    } catch {}
    if (Date.now() - t0 > 60_000) throw new Error(`${BASE} 60 sn içinde açılmadı`);
    await new Promise((r) => setTimeout(r, 500));
  }
}
const stop = () => {
  if (!server || server.exitCode !== null) return;
  if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"], { stdio: "ignore" });
  else server.kill("SIGTERM");
};

function lighthouse(url, preset, method, file) {
  const flags = [`--only-categories=performance`, `--throttling-method=${method}`, `--chrome-flags="--headless=new"`, `--output=json`, `--output-path=${JSON.stringify(file)}`, "--quiet"];
  if (preset === "desktop") flags.push("--preset=desktop");
  const r = spawnSync(`pnpm dlx ${LIGHTHOUSE} ${JSON.stringify(url)} ${flags.join(" ")}`, {
    cwd: ROOT,
    shell: true,
    env: { ...process.env, CHROME_PATH: chromium.executablePath() },
    encoding: "utf8",
  });
  if (r.status !== 0 || !existsSync(file)) throw new Error(`lighthouse ${url} (${method}) başarısız: ${r.stderr.slice(-400)}`);
  const a = JSON.parse(readFileSync(file, "utf8")).audits;
  const script = a["resource-summary"].details.items.find((x) => x.resourceType === "script");
  return {
    fcp: a["first-contentful-paint"].numericValue,
    lcp: a["largest-contentful-paint"].numericValue,
    tbt: a["total-blocking-time"].numericValue ?? null,
    cls: a["cumulative-layout-shift"].numericValue,
    jsKiB: script.transferSize / 1024,
  };
}

// Uzun Lighthouse koşusundan sonra ilk istek, sunucunun boşta kapattığı keep-alive soketine düşüp ECONNRESET alabiliyor.
async function statusOf(url) {
  for (let i = 0; ; i++) {
    try {
      return (await fetch(url, { headers: { connection: "close" } })).status;
    } catch (e) {
      if (server && server.exitCode !== null) throw new Error(`sunucu kapandı (${server.exitCode}): ${serverLog.slice(-600)}`);
      if (i === 2) throw e;
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}

const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const rows = [];
let failed = 0;
try {
  for (const p of PAGES) {
    const url = `${BASE}${p.path}`;
    const status = await statusOf(url);
    if (status !== 200) throw new Error(`${url} ${status}: seed yüklü mü (pnpm db:seed)?`);
    const slug = `${p.path.replace(/\W+/g, "_")}-${p.preset}`;
    const sim = Array.from({ length: RUNS }, (_, i) => lighthouse(url, p.preset, "simulate", join(OUT, `${slug}-sim-${i}.json`)));
    const applied = p.preset === "mobile" ? lighthouse(url, p.preset, "devtools", join(OUT, `${slug}-dt.json`)) : null;
    const m = {
      page: p.name,
      fcp: median(sim.map((r) => r.fcp)),
      lcpSim: median(sim.map((r) => r.lcp)),
      lcpApplied: applied?.lcp ?? null,
      tbt: median(sim.map((r) => r.tbt)),
      cls: Math.max(...sim.map((r) => r.cls), applied?.cls ?? 0),
      jsKiB: sim[0].jsKiB,
    };
    const lcp = m.lcpApplied ?? m.lcpSim;
    const bad = [
      lcp > LIMIT.lcp && `LCP ${lcp.toFixed(0)} ms`,
      m.tbt > LIMIT.tbt && `TBT ${m.tbt.toFixed(0)} ms`,
      m.cls > LIMIT.cls && `CLS ${m.cls.toFixed(3)}`,
      p.jsBudget && m.jsKiB > LIMIT.jsKiB && `JS ${m.jsKiB.toFixed(1)} KiB`,
    ].filter(Boolean);
    failed += bad.length;
    rows.push({ ...m, bad });
    console.log(
      `${bad.length ? "AŞTI " : "tamam"} · ${p.name} · FCP ${m.fcp.toFixed(0)} · LCP ${lcp.toFixed(0)} ms${m.lcpApplied !== null ? ` (benzetim ${m.lcpSim.toFixed(0)})` : ""} · TBT ${m.tbt.toFixed(0)} ms · CLS ${m.cls.toFixed(3)} · JS ${m.jsKiB.toFixed(1)} KiB${bad.length ? ` · ${bad.join(", ")}` : ""}`,
    );
  }
} finally {
  stop();
}
writeFileSync(join(OUT, "summary.json"), JSON.stringify({ base: BASE, lighthouse: LIGHTHOUSE, runs: RUNS, limit: LIMIT, rows }, null, 2) + "\n");
console.log(failed ? `${failed} eşik aşıldı (eşikler: LCP ≤ ${LIMIT.lcp} ms, TBT ≤ ${LIMIT.tbt} ms, CLS ≤ ${LIMIT.cls}, / JS ≤ ${LIMIT.jsKiB} KiB)` : "hızlı açılır: bütün eşikler tamam");
process.exit(failed ? 1 : 0);
