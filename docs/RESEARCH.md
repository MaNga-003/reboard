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
| [ISO 22095 kütle dengesi (2026)](https://www.iso.org/contents/news/2026/03/new-iso-standards-bring-clarity.html) | Gözetim zinciri modelleri: kimlik koruma, ayrıştırma, kütle dengesi | Kütle dengesi denetimi, %2 tolerans, açıklama zorunluluğu |
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
| [GSAP README](https://cdn.jsdelivr.net/npm/gsap@3.15.0/README.md) | GSAP ve eklentileri ücretsiz | ScrollTrigger lisans sorunu yok |
| [CSS `animation-timeline` desteği](https://www.cssportal.com/css-properties/animation-timeline.php) | Firefox'ta hâlâ bayrak arkasında | JS tabanlı yapı |
| [CHI'26: scrollytelling çalışması](https://arxiv.org/abs/2603.04367) | Etkileşimi artırıyor, anlamaya etkisi küçük | Rakamlar hikâyenin dışında, panelde de veriliyor |
| [NASA Blue Marble Next Generation](https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/) (Ağustos 2004, topografya ve batimetri, [5400×2700 dosya](https://assets.science.nasa.gov/dynamicimage/assets/science/esd/eo/images/bmng/bmng-topography-bathymetry/august/world.topo.bathy.200408.3x5400x2700.jpg)); [NASA görsel kullanım kuralları](https://www.nasa.gov/nasa-brand-center/images-and-media/). Okunma: 2026-10-28 | NASA görselleri ABD'de genellikle telif dışı; kaynak belirtilmeli ("NASA Earth Observatory", Reto Stöckli), NASA onayı ima edilmemeli | 8. bölümün Dünya dokusu; künye hikâye altında ve `STORY.md`'de |

## 5. Altyapı ve hukuk

| Kaynak | Çıkarım | Platformdaki karşılığı |
| --- | --- | --- |
| [Vercel Hobby ve org depoları](https://community.vercel.com/t/question-about-github-organization-repository-and-vercel-hobby-plan/1386) | Herkese açık org deposundan yayın mümkün görünüyor | Yedek yol: GitHub Actions ve Vercel CLI (R-2) |
| [OpenFreeMap](https://openfreemap.org) | API anahtarsız, ücretsiz vektör harita karoları | Pazar yeri haritası, MapLibre ile |
| [KVKK yurt dışına aktarım rehberi](https://www.erdem-erdem.av.tr/bilgi-bankasi/yurt-disina-kisisel-veri-aktarimi-rehberi-neleri-duzenliyor) | Frankfurt'ta barındırma, standart sözleşme ya da açık rıza gerektirir | MVP'de yalnızca demo verisi; F5'te `T5.2` |
| [Better Auth ve Drizzle ile SaaS mimarisi](https://makerkit.dev/courses/nextjs-drizzle/architecture-and-technologies) | Organizasyon eklentisiyle çok kiracılı yapı | D-010, D-016 |

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
