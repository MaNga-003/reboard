# Demo senaryosu (30 Ekim)

> 3 dakikalık canlı demo. Her adım `tests/e2e/demo.spec.ts` içinde bir Playwright adımına karşılık gelir (T4.3). Adım değişirse test de aynı commit'te değişir.

## 1. Hazırlık

| Ne | Nasıl |
| --- | --- |
| Canlı adres | `https://reboard-lovat.vercel.app` (D-003). Türk Telekom "Güvenli İnternet" bu adresi yönlendirebilir (R-5): salon ağında önceden denenir, sorun olursa yedek 1 |
| QR | `pnpm demo:qr` satılan lotun (`PL-…-001`) pasaport adresini etiket çapasıyla (`?a=`) kurar: `.private/demo/qr-tr.png` ve `qr-en.png` (SVG'leri de var). Çapa canlı veritabanından, pasaportla aynı kod yoluyla okunur; çapayla doğrulama geçmezse dosya yazılmaz, PNG yazıldıktan sonra çözücüyle geri okunur. `qr.json` lotu, çapayı ve seed gününü tutar. Sunuma bu PNG konur (D-025, D-030) |
| Demo verisini sıfırla | Uygulamada düğme yok (D-030). Kayıt eklemek demoyu bozmaz: olaylar yalnızca eklenir, QR geçerli kalır. Gerçekten gerekirse önce Neon'da yedek dal alınır, sonra `DEMO_NOW=<qr.json'daki seedDay> pnpm db:seed:live`. Aynı gün aynı çapayı verir, sunumdaki QR geçerli kalır; başka bir günle yüklenirse `pnpm demo:qr` yeniden çalıştırılır ve sunumdaki QR değiştirilir |
| Demo parolası | Ortam değişkeni `DEMO_PASSWORD`. Depoda yazmaz; ekibe ayrı iletilir |
| Yedek 1: internetsiz | `pnpm demo:offline` → `http://localhost:3000`. Yerel PGlite'a demo verisini yükler, derleme eskiyse derler, sunucuyu açar. İnternet ve Neon gerekmez; harita yerine liste görünür. Telefonla QR bu yedekte çalışmaz: pasaport dizüstünde açılır |
| Yedek 2: video | `.private/demo/reboard-demo.mp4`, `pnpm demo:video` üretir: aşağıdaki akış, tablodaki sürelerle, 1920 × 1080 |
| Provadan önce | `pnpm demo:offline --check`: akış testi çevrimdışı sunucuda koşar, yerel dışı her bağlantı kesik olur |

## 2. Akış

| # | Süre | Ekran | Ne gösterilir | Söylenecek ana cümle |
| --- | --- | --- | --- | --- |
| 1 | 0:00–0:40 | `/` | Hikâye: lif → panel → Dünya; sondaki sayaç ve "Sentetik" rozeti | "Platform ilk günden yalnızca doğrulanmış kilogramı sayıyor." |
| 2 | 0:40–1:10 | `/pazar` (Sağlayıcı: Konfeksiyon A) | Atık ilanı: bileşim, ipek yok, kg, ilçe; haritada görünür | "Fabrika atığını bir dakikada ilana çeviriyor." |
| 3 | 1:10–1:35 | `/pazar` (Üretici: ReBoard) | Eşleşme skoru, kuş uçuşu mesafe; teklif; sağlayıcı kabul eder; teslim planı | "Kabul edilen teklif tedarik takvimine giriyor." |
| 4 | 1:35–2:05 | `/izlenebilirlik` | Parti kabulü: beyan ve tartım farkı, kanıt yükleme; üretim partisi ve kütle dengesi; soy ağacı | "Her kilogram kantar fişine ve bir sonraki adıma bağlı." |
| 5 | 2:05–2:30 | `/panel` | Doğrulanmış ve beyan edilen kg; kaç günlük hammadde kaldığı; uyarı | "Stok 7 günün altına inmeden uyarıyor." |
| 6 | 2:30–2:50 | `/pasaport/[lot]` (telefondan QR ile) | Kaynak bileşimi, "test edilmedi" etiketi, zincir doğrulaması ve etiket çapası: geçti | "Alıcı panelin nereden geldiğini hesap açmadan görüyor; kayıt sonradan değişirse doğrulama düşüyor." |
| 7 | 2:50–3:00 | `/senaryo` | Kaynaklı varsayılan: yalnızca ayda 10 t atık dolu, sonuçlar "bilinmiyor", her girdinin altında dayanağı. Altta kaynaklı karşılaştırma değerleri (İBB tarifesi, sunta ve MDF levha fiyatı, elektrik), bağlantı ve okunma tarihiyle. İstenirse bir girdi yazılır, sonuç anında yenilenir; zarar eden taraf kırmızı ve açıklamalı olur | "Uydurma rakam göstermiyoruz: kaynağı olan tek girdi ekip planı; ötekiler fabrikadan, alıcıdan ve pilottan gelecek." |

## 3. Demo rolleri

Giriş `/giris` sayfasındaki dört düğmeyle yapılır; parola sorulmaz. Her rol kendi kurumunun kayıtlarını ve paylaşılanları görür (D-016).

| Rol | Organizasyon | Ne yapabilir |
| --- | --- | --- |
| Tedarikçi | Konfeksiyon A (sahip) | Atık ilanı verir, teklif kabul eder, kendi partilerinin tartımını görür |
| Üretici | ReBoard Pilot Tesisi (sahip) | Teklif verir, parti kabul eder, üretim partisi ve panel lotu açar |
| Panel alıcısı | Mobilya Atölyesi F (sahip) | Panel talebi verir, pasaportu görür |
| İzleyici | ReBoard Pilot Tesisi (izleyici) | Üreticinin kayıtlarını okur; hiçbir şey yazamaz. Rol farkını göstermek için |

Rol değiştirici başlığın altındaki "Demo: veriler sentetiktir. Rol değiştir" satırındadır. Yalnızca `DEMO_MODE=true` iken görünür. Rol değiştirmek önceki oturumu kapatır. `/panel` sayfası rolün yapabildiklerini listeler; İzleyici'de hepsi "yapamaz" görünür. Kurum adları kurgusaldır (`src/db/seed/demo.ts`); verinin ayrıntısı `docs/DATA_DICTIONARY.md` §8'de.

## 4. Sorun çıkarsa

| Belirti | Ne yapılır |
| --- | --- |
| Canlı adres açılmıyor | Yedek 1'e geç (dizüstünde önceden açık tutulur) |
| Dizüstü de sorunlu | Yedek 2: video |
| Veri karıştı | Akış kendi ilanını açar; eski kayıtlar akışı bozmaz. Sıfırlama gerekirse §1'deki komut (aynı seed günüyle) |
| Hikâye takılıyor | Sayfa açılınca 1. Tab'da sol üstte "Hikâyeyi geç" bağlantısı belirir; Enter hikâyenin sonuna atlar. Ya da doğrudan `/panel` |
