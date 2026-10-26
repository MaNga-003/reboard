# Veri sözlüğü (ekiple ortak)

> Platformdaki alanların **şu anki** anlamı. Şema değişince (`src/db/schema/`) bu dosya aynı commit'te güncellenir. Ekipteki herkes (Şerife, İrem, Emine, Burak) aynı adları kullanır.

## 1. Genel kurallar

| Kural | Açıklama |
| --- | --- |
| Boş değer | `null` **bilinmiyor** demektir. Asla 0 yazılmaz. Arayüz "bilinmiyor" gösterir, hesap sonucu da `null` olur |
| Para | `numeric(14,2)`. Yanında her zaman `currency` (`TRY`, `EUR`, `USD`) ve `tax_basis` (`incl_vat`, `excl_vat`) bulunur. Farklı para birimi ya da vergi temeli olan iki değer toplanmaz; hesap hata verir |
| Kur | Kur dönüşümü yalnızca `reference_values` içindeki tarihli kurla yapılır. Kaynak: TCMB; demo değeri 49,5523 TL/USD |
| Miktar | `numeric` ve birim enum'u: `kg`, `t`, `m2`, `m3`, `kwh`, `h`, `km`, `pcs` |
| Dönem | `period`: `YYYY-MM` ya da `YYYY-MM-DD/YYYY-MM-DD`. Farklı dönemdeki değerler aynı hesapta birleşmez |
| Zaman | `timestamptz`, ISO 8601 |
| Konum | İlçe adı ya da yaklaşık 1 km'ye yuvarlanmış enlem ve boylam. Açık adres tutulmaz |
| Mesafe | Yalnızca kuş uçuşu hesaplanır ve "kuş uçuşu" etiketiyle gösterilir |
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
| `listing.composition` | Lif bileşimi | `{fiber: yüzde}` | Toplam 100 olmalı. Lifler: `cotton`, `polyester`, `polycotton`, `viscose`, `wool`, `acrylic`, `elastane`, `other`, `unknown` |
| `listing.contains_silk` | İpek içerir | bool | `true` ise üretici talebiyle eşleşmez (ipek kapsam dışı) |
| `listing.quantity` | Miktar | `kg` ya da `m2` | Panel ilanında m² |
| `listing.recurrence` | Tekrar | enum | `once`, `weekly`, `monthly` |
| `listing.window` | Uygunluk penceresi | tarih aralığı | |
| `listing.price` | Birim fiyat | para / birim | İşareti "kim kime öder"i söyler: pozitifse alıcı öder, negatifse sağlayıcı kabul bedeli öder |
| `offer.status` | Teklif durumu | enum | `open`, `accepted`, `rejected`, `withdrawn` |
| `deal` | Anlaşma | | Kabul edilen tekliften doğar |
| `delivery.planned_at` | Planlı teslim | timestamptz | Tedarik projeksiyonuna girer |
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
| `batch_input.allocated_kg` | Tahsis edilen kg | kg | Atık partisinden üretim partisine |
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
| `custody_event.hash` | Hash | hex | `sha256(canonicalJson(payload) + prev_hash)` |
| `evidence.status` | Kanıt durumu | enum | `declared` (beyan), `documented` (belgeli), `reconciled` (mutabık) |
| `evidence.sha256` | Dosya özeti | hex | |

**Kütle dengesi:** `Σ allocated_kg = output_kg + scrap_kg + moisture_loss_kg`. Varsayılan tolerans %2'dir; aşılırsa açıklama zorunludur.

## 5. Etki ve tedarik

| Metrik | TR | Tanım |
| --- | --- | --- |
| `recovered_kg_verified` | Doğrulanmış geri kazanım | `verified = true` olan partilerin `accepted_kg` toplamı. Ana metrik |
| `recovered_kg_declared` | Beyan edilen geri kazanım | Bütün partilerin `declared_kg` toplamı. Ayrı gösterilir |
| `in_panel_kg` | Panele giren tekstil | Panel lotlarına ulaşan `allocated_kg` toplamı |
| `co2e_range` | CO₂e aralığı | `[kg × alt katsayı, kg × üst katsayı]`, kaynağıyla. Sınıfı `sourced_estimate`; tek sayı gösterilmez |
| `inventory_kg` | Stok | Kabul edilen − tahsis edilen |
| `days_of_cover` | Kaç günlük hammadde kaldığı | `inventory_kg ÷ planlı günlük ihtiyaç`. Eşikler ayarlanabilir; varsayılan 14 ve 7 |
| `on_time_rate` | Zamanında teslim | `delivered_at ≤ planned_at + 1 gün` olan teslimlerin oranı |
| `declared_vs_weighed` | Beyan ile tartım farkı | `(weighed − declared) ÷ declared` |
| `hhi` | Tedarikçi yoğunlaşması | Tedarikçi paylarının karelerinin toplamı (0–10.000) |
| `match_score` | Eşleşme skoru | 0–100. Bileşim uyumu, ipek içermemesi, miktar, kuş uçuşu mesafe ve güvenilirlik ağırlıklı toplamı |

## 6. Ekonomi (Şerife'nin raporu)

| Tablo | İçerik |
| --- | --- |
| `supplier_baseline` | Sağlayıcının bugünkü atık gideri: depolama, nakliye ve kabul bedeli |
| `transport_quotes` | Taşıyıcı teklifleri: km (kuş uçuşu ya da yol mesafesi etiketli), TL/sefer |
| `cost_lines` | Üretim gider kalemleri: malzeme, enerji, işçilik, sabit gider, amortisman |
| `buyer_trials` | Alıcının eşdeğer ürün gideri: sunta, MDF |
| `transactions` | Gerçek ya da demo satış ve kabul işlemleri |
| `saas_costs` | Platform giderleri: barındırma, veritabanı, alan adı; kaynak URL'si ve tarihiyle |
| `model_inputs` | Senaryo girdileri |
| `calc_runs` | Formül sürümü, girdi hash'i, çıktılar ve sonuç sınıfı |

**Formüller** (`src/domain/calc`):

| Hesap | Formül |
| --- | --- |
| Fabrika kazancı | mevcut net atık gideri − yeni net atık gideri |
| Panel müşterisi kazancı | eşdeğer mevcut ürün toplam gideri − ReBoard kullanılan ürün toplam gideri |
| ReBoard faaliyet sonucu | panel geliri + kabul geliri + hizmet geliri − malzeme − operasyon − sabit gider − amortisman |
| Fiyat koridoru | `[alt sınır, üst sınır]`. Alt sınır > üst sınır ise aralık oluşmaz ve uyarı verilir |
| SaaS katkısı | abonelik geliri − müşteriye bağlı gider |

## 7. Referans değerler (`reference_values`)

| Anahtar | Değer | Kaynak | Not |
| --- | --- | --- | --- |
| `eurostat_tr_textile_waste_2022` | 361.500 t | Eurostat `env_wasgen`, W076, TOTAL_HH | Kapsam notu zorunlu |
| `electricity_tl_kwh_2026h1` | 3,975 TL/kWh | Sanayi tarifesi (NAC, KDV hariç) | 2026 ilk yarı |
| `ibb_gate_fee_seymen` | 700 TL/t | İBB tarifesi | |
| `ibb_gate_fee_komurcuoda` | 785 TL/t | İBB tarifesi | |
| `usd_try` | 49,5523 | TCMB | Tarihiyle |
| `sheet_area_m2` | 6,70 m² | Standart levha 1830×3660 mm | |
