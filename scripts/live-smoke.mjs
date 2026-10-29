// Canlı yayının hızlı denetimi: yönlendirme, iki dil, kimlik ucu, giriş akışı, pazar yeri, izlenebilirlik, panel, pasaport, senaryo, SaaS giderleri, fonksiyon bölgesi ve güvenlik başlıkları.
// Yalnızca okur; canlı veritabanına yazmaz.
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
const anonTrace = await get("/tr/izlenebilirlik");
check([307, 308].includes(anonTrace.status) && /\/tr\/giris$/.test(anonTrace.headers.get("location") ?? ""), "oturumsuz /tr/izlenebilirlik → /tr/giris", `${anonTrace.status} ${anonTrace.headers.get("location")}`);
const anonScenario = await get("/tr/senaryo");
check([307, 308].includes(anonScenario.status) && /\/tr\/giris$/.test(anonScenario.headers.get("location") ?? ""), "oturumsuz /tr/senaryo → /tr/giris", `${anonScenario.status} ${anonScenario.headers.get("location")}`);
// Kanıt indirme ucu (D-018): oturumsuz 401. Kimlik uydurmadır; böyle bir kayıt yoktur.
const noEvidence = "/api/evidence/00000000-0000-4000-8000-000000000000";
const anonEvidence = await get(noEvidence);
check(anonEvidence.status === 401, "oturumsuz kanıt indirme 401", anonEvidence.status);
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
  // İzlenebilirlik (T2.2): sağlayıcı teslim ettiği partileri ve kendi zincirinin durumunu görür; yalnızca okunur.
  const trace = await fetch(base + "/tr/izlenebilirlik", { redirect: "manual", headers: { cookie, "user-agent": "reboard-live-smoke" } });
  const traceHtml = await trace.text();
  const batches = (traceHtml.match(/data-batch-code=/g) ?? []).length;
  check(trace.status === 200 && batches > 0 && traceHtml.includes('data-chain="ok"'), "girişli /tr/izlenebilirlik partiler ve sağlam zincir", `${trace.status} · ${batches} parti`);
  const missing = await fetch(base + noEvidence, { redirect: "manual", headers: { cookie, "user-agent": "reboard-live-smoke" } });
  check(missing.status === 404, "girişli, var olmayan kanıt 404", missing.status);
  await post("/api/auth/sign-out", {}, cookie);

  // Panel (T2.3): üretici etki ve tedarik göstergelerini görür; her gösterge sınıf rozetli ve sentetik (D-011, D-024).
  const prod = await post("/api/auth/sign-in/email", { email: "reboard@demo.reboard.example", password: process.env.DEMO_PASSWORD });
  const prodCookie = prod.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  check(prod.status === 200 && prodCookie.length > 0, "demo girişi (ReBoard Pilot Tesisi)", prod.status);
  const prodPanel = await fetch(base + "/tr/panel", { redirect: "manual", headers: { cookie: prodCookie, "user-agent": "reboard-live-smoke" } });
  const prodHtml = await prodPanel.text();
  const kpis = (prodHtml.match(/data-kpi="/g) ?? []).length;
  const classes = new Set([...prodHtml.matchAll(/data-result-class="([a-z_]+)"/g)].map((m) => m[1]));
  check(
    prodPanel.status === 200 && kpis === 8 && classes.size === 1 && classes.has("synthetic") && prodHtml.includes("data-days="),
    "girişli /tr/panel üretici: 8 gösterge, hepsi Sentetik, gün sayısı",
    `${prodPanel.status} · ${kpis} gösterge · ${[...classes].join(",")}`,
  );

  // Pasaport (T2.4, D-025): lot kodu üreticinin listesinden; sayfa ve doğrulama ucu çerezsiz açılır.
  const prodTrace = await (await fetch(base + "/tr/izlenebilirlik", { redirect: "manual", headers: { cookie: prodCookie, "user-agent": "reboard-live-smoke" } })).text();
  const lot = [...new Set([...prodTrace.matchAll(/>(PL-\d{4}-\d{3,9})</g)].map((m) => m[1]))].sort()[0];
  check(Boolean(lot), "üretici listesinde lot kodu", lot);
  if (lot) {
    const passport = await get(`/tr/pasaport/${lot}`);
    const passportHtml = await passport.text();
    const qr = passportHtml.match(/data-qr="([^"]+)"/)?.[1].replaceAll("&amp;", "&") ?? "";
    check(
      passport.status === 200 && passportHtml.includes('data-passport="ok"') && qr.startsWith(`${base}/tr/pasaport/${lot}?a=`),
      "çerezsiz /tr/pasaport: zincirler sağlam, QR canlı adresi ve çapayı taşır",
      `${passport.status} · ${qr.slice(base.length, base.length + 40)}…`,
    );
    const verify = await get(`/api/verify/${lot}`);
    const v = await verify.json();
    check(
      verify.status === 200 && v.ok === true && verify.headers.get("cache-control") === "no-store" && verify.headers.get("access-control-allow-origin") === "*",
      "çerezsiz /api/verify: ok, no-store, CORS",
      `${verify.status} · ${v.chains?.map((c) => `${c.role}:${c.ok}`).join(",")}`,
    );
    const anchored = await (await get(`/api/verify/${lot}?a=${v.anchor}`)).json();
    check(anchored.ok === true && anchored.anchorChecked === true && `${base}/tr/pasaport/${lot}?a=${v.anchor}` === qr, "etiket çapası eşleşir ve QR'dakiyle aynı", v.anchor?.slice(0, 16));
    check((await get("/api/verify/PL-1999-999")).status === 404, "bilinmeyen lot 404");
  }
  // Senaryo (T2.5, D-026, D-029): kaynaklı varsayılanla açılır; ayda 10 t dışında girdi boş, 5 sonuç bilinmiyor, kırmızı yok.
  const scenario = await fetch(base + "/tr/senaryo", { redirect: "manual", headers: { cookie: prodCookie, "user-agent": "reboard-live-smoke" } });
  const scenarioPage = await scenario.text();
  // Sayfanın altındaki karşılaştırma ve SaaS gider tabloları kaynaklı tahmindir; senaryo sınıfı onlardan önceki bölümde sayılır.
  const [scenarioTop, saasHtml = ""] = scenarioPage.split('aria-labelledby="sc-saas"');
  const [scenarioHtml, refHtml = ""] = scenarioTop.split('aria-labelledby="sc-references"');
  const scenarioKpis = (scenarioHtml.match(/data-kpi="scenario-/g) ?? []).length;
  const scenarioClasses = new Set([...scenarioHtml.matchAll(/data-result-class="([a-z_]+)"/g)].map((m) => m[1]));
  const unknownKpis = (scenarioHtml.match(/<dd data-value[^>]*>bilinmiyor</g) ?? []).length;
  const redKpis = (scenarioHtml.match(/data-kpi="scenario-[a-z]+" data-alert="true"/g) ?? []).length;
  const filled = [...scenarioHtml.matchAll(/<input[^>]*id="sc-([A-Za-z]+)"[^>]*>/g)].filter((m) => !/value=""/.test(m[0])).map((m) => m[1]);
  check(
    scenario.status === 200 && scenarioKpis === 5 && scenarioClasses.size === 1 && scenarioClasses.has("synthetic") && unknownKpis === 5 && redKpis === 0 && filled.join() === "wasteT",
    "girişli /tr/senaryo: kaynaklı varsayılan; yalnız ayda 10 t dolu, 5 sonuç Sentetik ve bilinmiyor, kırmızı yok",
    `${scenario.status} · ${scenarioKpis} sonuç · ${[...scenarioClasses].join(",")} · ${unknownKpis} bilinmiyor · ${redKpis} kırmızı · dolu: ${filled.join(",")}`,
  );
  // Karşılaştırma için kaynaklı değerler (D-029): her satırda https kaynak ve okunma tarihi. Levha satırları canlıda tam seed'le (T4.1) gelir; o zamana kadar 3 satır.
  const refRows = (refHtml.match(/<tr[^>]*data-reference="/g) ?? []).length;
  const refSources = (refHtml.match(/data-source[^>]*>(?:(?!<\/th>).)*?<a href="https:\/\//gs) ?? []).length;
  const refDates = (refHtml.match(/>Okunma: 2[78] Eki 2026</g) ?? []).length;
  const refClasses = new Set([...refHtml.matchAll(/data-result-class="([a-z_]+)"/g)].map((m) => m[1]));
  check(
    refRows === 5 && refSources === refRows && refDates === refRows && refClasses.size === 1 && refClasses.has("sourced_estimate") && refHtml.includes(">700 TL/t<") && refHtml.includes(">785 TL/t<"),
    "girişli /tr/senaryo karşılaştırma değerleri: her satır kaynaklı ve tarihli; İBB 700 ve 785 TL/t",
    `${refRows} satır · ${refSources} kaynak · ${refDates} tarih · ${[...refClasses].join(",")}`,
  );
  // SaaS gider tablosu (T2.6, D-027): 4 toplam kutusu, 10 satır, her satırda https kaynak ve okunma tarihi; alt sınır yazılır.
  const saasKpis = (saasHtml.match(/data-kpi="saas-/g) ?? []).length;
  const saasClasses = new Set([...saasHtml.matchAll(/data-result-class="([a-z_]+)"/g)].map((m) => m[1]));
  const saasLines = (saasHtml.match(/data-line="/g) ?? []).length;
  const saasSources = (saasHtml.match(/data-source[^>]*>(?:(?!<\/th>).)*?<a href="https:\/\//gs) ?? []).length;
  // Aynı metin RSC verisinde de geçer; yalnızca öğe içindeki metin sayılır.
  const saasDates = (saasHtml.match(/>Okunma: 27 Eki 2026</g) ?? []).length;
  check(
    saasKpis === 4 && saasClasses.size === 1 && saasClasses.has("sourced_estimate") && saasLines === 10 && saasSources === 10 && saasDates === 10 && saasHtml.includes("en az 991,05 TL/ay"),
    "girişli /tr/senaryo SaaS giderleri: 4 toplam, 10 satır, hepsi kaynaklı ve tarihli; ticari sabit gider en az 991,05 TL/ay",
    `${saasKpis} toplam · ${[...saasClasses].join(",")} · ${saasLines} satır · ${saasSources} kaynak · ${saasDates} tarih`,
  );
  await post("/api/auth/sign-out", {}, prodCookie);
} else {
  console.log("atlandı · demo girişi (DEMO_PASSWORD yok)");
}

console.log(failures.length ? `Canlı denetim BAŞARISIZ (${failures.length}) · ${base}` : `canlı denetim tamam · ${base}`);
process.exit(failures.length ? 1 : 0);
