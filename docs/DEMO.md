# Demo senaryosu (30 Ekim)

> 3 dakikalık canlı demo. Her adım `tests/e2e/demo.spec.ts` içinde bir Playwright adımına karşılık gelir (T4.3). Adım değişirse test de aynı commit'te değişir.

## 1. Hazırlık

| Ne | Nasıl |
| --- | --- |
| Canlı adres | T4.1'de yazılacak |
| Demo verisini sıfırla | Uygulamada "Demo verisini sıfırla" (yönetici) ya da `pnpm db:seed` |
| Demo parolası | Ortam değişkeni `DEMO_PASSWORD`. Depoda yazmaz; ekibe ayrı iletilir |
| Yedek 1: internetsiz | `pnpm demo:offline` → `http://localhost:3000` (PGlite ve seed) |
| Yedek 2: video | `.private/demo/reboard-demo.mp4` (T4.2) |
| QR | Pasaport sayfasındaki QR, adresi etiket çapasıyla (`?a=`) taşır. Seed yeniden yüklenince çapa değişir; sunuma ve etikete konacak QR son yüklemeden sonra canlı sayfadan alınır (D-025, T4.3) |

## 2. Akış

| # | Süre | Ekran | Ne gösterilir | Söylenecek ana cümle |
| --- | --- | --- | --- | --- |
| 1 | 0:00–0:40 | `/` | Hikâye: lif → panel → Dünya; sondaki sayaç ve "Sentetik" rozeti | "Platform ilk günden yalnızca doğrulanmış kilogramı sayıyor." |
| 2 | 0:40–1:10 | `/pazar` (Sağlayıcı: Konfeksiyon A) | Atık ilanı: bileşim, ipek yok, kg, ilçe; haritada görünür | "Fabrika atığını bir dakikada ilana çeviriyor." |
| 3 | 1:10–1:35 | `/pazar` (Üretici: ReBoard) | Eşleşme skoru, kuş uçuşu mesafe; teklif; sağlayıcı kabul eder; teslim planı | "Kabul edilen teklif tedarik takvimine giriyor." |
| 4 | 1:35–2:05 | `/izlenebilirlik` | Parti kabulü: beyan ve tartım farkı, kanıt yükleme; üretim partisi ve kütle dengesi; soy ağacı | "Her kilogram kantar fişine ve bir sonraki adıma bağlı." |
| 5 | 2:05–2:30 | `/panel` | Doğrulanmış ve beyan edilen kg; kaç günlük hammadde kaldığı; uyarı | "Stok 7 günün altına inmeden uyarıyor." |
| 6 | 2:30–2:50 | `/pasaport/[lot]` (telefondan QR ile) | Kaynak bileşimi, "test edilmedi" etiketi, zincir doğrulaması ve etiket çapası: geçti | "Alıcı panelin nereden geldiğini hesap açmadan görüyor; kayıt sonradan değişirse doğrulama düşüyor." |
| 7 | 2:50–3:00 | `/senaryo` | Fabrika kazancı, fiyat koridoru, sonuç sınıfı rozetleri | "Rakamlar sentetik; pilotla gerçekleşene dönecek." |

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
| Veri bozulmuş | "Demo verisini sıfırla" |
| Hikâye takılıyor | Sayfanın altındaki "hikâyeyi atla" bağlantısı; ya da doğrudan `/panel` |
