# Veri sözlüğü (ekiple ortak)

> Platformdaki alanların **şu anki** anlamı. Şema değişince (`src/db/schema/`) bu dosya aynı commit'te güncellenir. Ekipteki herkes (Şerife, İrem, Emine, Burak) aynı adları kullanır.

## 1. Genel kurallar

| Kural | Açıklama |
| --- | --- |
| Boş değer | `null` **bilinmiyor** demektir. Asla 0 yazılmaz. Arayüz "bilinmiyor" gösterir, hesap sonucu da `null` olur. Boş kalem listesi ise bilinen sıfırdır (ör. hizmet geliri yok). Hiç girdisi olmayan hesabın sınıfı olamaz; hesap `no_inputs` hatası verir ve yayımlanmaz |
| Para | `numeric(14,2)`. Yanında her zaman `currency` (`TRY`, `EUR`, `USD`) ve `tax_basis` (`incl_vat`, `excl_vat`) bulunur. Farklı para birimi ya da vergi temeli olan iki değer toplanmaz; hesap hata verir |
| Kur | Kur dönüşümü yalnızca `reference_values` içindeki tarihli kurla yapılır. Kaynak: TCMB; demo değeri 49,5523 TL/USD |
| Miktar | `numeric` ve birim enum'u: `kg`, `t`, `m2`, `m3`, `kwh`, `h`, `km`, `pcs`, `trip`, `month` |
| Dönem | `period`: `YYYY-MM` ya da `YYYY-MM-DD/YYYY-MM-DD`. Farklı dönemdeki değerler aynı hesapta birleşmez |
| Zaman | `timestamptz`, ISO 8601 |
| Konum | İlçe adı ya da yaklaşık 1 km'ye yuvarlanmış enlem ve boylam. Açık adres tutulmaz |
| Mesafe | Yalnızca kuş uçuşu hesaplanır (`src/domain/geo.ts`, haversine, 0,1 km) ve "kuş uçuşu" etiketiyle gösterilir |
| Kimlik | UUID. Ekip içinde okunur kısa kodlar ayrıca tutulur (ör. `WB-2026-0012`) |

**Şema dosyaları** (`src/db/schema/`):

| Dosya | Tablolar |
| --- | --- |
| `auth.ts` | Better Auth: `user`, `session`, `account`, `verification`, `organization`, `member`, `invitation` |
| `orgs.ts` | `org_profiles`: tür (`textile_factory`, `municipality`, `recycler`, `producer`, `panel_buyer`, `carrier`), ilçe, il, yuvarlanmış konum |
| `market.ts` | `listings`, `offers`, `deals`, `deliveries` |
| `trace.ts` | `waste_batches`, `production_batches`, `batch_inputs`, `panel_lots`, `custody_events`, `evidence_register`, `evidence_links` |
| `economics.ts` | `supplier_baseline`, `transport_quotes`, `cost_lines`, `buyer_trials`, `transactions`, `saas_costs`, `model_inputs`, `calc_runs` |
| `reference.ts` | `reference_values` |
| `enums.ts` | Bütün enum değerleri |

Kayıt taşıyan her tablonun `result_class` ve `created_at` kolonu vardır. Para kolonlarının yanında `currency` ve `tax_basis` bulunur. Kilogram kolonları `numeric(14,3)`, para kolonları `numeric(14,2)` tipindedir.

## 2. Sonuç sınıfları (`result_class`)

| Değer | TR etiket | EN label | Ne zaman |
| --- | --- | --- | --- |
| `synthetic` | Sentetik | Synthetic | Demo için uydurulmuş veri. Demodaki her kayıt bu sınıftadır |
| `sourced_estimate` | Kaynaklı tahmin | Sourced estimate | Kaynağı belli dış veri (Eurostat, TCMB, İBB, EPDK…) ya da ondan türetilen değer |
| `pilot_projection` | Pilot projeksiyon | Pilot projection | Pilot ölçümlerinden ölçeklenmiş tahmin |
| `realized` | Gerçekleşen | Realized | Gerçek işlem; insan belge mutabakatı yapılmış. Ancak `evidence.status = reconciled` (mutabık) iken verilebilir |

Bir hesabın sınıfı, girdilerinin **en zayıf** sınıfıdır. Sıralama en zayıftan en güçlüye: `synthetic` < `sourced_estimate` < `pilot_projection` < `realized`.

## 3. Pazar yeri

| Alan | TR | Birim / tür | Not |
| --- | --- | --- | --- |
| `listing.kind` | İlan türü | enum | `waste_offer`, `waste_request`, `panel_offer`, `panel_request` |
| `listing.composition` | Lif bileşimi | `{fiber: yüzde}` | Toplam 100 olmalı. Lifler (`src/domain/fibre.ts`): `cotton`, `polyester`, `polycotton`, `viscose`, `wool`, `acrylic`, `elastane`, `other`, `unknown`. 100'e tamamlanmayan kısım `unknown` sayılır |
| `listing.contains_silk` | İpek içerir | bool | `true` ise üretici talebiyle eşleşmez (ipek kapsam dışı) |
| `listing.quantity` | Miktar | `kg`, `t` ya da `m2` | Atıkta kg ya da t, panelde m². Tekrarlı ilanda miktar her teslim içindir (D-021) |
| `listing.recurrence` | Tekrar | enum | `once`, `weekly`, `monthly` |
| `listing.window` | Uygunluk penceresi | tarih aralığı | Teklifin ilk teslim günü bu aralıkta olmalı. Teslim planı pencere bitişinde ya da 60 günde kesilir |
| `listing.price` | Birim fiyat | para / birim | İşareti "kim kime öder"i söyler: pozitifse alıcı öder, negatifse sağlayıcı kabul bedeli öder. `0` bedelsiz, `null` bilinmiyor. Para birimi ve vergi temeli ayrı alanlardadır (`TRY`, `excl_vat`) |
| `listing.location` | Konum | ilçe, yuvarlanmış enlem ve boylam | İlan açılırken kurum profilinden kopyalanır; mesafe yalnızca kuş uçuşu gösterilir |
| `offer.quantity` | Teklif miktarı | ilanın birimi | İlandaki miktarı aşamaz |
| `offer.proposed_date` | İlk teslim günü | tarih | Geçmişte ya da ilanın penceresi dışında olamaz |
| `offer.status` | Teklif durumu | enum | `open`, `accepted`, `rejected`, `withdrawn`. Yalnızca açık teklif kabul, ret ya da geri çekme görür |
| `deal` | Anlaşma | | Kabul edilen tekliften doğar. Atık ya da panel teklifinde ilan sahibi satıcıdır; talepte teklif veren satıcıdır. Teklifte fiyat yoksa ilanın fiyatı alınır |
| `delivery.planned_at` | Planlı teslim | timestamptz | 09:00 TSİ. Önerilen gün (geçmişse kabul günü), haftalık ya da aylık (ay sonuna kırpılır). Tedarik projeksiyonuna girer |
| `delivery.planned_kg` | Planlı kg | kg | Miktar kg ya da t ise kg'a çevrilir. m² panel tesliminde `null` (yoğunluk ölçülmedi); 0 yazılmaz |
| `delivery.delivered_at` | Gerçek teslim | timestamptz | Zamanında teslim yüzdesi buradan hesaplanır |

## 4. İzlenebilirlik

| Alan | TR | Birim | Not |
| --- | --- | --- | --- |
| `waste_batch.declared_kg` | Beyan edilen kg | kg | Sağlayıcının beyanı |
| `waste_batch.weighed_kg` | Tartılan kg | kg | Alıcı tarafın kantarı |
| `waste_batch.moisture_pct` | Nem | % | |
| `waste_batch.rejected_kg` | Ayıklanan kg | kg | İpek ve uygunsuz malzeme |
| `waste_batch.accepted_kg` | Kabul edilen kg | kg | `weighed_kg − rejected_kg` |
| `waste_batch.verified` | Doğrulandı | bool | Tartım ve kanıt varsa `true` (D-013) |
| `batch_input.allocated_kg` | Tahsis edilen kg | kg | Atık partisinden üretim partisine. Satır kendi `result_class` değerini taşır |
| `production_batch.output_kg` | Çıktı kg | kg | |
| `production_batch.scrap_kg` | Fire | kg | |
| `production_batch.moisture_loss_kg` | Nem ve buhar kaybı | kg | |
| `production_batch.binder` | Bağlayıcı | enum | `pet_copet`, `pmdi`, `none`, `unknown`. Reçete seçilmedi; demo değeri sentetiktir |
| `panel_lot.area_m2` | Panel alanı | m² | Bir levha 1830×3660 mm, yaklaşık 6,70 m² |
| `panel_lot.thickness_mm` | Kalınlık | mm | Hedef 18 |
| `panel_lot.density_kg_m3` | Yoğunluk | kg/m³ | Hedef aralık 550–750 |
| `panel_lot.test_status` | Test durumu | enum | `not_tested`, `in_progress`, `passed`, `failed`. Yöntemler: EN 323, 310, 319, 320, 317 |
| `custody_event.type` | Olay türü | enum | EPCIS: `object`, `transformation`, `transaction` |
| `custody_event.biz_step` | İş adımı | enum | CBV: `receiving`, `inspecting`, `commissioning`, `shipping`, `transforming`, `accepting` |
| `custody_event.seq` | Sıra numarası | tamsayı | Organizasyon başına 1'den başlar; `(org_id, seq)` benzersizdir |
| `custody_event.payload` | Olay içeriği | jsonb | `inputs[]` ve `outputs[]` (`{ref, kg}`), `evidenceIds[]`, isteğe bağlı `note`. kg 3 ondalıklı metindir (`"1250.500"`) |
| `custody_event.prev_hash` | Önceki hash | hex | İlk olayda 64 sıfır |
| `custody_event.hash` | Hash | hex | `sha256(canonicalJson({orgId, seq, type, bizStep, eventTime, payload}) + prev_hash)` |
| `evidence.status` | Kanıt durumu | enum | `declared` (beyan), `documented` (belgeli), `reconciled` (mutabık) |
| `evidence.sha256` | Dosya özeti | hex | |

**Kütle dengesi:** `|Σ allocated_kg − output_kg − scrap_kg − moisture_loss_kg| ÷ Σ allocated_kg ≤ 0,02`. Aşılırsa açıklama zorunludur. Değerlerden biri bilinmiyorsa denge "bilinmiyor" olur; sağlandı da sağlanmadı da denmez.

**Lotun payı:** Üretim partisinden tek lot çıktıysa 1, birden çok lot çıktıysa `lotun area_m2 ÷ partinin bütün lotlarının area_m2 toplamı`. Bir lotun alanı bilinmiyorsa pay ve ondan türeyen bütün kg değerleri bilinmiyor olur.

**Etiket çapası** (`a`, D-025): `<sıra>-<hash>` biçimindedir; `hash` 64 hex karakterdir. Lotu ilk kez çıktı olarak yazan üretici olayının `seq` ve `hash` değerini taşır. Pasaport adresinde ve QR'da bulunur.

**Doğrulama ucu** `GET /api/verify/{lot}?a={çapa}`:

| Alan | Anlam |
| --- | --- |
| `lot` | Lot kodu |
| `ok` | Bütün zincirler sağlam; çapa verildiyse o da eşleşti |
| `checkedAt` | Doğrulama zamanı (ISO 8601, UTC) |
| `resultClass` | Lotun en zayıf sonuç sınıfı |
| `anchor` | Bugünkü zincirden hesaplanan etiket çapası; bilinmiyorsa `null` |
| `anchorChecked` | İstekteki çapa üretici zincirinde denetlendi mi |
| `chains[]` | `{role, name, ok, count?, head?, brokenAt?, reason?}`. `role` değerleri: `producer`, `supplier`, `buyer`. Adı paylaşılmayan zincirde `name` `null` olur; `count` ve `head` yazılmaz |

Hata yanıtları: okunamayan çapada 400 `{error: "anchor_invalid"}`; lot yoksa ya da açık değilse 404 `{error: "not_found"}`.

## 5. Etki ve tedarik

| Metrik | TR | Tanım |
| --- | --- | --- |
| `recovered_kg_verified` | Doğrulanmış geri kazanım | `verified = true` olan partilerin kabul edilen kg'ı (`weighed_kg − rejected_kg`) toplamı. Ana metrik (D-013) |
| `recovered_kg_declared` | Beyan edilen geri kazanım | Bütün partilerin `declared_kg` toplamı. Ayrı gösterilir |
| `in_panel_kg` | Panele giren tekstil | Panel lotu açılmış üretim partilerine giren `allocated_kg` toplamı. Yalnızca üretim yapan kurumda gösterilir |
| `co2e_range` | CO₂e aralığı | `[kg × alt katsayı, kg × üst katsayı]`, kaynağıyla. Sınıfı `sourced_estimate`; tek sayı gösterilmez. Doğrulanmış katsayı kaynağı henüz yok (`docs/RESEARCH.md` §3). Panel bu yüzden CO₂e göstermez ve nedenini yazar |
| `kg_total` | Kg toplamı | Bilinen değerlerin toplamı ve bilinmeyen kalem sayısı. Hepsi bilinmiyorsa "bilinmiyor"; bir kısmı bilinmiyorsa toplam alt sınırdır ve "en az" diye yazılır (`kgTotal`, `src/domain/impact.ts`) |
| `monthly_verified_kg` | Aylık doğrulanmış kg | Teslim alma ayına (Türkiye takvimi) göre `recovered_kg_verified`. Kurumun ilk kaydının ayından başlar, en çok son 6 ay |
| `usable_stock_kg` | Üretime hazır stok | Doğrulanmış partilerin kalanı toplamı. Kalan = kabul edilen − tahsis edilen (`remainingKg`). Doğrulama bekleyen parti üretime giremediği için bu sayıya girmez (D-024) |
| `pending_kg` | Doğrulama bekleyen | Kantar fişi kontrol edilmemiş partilerin kabul edilen kg'ı ve parti sayısı. Ayrı gösterilir |
| `planned_daily_need_kg` | Planlı günlük ihtiyaç | `model_inputs` anahtarı. Kurumun kendi satırı platform geneli satırın önüne geçer; aynı düzeyde en yeni dönem kullanılır |
| `days_of_cover` | Kaç günlük hammadde | `usable_stock_kg ÷ planned_daily_need_kg`. İhtiyaç bilinmiyor ya da 0 ise "bilinmiyor". Düzey: eşik `days_of_cover_green_min` ve üstü yeterli, `days_of_cover_yellow_min` altı kritik, arası dikkat. Eşikler `model_inputs` içinden gelir; ikisi birlikte ve tutarlı değilse varsayılan 14 ve 7 kullanılır |
| `stock_projection` | 30 günlük stok projeksiyonu | Günlük adım: o güne düşen planlı teslimlerin kg'ı eklenir, ihtiyaç düşülür, stok 0'ın altına inmez. Teslimin günü `max(1, ⌈(planlanan − şimdi) ÷ 24 saat⌉)`. Kg'ı bilinmeyen teslim projeksiyona girmez, sayısı yazılır. Planlı kg ayıklamadan önce olduğu için projeksiyon iyimserdir; sınıfı en çok `pilot_projection` |
| `on_time_rate` | Zamanında teslim | `delivered_at ≤ planned_at + 1 gün` olan teslimlerin vadesi gelmiş teslimlere oranı. Vadesi gelmiş: teslim edilmiş, iptal edilmiş ya da planlı tarihi 1 günden fazla geçmiş. Vadesi gelmiş teslim yoksa `null`. Pazar yerinde yalnızca izleyenin taraf olduğu teslimlerden hesaplanır (`src/domain/supply.ts`) |
| `declared_vs_weighed` | Beyan ile tartım farkı | `(Σ weighed − Σ declared) ÷ Σ declared`, yalnızca ikisi de bilinen partilerden. İşaretli yüzde olarak yazılır |
| `hhi` | Tedarikçi yoğunlaşması | Son 90 günde teslim alınan partilerin kabul edilen kg'ına göre tedarikçi paylarının (yüzde) karelerinin toplamı, 0–10.000. 1.800 üstü yüksek yoğunlaşmadır ve uyarı çıkar (`docs/RESEARCH.md` §1). Pencerede kg yoksa "bilinmiyor" |
| `supply_alert` | Tedarik uyarısı | `cover` (gün sayısı eşiğin altında), `need_missing`, `projected_danger` (bugün kritik değilken projeksiyonun kritik düzeye indiği ilk gün), `stockout`, `overdue` (planlı tarih 1 günden fazla geçti), `pending`, `stock_unknown`, `concentration`. Kritikten dikkate doğru sıralanır |
| `match_score` | Eşleşme skoru | 0–100 tamsayı (D-021, `src/domain/market.ts`). Ağırlıklar: bileşim 40, miktar 20, yakınlık 20, güvenilirlik 20. Bileşim uyumu `Σ min(arz payı, talep payı) ÷ talebin bilinen payı`; miktar `min(arz ÷ talep, 1)`; yakınlık `max(0, 1 − kuş uçuşu km ÷ 100)`; güvenilirlik `on_time_rate`. İpek içeren atık eşleşmez. Bilinmeyen bileşenin ağırlığı skordan düşülür; kalan ağırlık (`knownWeight`) ekranda yazar. Hiçbir bileşen bilinmiyorsa `null` |

## 6. Ekonomi (Şerife'nin raporu)

| Tablo | İçerik |
| --- | --- |
| `supplier_baseline` | Sağlayıcının bugünkü atık gideri: depolama, nakliye ve kabul bedeli |
| `transport_quotes` | Taşıyıcı teklifleri: km (kuş uçuşu ya da yol mesafesi etiketli), TL/sefer |
| `cost_lines` | Üretim gider kalemleri: malzeme, enerji, işçilik, sabit gider, amortisman |
| `buyer_trials` | Alıcının eşdeğer ürün gideri: sunta, MDF |
| `transactions` | Gerçek ya da demo satış ve kabul işlemleri |
| `saas_costs` | Platform giderleri, kurulum kurulum (D-027): barındırma, veritabanı, harita, CI, alan adı; kaynak URL'si ve okunma tarihiyle |
| `model_inputs` | Senaryo girdileri. Seed anahtarları senaryo alan adlarının yılan biçimidir (`wasteT` → `waste_t`, `panelPricePerM2` → `panel_price_per_m2`); tedarik eşikleri ve günlük ihtiyaç kendi anahtarlarıyla durur |
| `calc_runs` | Formül sürümü, girdi hash'i, çıktılar ve sonuç sınıfı |

**Formüller** (`src/domain/calc`):

Tanımlar maliyet raporundan birebir alınmıştır (D-002). Her sonuç `{value, unit, period, currency, taxBasis, resultClass, inputRefs, formulaVersion, conditions}` taşır. Sınıf, girdilerin en zayıf sınıfıdır.

| Hesap | Formül | Koşul (`conditions`) |
| --- | --- | --- |
| Fabrika kazancı | mevcut net gider − yeni net gider. Mevcut net = kaçınılabilir toplama + taşıma + bertaraf − bugünkü atık satış geliri. Yeni net = elleçleme + taşıma + kabul + abonelik − ReBoard'un ödediği atık bedeli | |
| Panel müşterisi kazancı | eşdeğer mevcut ürün toplam gideri − ReBoard kullanılan ürün toplam gideri (aynı ürün sayısı ya da kullanılabilir m²) | Teknik eşdeğerlik doğrulanmadıysa `equivalence_unverified` |
| ReBoard faaliyet sonucu | panel + kabul + hizmet gelirleri − malzeme − operasyon − sabit gider − amortisman | Her zaman `before_financing_and_tax` |
| Fiyat koridoru (TL/m²) | Alt = (dönem toplam giderleri − panel dışı gelirler) ÷ satılabilir alan. Üst = (müşterinin mevcut toplam gideri − geçiş ve ek işleme giderleri) ÷ gerekli ReBoard brüt alanı. Alan ≤ 0 ya da bilinmiyorsa sınır `null` | Alt > üst ise `no_corridor` |
| SaaS katkısı | abonelik − müşteriye bağlı bulut, harita, iletişim ve destek gideri | |

**Sentetik model örneği** (`src/domain/calc/synthetic-scenario.ts`). Rapordaki örnek: 10 t tekstil, 1.000 m² satılabilir panel, müşteri kesim verimi %85 (kullanılabilir 850 m²). Raporun girdi dosyası elimizde olmadığından girdiler, raporda yayımlanan sonuçları birebir üretecek biçimde **yeniden kuruldu**. Sonuçlar raporla aynıdır; tek tek kalemler Şerife'nin dosyasıyla aynı olmayabilir (T4.5'te karşılaştırılır).

| Taraf | Girdi (TL, KDV hariç) | Sonuç |
| --- | --- | --- |
| Fabrika | Bugün: toplama 6.150 + taşıma 6.000 + bertaraf 7.850 (785 TL/t) − atık satışı 0. Yeni: elleçleme 2.000 + taşıma 3.000 + kabul 5.000 (500 TL/t) − atık bedeli 0 | **10.000** |
| Fabrika, olumsuz senaryo | Atık bugün 2.000 TL/t'ye satılıyor | **−10.000** |
| Panel müşterisi | Mevcut: eşdeğer ürün 263.111 + teslim 8.000 + kesim ve kaplama 10.000. ReBoard: panel 240.000 (240 TL/m²) + geçiş denemesi 4.000 + ek işleme 6.000 | **31.111** (koşullu) |
| ReBoard | Panel 240.000 + kabul 5.000 − (malzeme 120.000 + operasyon 62.500 + sabit 30.000 + amortisman 15.000) | **17.500** |
| Fiyat koridoru | Alt (227.500 − 5.000) ÷ 1.000; üst (281.111 − 10.000) ÷ 1.000 | **222,50–271,11 TL/m²** |
| SaaS katkısı | Abonelik ücreti belirlenmedi | **bilinmiyor** |

**Senaryo ekranının girdileri** (`SCENARIO_FIELDS`, D-026). Her girdi ayrı bir alandır; tutarlar KDV hariç ve sentetik dönem içindir.

| Grup | Girdiler (birim) |
| --- | --- |
| Miktar ve fiyatlar | tekstil atığı (t), satılabilir panel alanı (m²), panel fiyatı (TL/m²), kabul bedeli (TL/t, fabrika öder), atık bedeli (TL/t, ReBoard öder) |
| Tekstil fabrikası | bugün: toplama (TL), taşıma (TL), bertaraf (TL/t), atık satış geliri (TL/t); ReBoard'la: elleçleme (TL), taşıma (TL) |
| Panel müşterisi | eşdeğer mevcut ürün, teslim, kesim ve kaplama, geçiş denemesi, ek işleme (TL); kesim verimi (%) |
| ReBoard giderleri | malzeme, operasyon, sabit gider, amortisman (TL) |
| SaaS aboneliği | abonelik ücreti ve müşteriye bağlı gider (TL/ay) |

- **Atık bedeli:** ReBoard'un ödediği tutar (t × TL/t) fabrikanın yeni net giderinden düşer ve ReBoard'un malzeme giderine eklenir. İki sonucun toplamı ödemeden etkilenmez.
- **Abonelik:** ücret belirlenmediği için senaryoda fabrikanın yeni giderine yazılmaz; SaaS katkısı ayrı ve aylıktır.
- **Kesim verimi:** ekranda 0–100, hesapta 0–1. Kullanılabilir alan = satılabilir alan × kesim verimi.
- **Boş ve geçersiz girdi:** boş alan `null` olur. Kabul edilen biçim en çok 12 hane ve 4 ondalıktır; ayırıcı nokta ya da virgül olabilir. Eksi, harf, boşluklu sayı ve %100'ü aşan yüzde geçersizdir; geçersiz alan da `null` sayılır.
- **Kırmızı gösterilen sonuç:** bilinen ve sıfırdan küçük sonuç (zarar) ile alt sınırın üst sınırı aştığı fiyat koridoru. `null` zarar sayılmaz.

**SaaS gider tablosu** (`saas_costs`, D-027). Hesap `saasStageSummary` (`src/domain/calc/saas-costs.ts`).

| Kolon | Anlamı |
| --- | --- |
| `key` | Benzersiz kalem anahtarı; arayüzde açıklama notunun çeviri anahtarı (`saasCosts.notes.<key>`) |
| `stage` | `demo`, `commercial` ya da ikisinde de geçen `both` |
| `item` | `hosting`, `database`, `database_compute`, `database_storage`, `map_tiles`, `ci`, `domain` (çeviri anahtarı) |
| `vendor`, `plan` | Sağlayıcı ve plan; seçilmediyse `null` ("Sağlayıcı seçilmedi") |
| `monthly_cost` | Aylık sabit tutar. Kullanıma bağlıysa ya da seçilmediyse `null`; 0 yalnızca ücretsiz plan içindir |
| `per_customer_monthly` | Müşteri başı aylık tutar; bilinmiyorsa `null` |
| `unit_price`, `usage_unit` | Kullanıma bağlı birim fiyat ve birimi (`cu_hour`, `gb_month`); ikisi birlikte gelir |
| `currency`, `tax_basis` | `USD` ya da `TRY`; bir kurulumda tek vergi temeli |
| `source_url`, `retrieved_at` | https kaynak ve okunma tarihi; ikisi de ekranda yazar |

- **Toplam:** kurulumun aylık sabit ve müşteri başı toplamı TL'dir; USD kalemler `usd_try` ile çevrilir. Bilinmeyen kalem varsa toplam `null`; bilinen kısım sıfırdan büyükse alt sınır ("en az") olarak yazılır ve bilinmeyen kalemler listelenir. Kur yoksa USD kalemli toplam `null`.
- **Seed değerleri** (27 Ekim 2026): demo kurulumu 0 TL/ay; ticari kurulum en az 991,05 TL/ay (Vercel Pro 20 USD × 49,5523), bilinmeyen alan adı; ticari müşteri başı gider bilinmiyor.

## 7. Referans değerler (`reference_values`)

Değerler 2026-10-27'de resmî kaynaktan yeniden okunarak doğrulandı. Sınıfları `sourced_estimate`.

| Anahtar | Değer | Kaynak | Doğrulama ve not |
| --- | --- | --- | --- |
| `eurostat_tr_textile_waste_2022` | 361.500 t | [Eurostat `env_wasgen`](https://ec.europa.eu/eurostat/databrowser/view/env_wasgen/default/table?lang=en): TR, W076, TOTAL_HH, HAZ_NHAZ, 2022 | API'den aynı değer okundu. Ülke düzeyinde, bütün faaliyetler ve haneler; yerel fabrika tonajı değildir. Kapsam notu zorunlu |
| `electricity_tl_kwh_2026h1` | 3,975 TL/kWh | [Eurostat `nrg_pc_205`](https://ec.europa.eu/eurostat/databrowser/view/nrg_pc_205/default/table?lang=en): TR, MWH20-499, X_VAT, NAC, 2026-S1 | API'den aynı değer okundu. Yıllık 20–499 MWh bandı, KDV ve geri alınabilir vergiler hariç ulusal fiyat; pilotun sözleşme fiyatı değildir |
| `ibb_gate_fee_seymen` | 700 TL/t | [İBB ücret tarifesi, EK-2](https://cevre.ibb.istanbul/wp-content/uploads/2025/12/EK2-Ucret-Tarifesi.pdf), kalem 1.1 | Tutar tarifede var. Tesis adı rapordan alındı; PDF'te makineyle okunamadı. KDV durumu doğrulanmadı |
| `ibb_gate_fee_komurcuoda` | 785 TL/t | Aynı tarife, kalem 1.2 | Yukarıdakiyle aynı not |
| `usd_try` | 49,5523 TL/USD | [TCMB, 19.10.2026](https://www.tcmb.gov.tr/kurlar/202610/19102026.xml), döviz satış | Maliyet raporu 16.10.2026 dosyasını gösteriyor; o gün döviz satış 49,4463. 49,5523 değeri 19.10.2026 döviz satış kurudur (T4.5'te ekiple düzeltilecek) |
| `sheet_area_m2` | 6,6978 m² | Standart levha 1830×3660 mm (ekip planı) | Alan sabiti `src/domain/panel.ts` içinde `SHEET_AREA_M2`; levha kütlesi `sheetMassKg(yoğunluk, kalınlık)`. Hedef ölçüdür, üretilmiş levha ölçümü değildir |

## 8. Demo verisi (seed, T1.4)

Kaynak: `src/db/seed/demo.ts`. Yükleme `pnpm db:seed` (yerel) ve `pnpm db:seed:live` (Neon) ile yapılır, ikisi de yalnızca `DEMO_MODE=true` iken çalışır. Denetim `tests/integration/seed.test.ts` dosyasındadır (M-20).

- **Sınıf:** demo kayıtlarının tamamı `synthetic`. Yalnızca §7'deki referans değerler ve `saas_costs` satırları `sourced_estimate`; bunlar resmî sayfadan 2026-10-27'de okundu.
- **Kurumlar (8):** Antalya'da ilçe düzeyinde, 2 ondalığa yuvarlanmış konumla. Adlar kurgusaldır.
  - Kaynaklar: Konfeksiyon A ve Örme Fabrikası B (`textile_factory`), Belediye Toplama C (`municipality`).
  - Taşıyıcılar: Taşıyıcı D ve Taşıyıcı E.
  - Alıcılar: Mobilya Atölyesi F ve Mağaza Dekor G.
  - Üretici: ReBoard Pilot Tesisi.
- **Kullanıcılar (9):** her kurumun sahibi ve ReBoard Pilot Tesisi'nde bir izleyici. E-posta biçimi `<anahtar>@demo.reboard.example` (ayrılmış `.example` alan adı, posta gitmez). Parola özeti yalnızca `DEMO_PASSWORD` verilirse yazılır; verilmezse hesap satırı oluşmaz ve giriş yapılamaz.
- **Tarihler:** `now`'a göre görelidir; demo her gün yeniden yüklendiğinde aynı görünür. Son 60 gün geçmiş, önümüzdeki 22 gün planlı teslimdir.
- **Akış:**
  - Teslim edilen her sevkiyat bir atık partisine dönüşür; kantar fişi ve irsaliye kanıt olarak bağlanır.
  - Üretim partileri yalnızca doğrulanmış partilerden, ilk giren ilk çıkar sırasıyla ve üretimden önce teslim alınmış kg'dan beslenir.
  - Her olay kurumun hash zincirine eklenir.
- **Bilerek bırakılan durumlar:** arayüzün her yolu gösterebilmesi için eklendi.
  - Tartımı bekleyen bir parti: `weighed_kg = null`, doğrulanmamış.
  - Kantar fişi kontrol bekleyen bir parti: fiş `declared` durumunda, parti doğrulanmamış.
  - Kütle dengesi %2'yi aşan bir üretim partisi; açıklaması yazılı.
  - İptal edilmiş bir teslim ve 1–2 gün geciken teslimler (tedarikçi güvenilirliği için).
  - Bağlayıcısı `unknown` olan partinin bağlayıcı gideri `null`.
  - Belediyenin bertaraf gideri `null`.
  - İpek içeren, üretici talebiyle eşleşmemesi gereken bir ilan.
- **Hesap kayıtları:** `calc_runs` satırları rapordaki sentetik senaryodan `runScenario` ile üretilir: temel senaryo ve olumsuz senaryo. Girdiler ondalık metin olarak saklanır, girdi hash'i kanonik JSON'un SHA-256 özetidir.
- **Ölçülen hacim (2026-10-27):**
  - 369 satır (9 kullanıcı, 9 üyelik ve 9 hesap dahil; ay sınırına göre aylık sabit gider satırı sayısı değişebilir): 19 atık partisi (17'si doğrulanmış), 5 üretim partisi, 6 panel lotu (132 levha), 63 zincir olayı (5 kurum).
  - Doğrulanmış kabul edilen kg: 16.412,5. Bunun 11.697 kg'ı tahsis edildi; stok 4.715,5 kg.
  - Planlı ihtiyaç günde 400 kg olduğundan stok yaklaşık 11,8 gün yeter; bu sarı eşiktir.
