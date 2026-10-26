// Canlı yayının hızlı denetimi: yönlendirme, iki dil, kimlik ucu, fonksiyon bölgesi ve güvenlik başlıkları.
// Türk Telekom "Güvenli İnternet" *.vercel.app'i yönlendirdiği için GitHub Actions'ta çalışır (live-smoke.yml).
// Kullanım: node scripts/live-smoke.mjs [https://adres]
const base = (process.argv[2] ?? process.env.LIVE_URL ?? "https://reboard-lovat.vercel.app").replace(/\/$/, "");
const failures = [];
const check = (ok, what, got) => {
  console.log(`${ok ? "tamam" : "HATA "} · ${what}${got === undefined ? "" : ` · ${got}`}`);
  if (!ok) failures.push(what);
};
const get = (path) => fetch(base + path, { redirect: "manual", headers: { "user-agent": "reboard-live-smoke" } });

const root = await get("/");
check([307, 308].includes(root.status) && /\/tr$/.test(root.headers.get("location") ?? ""), "/ → /tr yönlendirmesi", `${root.status} ${root.headers.get("location")}`);

for (const lang of ["tr", "en"]) {
  const r = await get(`/${lang}`);
  const html = await r.text();
  check(r.status === 200 && html.includes(`lang="${lang}"`), `/${lang} 200 ve lang="${lang}"`, r.status);
  if (lang === "tr") {
    // Bu başlıklar next.config.ts'de tanımlı; yayında da gelmeli.
    const h = r.headers;
    check(h.get("x-content-type-options") === "nosniff", "X-Content-Type-Options", h.get("x-content-type-options"));
    check(h.get("x-frame-options") === "DENY", "X-Frame-Options", h.get("x-frame-options"));
    check(h.get("referrer-policy") === "strict-origin-when-cross-origin", "Referrer-Policy", h.get("referrer-policy"));
  }
}

const ok = await get("/api/auth/ok");
const body = await ok.text();
check(ok.status === 200 && /"ok":\s*true/.test(body), "/api/auth/ok", `${ok.status} ${body.slice(0, 40)}`);
// x-vercel-id: "<kenar>::<fonksiyon bölgesi>::<kimlik>". D-003: fonksiyonlar Frankfurt'ta.
const vid = ok.headers.get("x-vercel-id") ?? "";
check(vid.split("::").includes("fra1"), "fonksiyon bölgesi fra1", vid);

console.log(failures.length ? `Canlı denetim BAŞARISIZ (${failures.length}) · ${base}` : `canlı denetim tamam · ${base}`);
process.exit(failures.length ? 1 : 0);
