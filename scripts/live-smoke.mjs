// Canlı yayının hızlı denetimi: yönlendirme, iki dil, kimlik ucu, giriş akışı, fonksiyon bölgesi ve güvenlik başlıkları.
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

// Giriş: sayfa demo rollerini sunar, oturumsuz panel girişe yönlenir, kayıt kapalıdır (D-010).
const signin = await get("/tr/giris");
const signinHtml = await signin.text();
check(signin.status === 200 && signinHtml.includes('data-persona="supplier"'), "/tr/giris demo rolleri", signin.status);
const anon = await get("/tr/panel");
check([307, 308].includes(anon.status) && /\/tr\/giris$/.test(anon.headers.get("location") ?? ""), "oturumsuz /tr/panel → /tr/giris", `${anon.status} ${anon.headers.get("location")}`);
const anonMarket = await get("/tr/pazar");
check([307, 308].includes(anonMarket.status) && /\/tr\/giris$/.test(anonMarket.headers.get("location") ?? ""), "oturumsuz /tr/pazar → /tr/giris", `${anonMarket.status} ${anonMarket.headers.get("location")}`);
const post = (path, body, cookie) =>
  fetch(base + path, {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/json", origin: base, "user-agent": "reboard-live-smoke", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });
const signUp = await post("/api/auth/sign-up/email", { email: `smoke-${Date.now()}@example.test`, password: "kayit-kapali-mi-1", name: "Duman" });
check(signUp.status >= 400 && signUp.status < 500, "kayıt kapalı", signUp.status);

// Parola yalnızca ortamdan gelir ve yazdırılmaz; yoksa bu adım atlanır.
if (process.env.DEMO_PASSWORD) {
  const login = await post("/api/auth/sign-in/email", { email: "kaynak-a@demo.reboard.example", password: process.env.DEMO_PASSWORD });
  const cookie = login.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  check(login.status === 200 && cookie.length > 0, "demo girişi (Konfeksiyon A)", login.status);
  const panel = await fetch(base + "/tr/panel", { redirect: "manual", headers: { cookie, "user-agent": "reboard-live-smoke" } });
  check(panel.status === 200 && (await panel.text()).includes("Konfeksiyon A · Sahip"), "girişli /tr/panel kurum ve rol", panel.status);
  // Pazar yeri (T2.1): ilan kartları ve sonuç sınıfı rozeti (D-011) yayında da gelmeli.
  const market = await fetch(base + "/tr/pazar", { redirect: "manual", headers: { cookie, "user-agent": "reboard-live-smoke" } });
  const marketHtml = await market.text();
  const cards = (marketHtml.match(/data-listing-id=/g) ?? []).length;
  check(market.status === 200 && cards > 0 && marketHtml.includes('data-result-class="synthetic"'), "girişli /tr/pazar ilan kartları ve Sentetik rozeti", `${market.status} · ${cards} kart`);
  await post("/api/auth/sign-out", {}, cookie);
} else {
  console.log("atlandı · demo girişi (DEMO_PASSWORD yok)");
}

console.log(failures.length ? `Canlı denetim BAŞARISIZ (${failures.length}) · ${base}` : `canlı denetim tamam · ${base}`);
process.exit(failures.length ? 1 : 0);
