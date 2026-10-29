# Araştırma: kaynaklar ve çıkarımlar

> Kararları besleyen kaynaklar. Her kaynağın yanında platformda neyi değiştirdiği yazar. Erişim tarihi: 2026-10-27, aksi belirtilmedikçe.

## 1. Pazar yeri ve güven

| Kaynak | Çıkarım | Platformdaki karşılığı |
| --- | --- | --- |
| [Reverse Resources](https://circulareconomy.europa.eu/platform/fr/node/2363) (AB Döngüsel Ekonomi Platformu) | Model önce fabrika için bir dijital atık deposu sunuyor, eşleştirme sonra geliyor: "önce araç için gelir, ağ için kalır" | Sağlayıcı kendi atığının panele dönüştüğünü görür; pazar yeri tek başına değer değil |
| [Endüstriyel simbiyozda güven, sistematik derleme](https://www.researchsquare.com/article/rs-6274333/v1) | Güven şeffaflık, belgelenmiş miktar ve tekrar eden işlemle oluşuyor | Doğrulanmış kg ana metrik (D-013); tedarikçi güvenilirliği skoru |
| [Platform başarısı, ajan tabanlı model](https://www.sciencedirect.com/science/article/pii/S0921800924003999) (Ecological Economics) | Kritik kütleye ulaşmadan platform sönüyor; erken aşamada bir çapa oyuncu gerekiyor | ReBoard üreticisi çapa alıcıdır; demo Antalya OSB bağlamında |
| [ABD Adalet Bakanlığı ve FTC, 2023 Birleşme Rehberi](https://www.justice.gov/atr/media/1329301/dl?inline), §2.1 | HHI 1.800'ün üstündeki piyasa "yüksek yoğunlaşmış" sayılıyor. Rehber rekabet hukuku içindir; tek alıcının tedarik riskine uyarlaması bizim yorumumuzdur | Tedarik panelinde HHI son 90 günün kabul edilen kg'ıyla hesaplanır, 1.800 üstünde yoğunlaşma uyarısı çıkar (D-024) |

## 2. İzlenebilirlik ve ürün pasaportu

| Kaynak | Çıkarım | Platformdaki karşılığı |
| --- | --- | --- |
| [GS1 EPCIS ve CBV rehberi](https://ref.gs1.org/guidelines/epcis-cbv/) | Dönüşüm `TransformationEvent` ile, girdi ve çıktı miktarlarıyla kaydedilir | `custody_events` EPCIS türlerini ve CBV `bizStep` sözlüğünü kullanır (D-012) |
| [ISO 22095 kütle dengesi (2026)](https://www.iso.org/contents/news/2026/03/new-iso-standards-bring-clarity.html) | Gözetim zinciri modelleri: kimlik koruma, ayrıştırma, kütle dengesi | Kütle dengesi denetimi ve açıklama zorunluluğu. %2 tolerans bu kaynaktan alınmadı; platformun kuralıdır (`DATA_DICTIONARY.md`) |
| [AB DPP tekstil takvimi](https://single-market-economy.ec.europa.eu/single-market/digital-product-passport/textile-apparel_en) | Tekstil için yasal düzenleme 2027'nin 4. çeyreğinde bekleniyor | Pasaport şimdiden açık ve makine okunur; F5'te UNTP biçimine dışa aktarım |
| [UNTP DPP](https://spec-untp-fbb45f.opensource.unicc.org/docs/specification/DigitalProductPassport), [open-dpp](https://github.com/open-dpp/open-dpp) | Doğrulanabilir kimlik bilgisiyle pasaport | F5: `T5.1` |

## 3. Karbon

| Kaynak | Çıkarım | Platformdaki karşılığı |
| --- | --- | --- |
| [Sandin ve Peters (JCP 2018), Chalmers derlemesi](https://research.chalmers.se/en/publication/503200) | Tekstil yeniden kullanımı ve geri dönüşümünün etkisi neyin ikame edildiğine çok bağlı | CO₂e tek sayı olarak verilmez |
| Refashion EPR değerlendirmesi (`pro.refashion.fr/en/environmental-assessment-EPR-sector`) | Sayfa 2026-10-27'de 404 veriyor. Daha önce buradan alınan 0,4–5,8 kg CO₂e/kg aralığı şu an doğrulanamıyor | `co2e_range` için katsayı yok. Doğrulanmış bir kaynak bulunana kadar CO₂e gösterilmez; `reference_values` tablosuna da yazılmaz |
| [JRC134586, AB kullanılmış ve atık tekstil yönetimi değerlendirmesi (2023)](https://publications.jrc.ec.europa.eu/repository/handle/JRC134586) | Özet sayfası kg başına sera gazı kazancı vermiyor; rakamlar tam raporda olabilir | CO₂e katsayısı için incelenecek aday kaynak |

## 4. Scroll anlatımı

| Kaynak | Çıkarım | Platformdaki karşılığı |
| --- | --- | --- |
| [Codrops: GSAP ile sinematik 3D scroll](https://tympanus.net/codrops/2025/11/19/how-to-build-cinematic-3d-scroll-experiences-with-gsap/) | Scroll ile scrub edilen sahne, sabit canvas | Oynatıcı yapısı |
| [Scroll-scrubbed sequence](https://tessl.io/registry/skills/github/MengTo/Skills/scroll-scrubbed-visual-sequence), [dev.to: Next.js, GSAP, canvas](https://dev.to/pratham7711/how-i-made-a-scroll-scrubbed-video-portfolio-fast-nextjs-15-gsap-canvas-1mj6) | `<video>` ile kare aramak gecikmeli; kare dizisi canvas'ta daha hassas | Kare dizisi seçildi (D-004) |
| [GSAP README](https://cdn.jsdelivr.net/npm/gsap@3.15.0/README.md) | GSAP ve eklentileri ücretsiz | İlk sürümde ScrollTrigger lisans sorunu olmadan kullanıldı. Sonra aynı eğri oynatıcıya taşındı (R-7); GSAP yalnızca testte kâhin |
| [CSS `animation-timeline` desteği](https://www.cssportal.com/css-properties/animation-timeline.php) | Firefox'ta hâlâ bayrak arkasında | JS tabanlı yapı |
| [CHI'26: scrollytelling çalışması](https://arxiv.org/abs/2603.04367) | Etkileşimi artırıyor, anlamaya etkisi küçük | Rakamlar hikâyenin dışında, panelde de veriliyor |
| [EOX WMTS yetenek belgesi](https://tiles.maps.eox.at/wmts/1.0.0/WMTSCapabilities.xml), katman `s2cloudless` ("Sentinel-2 cloudless layer for 2016 by EOX - 4326"); [EOxCloudless lisans özeti](https://cloudless.eox.at/documentation/license). Okunma: 2026-10-29 | 2016 katmanı [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) ile yayımlanmış; künye "EOxCloudless https://cloudless.eox.at by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2016)". Sonraki yılların katmanları ticari olmayan ya da ücretli lisanslı: yalnız 2016 kullanılır | 8. bölümün yeri ve Dünya küresi (`scripts/story-imagery.mjs`, karolar `s2cloudless` WGS84 z4–z13); künye ana sayfada hikâyenin altında (`home.imageryCredit`) |

## 5. Altyapı ve hukuk

| Kaynak | Çıkarım | Platformdaki karşılığı |
| --- | --- | --- |
| [Vercel Hobby ve org depoları](https://community.vercel.com/t/question-about-github-organization-repository-and-vercel-hobby-plan/1386) | Herkese açık org deposundan yayın mümkün görünüyor | Yedek yol: GitHub Actions ve Vercel CLI (R-2) |
| [OpenFreeMap](https://openfreemap.org) | API anahtarsız, ücretsiz vektör harita karoları | Pazar yeri haritası, MapLibre ile |
| [KVKK yurt dışına aktarım rehberi](https://www.erdem-erdem.av.tr/bilgi-bankasi/yurt-disina-kisisel-veri-aktarimi-rehberi-neleri-duzenliyor) | Frankfurt'ta barındırma, standart sözleşme ya da açık rıza gerektirir | MVP'de yalnızca demo verisi; F5'te `T5.2` |
| [Better Auth ve Drizzle ile SaaS mimarisi](https://makerkit.dev/courses/nextjs-drizzle/architecture-and-technologies) | Organizasyon eklentisiyle çok kiracılı yapı | D-010, D-016 |
| [V8: Explicit compile hints](https://v8.dev/blog/explicit-compile-hints) (29 Nisan 2025). Okunma: 2026-10-29 | Dosyanın başındaki `//# allFunctionsCalledOnLoad` yorumu, dosyadaki işlevleri arka plan iş parçacığında, ağ yüklemesiyle örtüşerek derletir; Chrome 136'dan beri. "should be used sparingly though - compiling too much will consume time and memory!" | Yalnız her sayfada çalışan çatı parçalarına konur (D-031, M-11) |
| [Next.js derleyicisi: `runAfterProductionCompile`](https://nextjs.org/docs/architecture/nextjs-compiler) (16.4.3 belgesi, `node_modules/next/dist/docs/03-architecture`). Okunma: 2026-10-29 | Üretim derlemesi bitince, sayfa üretiminden önce çalışan kanca; `distDir` verir. Kaynakta (`dist/build/index.js`) Turbopack derlemesi ve manifest yazımından sonra çağrılıyor | `next.config.ts` → `src/lib/compile-hints.ts` (D-031) |
| [Vercel: Configuring a build](https://vercel.com/docs/builds/configure-a-build). Okunma: 2026-10-29 | Next.js projesinde `package.json`'daki `build` betiği, yoksa `next build` çalışır | Kanca yayında da çalışır; `.vercelignore` izin listesi değişmez |

## 6. Ekip belgeleri (git dışı, `.private/kaynak/`)

| Belge | Kullanıldığı yer |
| --- | --- |
| Jüri cevapları ve maliyet hesabı (PDF) | Dürüstlük kuralları, ürün parametreleri, maliyet aralıkları |
| Maliyet ve veri raporu (DOCX, Şerife) | 11 tablo, formüller, karar kapıları, referans değerler |
| Ekip planı, 30 Ekim (DOCX) | Takvim, görev dağılımı, hedef sayılar |
| Sunum (PPTX) | Hikâye ve ana mesaj. Jüri belgesiyle çelişen ifadeler Q-3'te |

## 7. Renk

- [MaNga-003/dictionary-of-colour-combinations](https://github.com/MaNga-003/dictionary-of-colour-combinations): Sanzo Wada sözlüğünün 159 rengi ve 348 kombinasyonu (MIT).
- Ölçüm yöntemi: OKLab ΔE, WCAG 2 kontrastı, Machado 2009 renk körlüğü benzetimi.

## 8. Arayüzdeki olgular (T4.7, D-028)

Arayüz metinlerinde (`messages/{tr,en}.json`) sayı, kurum, yasa ya da standart adı geçen her anahtar burada bir kez yer alır. `tests/unit/facts.test.ts` metinleri tarar (M-34). Listede olmayan yeni bir anahtar testi düşürür. Listede olup metinlerde artık bulunmayan anahtar da testi düşürür.

Dayanak türleri:

- **kaynak:** Dış dünyaya ait bir olgu. Satırda birincil kaynak bağlantısı ve okunma tarihi bulunur.
- **kural:** Platformun kendi kuralı. Satırda karar ya da belge referansı bulunur.
- **ekip:** Ekibin hedefi ya da planı. Arayüz onu hedef ya da plan olarak yazar; satırda karar ya da belge referansı bulunur.

Seed'deki kaynaklı değerlerin bağlantısını ve okunma tarihini `tests/integration/seed.test.ts` denetler. Aşağıdaki "kaynak" satırları, bu değerleri anlatan metinlerin bugünkü okumasıdır.

| Anahtar | Tür | Dayanak |
| --- | --- | --- |
| `home.imageryCredit` | kaynak | [EOxCloudless lisans özeti](https://cloudless.eox.at/documentation/license): 2016 katmanı CC BY 4.0, künye metni sayfadaki gibi (§4). Okunma 2026-10-29 |
| `panel.supply.hhi` | kaynak | [DOJ ve FTC, 2023 Birleşme Rehberi](https://www.justice.gov/atr/media/1329301/dl?inline), s. 6: "Markets with an HHI greater than 1,800 are highly concentrated". Okunma 2026-10-29. 90 günlük pencere platformun kuralı (D-024) |
| `panel.impact.co2` | kaynak | [Sandin ve Peters, JCP 184 (2018) 353–365](https://research.chalmers.se/en/publication/503200), özet: "benefits may not occur in cases with low replacement rates or if the avoided production processes are relatively clean". Okunma 2026-10-29. Katsayı seçilmedi (§3) |
| `scenario.references.items.ibbSeymen.label`, `scenario.references.items.ibbKomurcuoda.label`, `scenario.basis.noLocalTariff` | kaynak | [İBB ücret tarifesi EK-2](https://cevre.ibb.istanbul/wp-content/uploads/2025/12/EK2-Ucret-Tarifesi.pdf), kalem 1.1 (Silivri - Seymen) 700,00 ve 1.2 (Şile - Kömürcüoda) 785,00 TL/ton. Okunma 2026-10-29 |
| `scenario.references.items.particleboard.label` | kaynak | [Arcline sunta sayfası](https://www.arcline.com.tr/sunta-dsp): 18 mm, 1830×3660 mm ürünler. Okunma 2026-10-28 (D-029) |
| `scenario.references.items.mdf.label` | kaynak | [Arkutorman ham MDF sayfası](https://www.arkutorman.com/urun/18mm-1830-3660mm-ham-mdf-yildiz-entegre): 18 mm, 1830×3660 mm ürünler. Okunma 2026-10-28 (D-029) |
| `scenario.references.items.electricity.label`, `scenario.references.items.electricity.note` | kaynak | [Eurostat nrg_pc_205](https://ec.europa.eu/eurostat/databrowser/view/nrg_pc_205/default/table?lang=en), API ile TR, 2026-S1: 3,975; "Consumption from 20 MWh to 499 MWh - band IB"; "Excluding VAT and other recoverable taxes and levies". Okunma 2026-10-29 |
| `saasCosts.fxSource` | kaynak | [TCMB 19.10.2026 kurları](https://www.tcmb.gov.tr/kurlar/202610/19102026.xml): USD döviz satış 49,5523. Okunma 2026-10-29 |
| `saasCosts.notes.vercel_hobby` | kaynak | [Vercel fiyatları](https://vercel.com/pricing): "100 GB / month", "1M / month" işlev çağrısı, "4 hours / month" CPU; "Our Hobby plan is for personal, non-commercial use." Okunma 2026-10-29 |
| `saasCosts.notes.vercel_pro` | kaynak | [Vercel Pro planı](https://vercel.com/docs/plans/pro-plan): "$20/month Pro platform fee", "1 deploying team seat included", "$20/month in usage credit". Okunma 2026-10-29 |
| `saasCosts.notes.neon_free` | kaynak | [Neon fiyatları](https://neon.com/pricing): "100 CU-hours/project", "1 GB/project"; "The Free plan is permanent (not a trial); no credit card required." Okunma 2026-10-29 |
| `scenario.intro`, `scenario.basis.teamPlan` | ekip | Ekip planı: Ocak 2027'de ayda 10 t işleyen pilot (sunum, 7. slayt; §6). Arayüz "ekip planı" diye yazar (D-029) |
| `trace.production.sheetHint`, `trace.production.densityHint`, `story.sections.s6` | ekip | Ürün parametreleri: 1830×3660 mm, 18 mm, 550–750 kg/m³ (`DATA_DICTIONARY.md`; §6). Reçete seçilmedi, arayüz hedef olarak yazar (D-011) |
| `panel.impact.trendLead`, `panel.supply.alerts.concentration`, `panel.supply.hhiUnknown`, `panel.supply.cols.share`, `panel.supply.projectionTitle`, `panel.supply.upcomingTitle`, `panel.supply.upcomingEmpty` | kural | Pencereler: trend en çok 6 ay, yoğunlaşma 90 gün, projeksiyon ve yaklaşan teslim 30 gün (D-024) |
| `market.match.score` | kural | Skor 0–100 (D-021) |
| `market.listingForm.compositionHint`, `market.errors.composition_invalid`, `trace.receive.compositionHint`, `trace.errors.composition_invalid`, `trace.errors.moisture_invalid`, `scenario.invalidPercent` | kural | Yüzde alanları 0–100, lif bileşimi toplamı en fazla 100 (`DATA_DICTIONARY.md`) |
| `trace.errors.file_too_large`, `trace.batch.fileHint`, `trace.notices.uploaded` | kural | Kanıt dosyası en fazla 4 MiB, SHA-256 özeti zincire yazılır (D-018) |
| `trace.errors.balance_note_missing`, `trace.production.balanceHint` | kural | Kütle dengesi toleransı %2; ISO 22095'ten alınmadı (`DATA_DICTIONARY.md`) |
| `trace.errors.lot_invalid` | kural | Lot en az 1 tam levha; levha ölçüsü `DATA_DICTIONARY.md` (`src/domain/traceability/batches.ts`) |
| `trace.verifiedHint` | kural | Doğrulanmış kg için kontrol edilmiş kantar fişi (D-013) |
| `trace.receive.rejectedHint` | kural | Boş alan bilinmiyor demektir, 0 değildir (D-011) |

Belgelerdeki dış olgular (2026-10-29 denetimi):

- README'deki "EU Climate Ideathon 2026 (COP31)": [resmî site](https://euclimateideathon.com), "Kasım 2026'da, COP31 kapsamında Antalya'da düzenlenecek ulusal finalde sona erecek."
- D-018'deki 4,5 MB istek gövdesi sınırı: [Vercel Functions Limits](https://vercel.com/docs/functions/limitations), "The maximum payload size for the request body or the response body of a Vercel Function is 4.5 MB".
- D-027 ve D-029'daki fiyatlar ve tarifeler bu tablonun kaynak satırlarıyla aynı okumadır.
- Belgelerdeki öteki sayılar platformun kuralları ya da ölçümleridir (`docs/VERIFICATION.md`).
- Sunumla çelişen ifadeler Q-3'te durur.
