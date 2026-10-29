// Çevrimdışı koruma (T4.2, M-33): korumalı alt süreçte dış ad, adlı dns içe aktarımı ve çıplak IP kesilir; yerel çalışır.
// Ağa hiç çıkılmaz: koruma çözümlemeden ve bağlantıdan önce reddeder, yerel sunucu sürecin kendi içindedir.
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const GUARD = pathToFileURL(resolve("scripts/offline-guard.mjs")).href;

const PROBE = `
import http from "node:http";
import net from "node:net";
import { lookup } from "node:dns";
const out = {};
const server = http.createServer((_, res) => res.end("yerel")).listen(0, "127.0.0.1");
await new Promise((r) => server.once("listening", r));
out.local = await (await fetch("http://127.0.0.1:" + server.address().port)).text();
out.fetch = await fetch("http://example.com").then(() => "açık", (e) => e.cause?.code ?? e.code ?? String(e));
out.named = await new Promise((r) => lookup("example.org", (e) => r(e ? e.code : "açık")));
out.localhost = await new Promise((r) => lookup("localhost", (e) => r(e ? e.code : "açık")));
out.ip = await new Promise((r) => {
  const s = net.connect({ host: "93.184.215.14", port: 80 });
  s.once("connect", () => { s.destroy(); r("açık"); });
  s.once("error", (e) => r(e.code));
});
server.close();
console.log(JSON.stringify(out));
`;

// Korumasız karşılaştırma yazılmadı: dış adres gerçekten denenir, CI'da ve filtreli ağda test ağa bağımlı olurdu.
describe("offline-guard", () => {
  it("dış adı, adlı lookup'ı ve çıplak IP'yi keser; yerel bağlantı ve localhost çalışır; her kesişi yazar", () => {
    const r = spawnSync(process.execPath, ["--import", GUARD, "--input-type=module", "-e", PROBE], { encoding: "utf8", timeout: 20_000 });
    expect(r.status, r.stderr).toBe(0);
    const out = JSON.parse(r.stdout.trim().split("\n").at(-1)!);
    expect(out).toEqual({ local: "yerel", fetch: "ENOTFOUND", named: "ENOTFOUND", localhost: "açık", ip: "ENOTFOUND" });
    const lines = r.stderr.match(/\[çevrimdışı\] engellendi: \S+/g) ?? [];
    expect(lines).toEqual(expect.arrayContaining(["[çevrimdışı] engellendi: example.com", "[çevrimdışı] engellendi: example.org", "[çevrimdışı] engellendi: 93.184.215.14"]));
    expect(lines.join(" ")).not.toMatch(/127\.0\.0\.1|localhost/);
  });
});
