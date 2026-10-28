# Kararlar (yalnızca güncel)

> **Kural:** Bu dosyada yalnızca **geçerli** kararlar durur. Bir karar değişirse eskisi **anında silinir**, yerine yenisi aynı kimlikle ya da yeni kimlikle yazılır. Geçmiş git'te kalır (`git log -p docs/DECISIONS.md`).
> `state.json` içinde anılan her `D-xxx` kimliği burada bulunmak zorundadır (`pnpm docs:check` denetler).

Biçim: **Karar**, **Neden**, **Tarih**, kararı kim verdi (K: kullanıcı, C: Claude, E: ekip).

---

### D-001 — Öncelik: önce 30 Ekim demosu
- **Karar:** 27–29 Ekim arasında çalışan bir demo çıkar. Demo 29 Ekim 18:00'de (TSİ) donar. Ürünleşme yarışmadan sonra aynı temel üzerinde sürer.
- **Neden:** Yarışma 30 Ekim'de. Ekip planı demonun 29 Ekim'de hazır ve yedeklenmiş olmasını istiyor.
- **Tarih:** 2026-10-27 · K

### D-002 — Hesap çekirdeği rapordaki formül tanımlarından kurulur
- **Karar:** Şerife'nin Jupyter paketi kullanılmaz. Formüller "ReBoard veri ve maliyet doğrulama raporu"ndaki tanımlardan TypeScript'e aktarılır: fabrika kazancı, panel müşterisi kazancı, ReBoard faaliyet sonucu, fiyat koridoru ve SaaS katkısı.
- **Neden:** Paket elde değil; kullanıcı kullanılmamasına karar verdi.
- **Tarih:** 2026-10-27 · K

### D-003 — Yayın: Vercel (fra1) ve Neon (Frankfurt), ayrıca çevrimdışı yedek
- **Karar:**
  - Canlı sürüm Vercel'de fra1 bölgesinde, veritabanı Neon Postgres'te Frankfurt bölgesinde (`aws-eu-central-1`) çalışır. Demo için yerelde PGlite ile çalışan çevrimdışı bir yedek de hazırlanır.
  - Yayın şimdilik Vercel CLI ile yapılır (`pnpm deploy:prod`). CLI yalnızca `.vercelignore` izin listesindeki dosyaları yükler; `.private/` ve `.env*` hiçbir koşulda yüklenmez.
  - GitHub bağlantısı, Vercel GitHub uygulaması `MaNga-003` organizasyonuna kurulunca açılır.
  - Ücretli alan adı şimdilik alınmaz (kullanıcı kararı, 2026-10-27). Demo ve QR kodları `reboard-lovat.vercel.app` adresini kullanır. Türk Telekom filtresi riski (R-5) çevrimdışı demo (T4.2) ve 29 Ekim'deki salon ağı denemesiyle karşılanır.
- **Neden:** Jüri bir bağlantı ya da QR kodla açabilsin. AB bölgesi seçildi. Ücretsiz katman yetiyor. Alan adı ücretlidir ve demo için zorunlu değildir.
- **Tarih:** 2026-10-27 · K

### D-004 — Hikâye: Apple tarzı kare dizisi, Blender ile otonom render
- **Karar:** Ana sayfadaki scroll hikâyesi, yapışkan bir canvas üzerinde scroll ile oynatılan bir kare dizisidir. Kareler Blender 4.5 LTS'de Python (bpy) ile kodla üretilen sahnelerden **Cycles** ile (GPU, OptiX, OIDN gürültü giderme, AgX) fotogerçekçi olarak render edilir. Malzemeler gerçek ölçekte modellenir; ör. 1. bölümde her iplik tek tek liflerden bükülür. Masaüstü (16:9) ve mobil (9:16) için ayrı render alınır. Kaliteden ödün verilmez; süre kullanıcının denetimindedir.
- **Neden:** Kullanıcı fotogerçekçi ve sinematik bir akış istedi; stilize Eevee görünümü bunu karşılamıyordu (28.10). Blender'da sahne kodla üretildiği için otonom çalışılabiliyor, sonuç tekrar üretilebiliyor ve malzeme renkleri Wada sözlüğünden geliyor.
- **Tarih:** 2026-10-28 · K

### D-005 — Dil: Türkçe (varsayılan) ve İngilizce
- **Karar:** Çeviri next-intl ile yapılır. Varsayılan `tr`, ikinci dil `en`. Bileşenlerde sabit metin bulunmaz.
- **Tarih:** 2026-10-27 · K

### D-006 — Depo: `MaNga-003/reboard`, herkese açık; kaynak belgeler depo dışında
- **Karar:** Kod GitHub'da `MaNga-003` organizasyonunda herkese açık bir depoda tutulur. Ekip belgeleri (pptx, docx, pdf) ve iç notlar `.private/` klasöründe durur ve git'e girmez.
- **Neden:** Kullanıcının kararı. Depo açık olduğu için iç maliyet ve planlama belgeleri yayımlanmamalı.
- **Tarih:** 2026-10-27 · K

### D-007 — Uygulama yığını
- **Karar:** Next.js 16.4 (App Router, Server Actions), React 19, TypeScript strict, pnpm 10, Node 24 LTS, Tailwind 4 ve Radix temelli bileşenler.
- **Neden:** Tanıtım sayfası ile uygulama tek kod tabanında duruyor. Teknoloji ana akım ve Vercel'de doğal çalışıyor.
- **Tarih:** 2026-10-27 · C

### D-008 — Cache Components kapalı
- **Karar:** `cacheComponents` ve `partialPrefetching` kapalıdır. Önceki önbellek modeli kullanılır: varsayılan olarak dinamik, gerektiği yerde `unstable_cache` ve `revalidatePath`.
- **Neden:** Cache Components açıkken her dinamik okumanın Suspense ya da `use cache` ile sarılması gerekiyor. Bu, 3 günlük süre içinde öğrenme ve hata riski demek. Faz 5'te yeniden değerlendirilecek.
- **Tarih:** 2026-10-27 · C

### D-009 — Veri katmanı: Postgres ve Drizzle; testlerde ve çevrimdışında PGlite
- **Karar:** Drizzle ORM kullanılır. Canlıda `node-postgres` sürücüsüyle Neon'a, testlerde ve çevrimdışı demoda `pglite` ile bağlanılır. İki ortamda da aynı şema ve aynı migrasyonlar çalışır.
- **Neden:** Testler için Docker gerekmiyor, otonom çalışılabiliyor. Canlı ile yerel arasında SQL lehçesi aynı.
- **Tarih:** 2026-10-27 · C

### D-010 — Kimlik: Better Auth, kurum rolleri, kapalı kayıt
- **Karar:**
  - Better Auth, Drizzle adaptörüyle kullanılır: e-posta ile parola girişi ve organizasyon eklentisi.
  - Roller sahip, yönetici, operatör ve izleyicidir. Yetki tablosu tek yerde durur (`src/domain/access.ts`); Better Auth rolleri bu tablodan kurulur. Operatör kanıt yükler ama mutabık sayamaz (görev ayrılığı); izleyici hiçbir yazma eylemi yapamaz.
  - Rol her istekte üyelik tablosundan okunur; oturuma yazılmış bir role güvenilmez.
  - Kayıt ve kurum açma kapalıdır. Hesaplar seed ile, Faz 5'te davetle açılır.
  - Jüri için "demo rolüyle gir": Tedarikçi, Üretici, Panel alıcısı ve İzleyici. Rol değiştirmek önceki oturumu kapatır. Demo parolası depoda değil, ortam değişkeninde (`DEMO_PASSWORD`) durur.
- **Neden:** Herkese açık bir demoda kayıt formu saldırı ve çöp veri kapısıdır. Rol farkı jüriye tek tıkla gösterilebilmeli.
- **Tarih:** 2026-10-27 · C

### D-011 — Dürüstlük kuralları
- **Karar:**
  - Her sayısal sonuç bir sonuç sınıfı taşır: `synthetic` (Sentetik), `sourced_estimate` (Kaynaklı tahmin), `pilot_projection` (Pilot projeksiyon) ya da `realized` (Gerçekleşen).
  - `realized` sınıfı yalnızca insan belge mutabakatından sonra verilir.
  - Boş değer bilinmeyen demektir, sıfır olarak işlenmez.
  - CO₂e yalnızca kaynaklı bir aralık olarak gösterilir.
  - Kuş uçuşu mesafe hep "kuş uçuşu" etiketiyle gösterilir.
  - Demo verisinin tamamı `synthetic` sınıfındadır.
- **Neden:** Jüri cevapları ve maliyet raporu bu dili şart koşuyor: reçete seçilmedi, test edilmedi.
- **Tarih:** 2026-10-27 · E/C

### D-012 — Olay günlüğü: EPCIS 2.0 sözlüğü ve hash zinciri
- **Karar:**
  - Gözetim zinciri olayları (`custody_events`) EPCIS 2.0 olay türlerini ve CBV bizStep sözlüğünü kullanır.
  - Kayıtlar yalnızca eklenir; UPDATE ve DELETE işlemlerini DB tetikleyicisi engeller.
  - Her olay `hash = SHA-256(kanonik JSON ∥ önceki hash)` ile önceki olaya bağlanır.
  - Blokzincir kullanılmaz.
- **Neden:** Kayıtlar değiştirilemez ve dışarıdan doğrulanabilir oluyor. Blokzincire göre maliyeti ve karmaşıklığı çok düşük.
- **Tarih:** 2026-10-27 · C

### D-013 — Ana etki metriği: doğrulanmış kilogram
- **Karar:**
  - Herkese açık sayaç yalnızca `recovered_kg_verified` değerini gösterir: tedarikçinin beyanından sonra alıcı tarafın tartımıyla onaylanan kabul edilmiş atık.
  - Beyan edilen miktar ayrı bir değer olarak gösterilir.
  - Beyan ile tartım arasındaki fark tedarikçi güvenilirliğine yansır.
- **Tarih:** 2026-10-27 · C

### D-014 — Renkler yalnızca Sanzo Wada sözlüğünden
- **Karar:** Arayüz ve hikâye renkleri `MaNga-003/dictionary-of-colour-combinations` deposundaki 159 renkten ve 348 kombinasyondan seçilir. Ana palet kullanıcı tarafından seçilecek (açık soru Q-1). Metin kontrastı ve OKLab ΔE eşikleri otomatik testle denetlenir.
- **Hikâye render'ı:** Malzemelerin temel renkleri, ışıkların ve dünyanın rengi Wada'dan gelir (`lib.rgba(ad)`; ad sözlükte yoksa render durur). Doku içinde iki Wada rengi arasındaki geçiş ve parlaklık değişimi serbesttir; fotogerçekçi ışık zaten ara tonlar üretir. Dünya küresinde NASA Blue Marble fotoğrafı kullanılır; o, renk seçimi değil gerçek görüntüdür.
- **Tarih:** 2026-10-27 · K (render notu 2026-10-28 · C)

### D-015 — MVP kapsamı dışında kalanlar
- **Karar:** Canlı GPS, yapay zekâ ile rota optimizasyonu, ödeme ve emanet hesabı, karbon kredisi, blokzincir ve mobil uygulama MVP'ye girmez.
- **Neden:** Üç günde güvenilir biçimde bitmezler ve MVP'nin üç hedefi için gerekli değiller.
- **Tarih:** 2026-10-27 · C

### D-016 — Kiracı izolasyonu
- **Karar:**
  - Kurum verisine erişim tek bir repository katmanından geçer: `withTenant(db, orgId)` (`src/db/repo/tenant.ts`). Görünürlük kuralı her sorguya eklenir; çağıranın koşulu onu gevşetemez.
  - Paylaşılanlar bilinçli olarak sınırlıdır: açık ilanlar, herkese açık kurum profilleri ve panel lotları, taraf olunan teklif, anlaşma ve teslimler, taraf olunan anlaşmanın ilanı (kapanmış olsa da), sağlayıcının teslim ettiği partinin tartım sonucu, kurumdan bağımsız kaynaklı değerler. Açık pasaport ayrıca herkese açık lotun soy ağacına dokunan zincirlerin hükmünü ve süzülmüş olaylarını yayımlar (D-025). Herkese açık sayaç platform geneli doğrulanmış kg toplamını yayımlar; kurum dökümü vermez (D-013). Geri kalan her şey yalnızca sahibine açıktır.
  - Tek seferlik ilan kabulde kapanır; alıcı teslim alırken ilanın başlığını ve lif bileşimini okumak zorundadır. Bu yüzden anlaşmanın iki tarafı ilanı görmeye devam eder; başka kurum kapanan ilanı görmez.
  - Yazma hakkı görmekten dardır: yalnızca sahibi yazar. Yok ile yetkisiz aynı hatayı verir.
  - Çapraz kiracı erişimi otomatik testle ölçülür (M-4). Postgres RLS Faz 5'te ikinci savunma hattı olarak eklenecek.
- **Neden:** Rakip fabrikalar aynı platformda; bir kurumun maliyet ve hacim verisi başkasına sızarsa güven biter. Tek katman, tek test edilebilir sınır demektir.
- **Tarih:** 2026-10-27 · C

### D-017 — Belgeler yalnızca güncel durumu tutar
- **Karar:**
  - Plan ve görev durumu `state.json` dosyasında, kararlar bu dosyada durur.
  - Her görev bittiğinde ilgili belge aynı commit'te güncellenir.
  - `pnpm docs:check` CI'da çalışır.
  - Claude Code'daki Stop kancası (`scripts/docs-guard.mjs`), kod değiştiği hâlde `state.json` güncellenmediyse oturumu durdurur.
- **Tarih:** 2026-10-27 · K

### D-018 — Kanıt dosyaları MVP'de Postgres'te
- **Karar:**
  - Tartım fişi, irsaliye ve fatura gibi kanıt dosyaları en fazla 4 MiB (4.194.304 bayt) olarak Postgres'te `bytea` biçiminde tutulur. Erişim `EvidenceStore` arayüzünden geçer, böylece ileride S3 ya da R2'ye geçmek kolay olur.
  - Her dosyanın SHA-256 özeti kaydedilir ve gözetim zincirine yazılır.
  - Tür, tarayıcının bildirdiği MIME'den değil dosyanın ilk baytlarından belirlenir: PDF, PNG, JPEG ya da WebP.
  - İndirme yalnızca `/api/evidence/[id]` üzerinden ve yalnızca sahip kuruma açıktır: oturum yoksa 401, başka kurumsa ya da kayıt yoksa 404. Yanıt her zaman ek (`attachment`) olarak gelir; `X-Content-Type-Options: nosniff`, `Content-Security-Policy: sandbox` ve `Cache-Control: private, no-store` taşır.
  - Tarayıcı 4 MiB'ı aşan ya da boş dosyayı göndermeden durdurur; sunucu aynı kuralı yeniden denetler.
- **Neden:**
  - Çevrimdışı demoda da çalışıyor ve ek bir hizmet gerektirmiyor.
  - Yüklenen dosya kullanıcı içeriğidir: tarayıcıda sayfa olarak açılırsa betik çalıştırabilir. Ek olarak indirmek ve kum havuzu bunu engeller.
  - Vercel işlevleri en fazla 4,5 MB istek gövdesi kabul eder (413 `FUNCTION_PAYLOAD_TOO_LARGE`). Önceki 5 MB sınırı yayında hiç çalışamazdı; çok parçalı form başlıklarına da pay kalsın diye sınır 4 MiB oldu.
- **Tarih:** 2026-10-27 · C

### D-019 — Lisans: tüm hakları saklı
- **Karar:** Depo herkese açıktır ama kod açık kaynak lisansıyla yayımlanmaz. `LICENSE` dosyası "tüm hakları saklıdır" der. Üçüncü taraf bileşenler (Wada renk verisi, MIT) kendi lisanslarıyla kalır.
- **Neden:** Yarışmadan sonra şirketleşme seçeneği açık kalır. Sonradan açık lisansa geçmek kolaydır; yayımlanmış bir sürümü geri kapatmak mümkün değildir.
- **Tarih:** 2026-10-27 · K

### D-029 — Senaryonun varsayılan girdileri yalnızca dayanağı olan değerlerdir
- **Karar:**
  - Hesaplayıcı kaynaklı girdilerle açılır (`SOURCED_SCENARIO`). Tek değer ekip planından gelir: Ocak 2027'de ayda 10 t atık işleyen pilot tesis (sunum, 7. slayt). Öteki 22 girdi `null`; onlara dayanan sonuçlar "bilinmiyor" yazar.
  - Her girdinin bir dayanağı vardır (`ScenarioBasis`): ekip planı, ölçülmedi, karar verilmedi, fabrikanın kaydı, yerel tarife yok, alıcının teklifi ve denemesi, reçete seçilmedi, tesis seçilmedi, SaaS gider tablosu. Dayanak alanın altında yazar ve seed'de `model_inputs.source` alanına yazılır.
  - Rapor örneğinin yeniden kurulan girdileri ve olumsuz senaryo yalnızca testte durur (`tests/fixtures/report-scenario.ts`). Hazır senaryo düğmeleri kalktı; tek düğme kaynaklı girdilere döndürür. Elle girilen değerlerle kırmızı uyarılar aynen çalışır (D-026).
  - Hesaplayıcının altında "Karşılaştırma için kaynaklı değerler" tablosu durur:
    - İBB düzenli depolama kabul bedeli: Seymen 700, Kömürcüoda 785 TL/t, tarifeye göre KDV dahil.
    - 18 mm sunta, 1830×3660 mm: 1.471–1.911 TL/levha (Arcline); sayfada KDV durumu yazmıyor.
    - 18 mm ham MDF, 1830×3660 mm: 3.155–3.260 TL/levha (Arkutorman), sayfaya göre KDV dahil.
    - Hane dışı tüketici elektrik fiyatı: 3,975 TL/kWh (Eurostat, 2026 ilk yarı), KDV hariç.
  - Bu değerler hesaba girmez. Her satırda ilgili girdi, kaynak bağlantısı, okunma tarihi ve `sourced_estimate` rozeti bulunur. Satırları `src/db/repo/scenario.ts` içindeki `scenarioReferences(tenant)` okur; aralığın bir ucu eksikse satır gösterilmez.
  - Seed'deki `calc_runs` kayıtları kaynaklı girdilerden üretilir; beş sonucun hepsi bilinmiyor.
- **Neden:**
  - Kullanıcının kararı: kaynaksız iddia ya da açıklama olmayacak; kaynak yoksa eklenmeyecek (D-028).
  - Rapor örneğinin girdileri raporda yayımlanan sonuçlardan geriye doğru kuruldu; hiçbirinin kaynağı yok. Ekranda varsayılan olarak durmaları sentetik sayıları kaynaklı gibi gösterirdi.
  - Kaynaklı değerler girdinin yerine konamaz: İBB tarifesi İstanbul'un ve KDV dahil, levha fiyatları tek satıcının liste fiyatı, elektrik fiyatı ulusal ortalama. Bu yüzden girdi olarak değil, karşılaştırma olarak gösterilir.
- **Tarih:** 2026-10-28 · K

### D-028 — Platforma giren her bilgi birincil kaynakla doğrulanır
- **Karar:**
  - Arayüz metni, seed, referans değer ya da belge fark etmez: olgu bildiren her bilgi platforma eklenmeden önce birincil kaynaktan okunarak doğrulanır. Birincil kaynak resmî tarife, istatistik kurumu, mevzuat metni, hakemli yayın ya da fiyatı veren firmanın kendi sayfasıdır.
  - Ekip belgeleri (sunum, maliyet raporu, jüri cevapları, ekip planı) tek başına kaynak sayılmaz. Onlardan gelen bilgi de aynı biçimde doğrulanır.
  - Doğrulama belgelerin kendi kaynakçasından başlar: maliyet raporundaki [K1]–[K10] atıfları, jüri belgesindeki bağlantılar ve sunumun KAYNAKÇA slaydı. Atıf izlenir ve bilgi atıf yapılan kaynakta okunur. Yalnızca başka bir ekip belgesine dayanan bilgi doğrulanmamış sayılır; sunumdaki "Agent 003 proje kanvası" atfı buna örnektir.
  - Doğrulanan bilgi kaynak bağlantısı ve okunma tarihiyle kaydedilir.
  - Doğrulanamayan ya da kaynaklar arasında çelişen bilgi platforma eklenmez; ekibe soru olarak gider ve `state.json` açık sorularına yazılır.
  - Platformda bugün bulunan bilgiler de bu kurala göre denetlenir (T4.7).
- **Neden:** Kullanıcının kararı. Ekip belgeleri birbiriyle çelişti: sunum "prototip tamamlandı" diyor, jüri belgesi "test etmedik" diyor. Sentetik senaryoda da KDV dahil bir tarife KDV hariç girdi gibi kullanıldı. Platformun vaadi doğrulanabilir etkidir; doğrulanmamış bilgi bu vaadi zayıflatır.
- **Tarih:** 2026-10-27 · K

### D-027 — SaaS gider tablosu: iki kurulum, kaynaklı fiyatlar, bilinmeyen kalem alt sınır yapar
- **Karar:**
  - `saas_costs` her satırda bir kalem tutar: benzersiz `key` (çeviri anahtarı da budur), kurulum (`demo`, `commercial`; ikisinde de geçerse `both`), kalem türü, sağlayıcı ve plan, aylık sabit tutar, müşteri başı aylık tutar, kullanıma bağlı birim fiyat ve birimi, para birimi, vergi temeli, kaynak URL'si, okunma tarihi ve sonuç sınıfı.
  - Fiyatlar 27 Ekim 2026'da resmî fiyat sayfalarından okundu; sınıf `sourced_estimate`. Her satırda https kaynak bağlantısı ve okunma tarihi ekranda yazar.
  - Demo kurulumu: Vercel Hobby, Neon Free, OpenFreeMap, GitHub Actions; hepsi 0. Ticari kurulum: Vercel Pro 20 USD/ay; Neon Launch, kullanıma bağlı (işlem 0,106 USD/CU-saat, depolama 0,35 USD/GB-ay); OpenFreeMap; GitHub Actions; alan adı.
  - Bilinen 0 ile bilinmeyen ayrıdır. Kullanıma bağlı ya da seçilmemiş kalemin tutarı `null` yazılır. Bilinmeyen kalem varsa toplam "bilinmiyor" olur. Bilinen kısım sıfırdan büyükse "en az" diye alt sınır olarak yazılır ve bilinmeyen kalemler adıyla listelenir.
  - USD tutarlar TCMB `usd_try` kuruyla TL'ye çevrilir. Kur yoksa USD kalemli toplam bilinmiyor olur. Toplamın sınıfı kalemlerin ve kurun en zayıfıdır. Para birimi TL ya da USD dışındaysa, vergi temelleri karışıksa ya da tutar eksiyse hesap hata verir.
  - Ticari kurulumun alan adı seçilmedi; şimdilik ücretli alan adı alınmaz (D-003). Tutarı `null`; satırın kaynak bağlantısı bu karara gider.
  - Tablo `/senaryo` sayfasının altındadır. Hesabı `src/domain/calc/saas-costs.ts` (`saasStageSummary`) yapar, satırları `src/db/repo/saas.ts` okur.
  - Fiyatlar `pnpm db:prices` ve `pnpm db:prices:live` ile yenilenir. Bu komutlar yalnızca `saas_costs` satırlarını siler ve yeniden yazar; zincire, kurum verisine ve kura dokunmaz.
  - Migrasyon 0005 eski serbest metinli üç satırı siler.
- **Neden:**
  - Ekip planındaki SaaS teslimi "SaaS gider hesabı"dır; jüri platformun kendi işletme giderini sorabilir. Tarih ve kaynak, fiyat sayfası değişince sayının neden farklı olduğunu açıklar.
  - Kullanıma bağlı gideri 0 saymak ticari gideri olduğundan düşük gösterirdi (D-011). Alt sınır bilineni gizlemez, bilinmeyeni de saklamaz.
  - Fiyat yenilemesi tam seed gerektirseydi pasaport hash'leri ve basılı QR'lar değişirdi.
  - Eski satırların yeni zorunlu kolonlarını (`key`, `stage`) tahminle doldurmak uydurma olurdu; satırlar seed'den yeniden yazılır.
- **Tarih:** 2026-10-27 · C

### D-026 — Senaryo ekranı: tarayıcıda aynı alan işleviyle hesap, açık girdiler ve kırmızı uyarılar
- **Karar:**
  - `/senaryo` girişle açılır. Hesap tarayıcıda, sunucudakiyle aynı alan işleviyle yapılır (`runScenario`). Girdi değişince sonuç beklemeden yenilenir. Girdiler kaydedilmez.
  - Formüldeki her satır ekranda ayrı bir girdidir (23 alan, `SCENARIO_FIELDS`); gizli sabit yoktur. Varsayılan girdiler ve kaynaklı karşılaştırma değerleri D-029'dadır.
  - Boş girdi bilinmiyor sayılır (`null`) ve ona dayanan sonuç da bilinmiyor olur. Geçersiz girdi (eksi, harf, boşluklu sayı, 4'ten fazla ondalık, %100'ü aşan yüzde) de bilinmiyor sayılır ve alanın altında nedeni yazar. Ondalık ayırıcı nokta ya da virgül olabilir.
  - ReBoard'un ödediği atık bedeli fabrikanın yeni net giderinden düşer ve aynı tutar ReBoard'un malzeme giderine eklenir.
  - Zarar, bilinen ve sıfırdan küçük sonuçtur. Bilinmeyen sonuç zarar sayılmaz. Oluşmayan fiyat koridoru da kırmızı gösterilir.
  - Kırmızı hiçbir zaman yalnızca renkle verilmez: kutunun 4 px kırmızı üst çizgisi, "Zarar" ya da "Koridor yok" çipi, nedenini ve çıkış yolunu anlatan cümle birlikte gelir. Kırmızı sonuç sayısı ekran okuyucuya da okunur.
  - Her sonucun altında formül ve formülün sayılarla yazılmış ara toplamları bulunur.
  - Abonelik ücreti belirlenmediği için fabrikanın yeni giderine yazılmaz; SaaS katkısı ayrı ve aylık gösterilir.
  - Seed'deki `model_inputs` anahtarları alan adlarından türetilir (`wasteT` → `waste_t`).
- **Neden:**
  - Jüri bir girdiyi değiştirip sonucun nasıl tepki verdiğini görebilmeli. Ağ gidiş dönüşü olmadan hesap anında yenilenir. Aynı işlev seed'deki `calc_runs` kayıtlarını da ürettiği için ekran ile kayıt birbirinden ayrışamaz.
  - Bilinmeyeni sıfır saymak sonucu iyimser gösterir (D-011). Geçersiz girdiyi sessizce düzeltmek de aynı hatadır.
  - Atık bedeli yalnızca fabrikaya yazılsaydı ödeme yoktan var olurdu. İki tarafa yazılınca fabrikanın zararı kapandığında ReBoard'un sonucu aynı tutarda düşer; testte toplam korunur.
- **Tarih:** 2026-10-27 · C

### D-025 — Açık ürün pasaportu: süzülmüş görünüm, etiket çapası ve doğrulama ucu
- **Karar:**
  - `/pasaport/[lot]` sayfası ve `/api/verify/[lot]` ucu girişsiz açılır. Yalnızca `is_public` lotlar açılır. Biçimi `PL-yyyy-nnn` olmayan kod veritabanına gitmeden 404 olur.
  - Pasaport lotu, lotun sahibinin gözüyle okur (`withTenant(lot sahibi)`, `lotGraph`). Dışarı çıkan alanları alan katmanı seçer (`src/domain/traceability/passport.ts`). Şunlar çıkmaz: not, kanıt kimliği ve dosyası, fiyat, soy ağacı dışındaki nesneler (ör. kardeş lot).
  - Soy ağacına dokunan her kurumun zinciri (üretici, sağlayıcılar, alıcılar) ilk olaydan başlayarak `verifyChain` ile yeniden hesaplanır. Bunun için başka kurumların olayları okunur, ama dışarı yalnızca hüküm ve süzülmüş olaylar çıkar.
  - Kurum adı yalnızca profili açıksa yazılır. Alıcının adı hiç yazılmaz. Adı yazılmayan zincirin olay sayısı ve son hash'i yazılmaz; olaylarının sıra numarası ve hash'i de yazılmaz. Kırılma varsa yeri her zaman yazılır.
  - Etiket çapası `<sıra>-<hash>` biçimindedir: lotu ilk kez çıktı olarak yazan üretici olayının sırası ve hash'i. QR, sayfa adresini `?a=` çapasıyla taşır.
    - Çapa verilirse üretici zinciri ona göre de denetlenir.
    - Çapa uymazsa pasaport "doğrulama geçmedi" der ve iki olasılığı yazar: zincir yeniden yazıldı ya da çapa bu lotun etiketinden gelmiyor.
    - Okunamayan çapa sayfada yok sayılır; uçta 400 döner.
  - Uç çerez okumaz. Yanıt `no-store` ve `Access-Control-Allow-Origin: *` başlıklarını taşır.
  - QR sunucuda SVG olarak çizilir: `qrcode` paketi, M düzeyi hata düzeltme, 4 modül sessiz bölge.
    - Koyu modül metin rengindedir, zemin sayfa zeminidir.
    - Yüksek kontrast modunda renk değişmez.
    - Adresin sunucu kısmı istekten (`x-forwarded-host`) alınır.
- **Neden:**
  - Alıcı ve jüri lotun kökenini hesap açmadan görmeli. Öte yandan sağlayıcının fiyatı, notları ve lotu kimin aldığı ticari bilgidir (D-016).
  - Sunucunun hükmü yalnızca kayıtların kendi içinde tutarlı olduğunu gösterir. Veritabanına tam erişimi olan biri geçmişi baştan yazarsa zincir yine tutarlı görünür; bunu ancak önceden dışarı verilmiş bir çapa yakalar (ARCHITECTURE §4). Etikete basılan çapa bu dış kayıttır.
  - Doğrulama yine bizim sunucumuzda çalışır. Bağımsız yeniden hesaplama için olayların tamamı ve imzalı bir çapa gerekir (EPCIS JSON-LD dışa aktarımı, Faz 5).
  - Adı gizli bir zincirin ucu iki pasaportta aynı görünürse iki lotu aynı alıcıya bağlar. Olay sayısı da kurumun iş hacmini sezdirir.
  - M düzeyi, kare bir lekede sembolün %8'i silinse de her konumda okundu; L düzeyinde %6'da konumların yarısı okunmadı (M-26).
  - Seed yeniden yüklenince olay zamanları ve hash'ler değişir. Bu yüzden basılı QR son yüklemeden sonra üretilmelidir (`docs/DEMO.md`).
- **Tarih:** 2026-10-27 · C

### D-024 — Tedarik paneli: üretime hazır stok, eşikler ve uyarılar
- **Karar:**
  - Kaç günlük hammadde, yalnızca doğrulanmış partilerin kalanından hesaplanır. Doğrulama bekleyen kg ve parti sayısı ayrı göstergede ve uyarıda durur.
  - Düzey eşikleri kurumun `model_inputs` girdisinden gelir (`days_of_cover_green_min`, `days_of_cover_yellow_min`). İkisi birlikte ve tutarlı değilse varsayılan 14 ve 7 gün kullanılır; ekranda hangisinin kullanıldığı yazar.
  - 30 günlük projeksiyon planlı teslimlerin ayıklama öncesi kg'ını ekler, bu yüzden iyimserdir ve sınıfı en çok "pilot projeksiyon" olur. Bugün kritik değilken projeksiyon kritik düzeye iniyorsa ilk gün ayrı bir uyarıdır ve grafikte işaretlenir.
  - Tedarikçi yoğunlaşması son 90 günde kabul edilen kg'la hesaplanan HHI'dır; 1.800 üstü uyarıdır.
  - Aylık trend kurumun ilk kaydının ayından başlar, en çok 6 ay.
  - Durum çipi: dolgu (Cobalt Green, Orange Yellow, Carmine Red), `text` renginde kenarlık, simge ve yazı (Yeterli, Dikkat, Kritik).
- **Neden:**
  - Kantar fişi kontrol edilmemiş parti üretime giremez (T2.2). Onu stoğa saymak gün sayısını şişirir; tedarik kararı yanlış güvenle verilir.
  - Eşikler ürüne ve tesise göre değişir. Pilot verisi gelene kadar plandaki 14 ve 7 gün varsayılandır.
  - Bugün sarı görünen stok, sipariş için kalan süreyi saklayabilir; kritik düzeye iniş günü bu süreyi görünür kılar.
  - HHI ve 1.800 eşiği kaynaklıdır (`docs/RESEARCH.md` §1). 90 günlük pencere, artık teslim etmeyen tedarikçilerin bugünkü yapıyı gizlemesini önler.
  - Kurum akışa girmeden önceki aylara "0 kg" yazmak düşüş gibi okunur.
  - Zemine 3:1 tutan koyu durum üçlüleri renk körlüğü benzetiminde en çok 0,089 ΔE ayrıştı (eşik 0,1). Açık dolgu ve kenarlıkla bütün ölçüler geçti (`docs/DESIGN_SYSTEM.md` §3).
- **Tarih:** 2026-10-27 · C

### D-023 — Soy ağacı iç içe liste olarak gösterilir, React Flow kullanılmaz
- **Karar:**
  - Lot sayfasındaki soy ağacı (lot → üretim partisi → atık partileri) iç içe `<ul>` listesidir. Her atık partisi satırında sağlayıcı, doğrulama durumu, tahsis edilen kg ve lota düşen kg yazar.
  - Lif dağılımı ve sağlayıcı payları ayrı tanım listelerinde, sayı olarak verilir.
- **Neden:**
  - Ağaç en fazla iki kat derinliğinde; çizge düzeni bilgi eklemez.
  - Liste ekran okuyucuda ve klavyede kendiliğinden çalışır, 360 px'te taşmaz. Ölçüler (M-12, M-13, axe) çizgeye göre doğrudan uygulanır.
  - React Flow (`@xyflow/react` 12) küçültülmüş 180 KB, gzip ile 60 KB JavaScript getirirdi (esbuild ile ölçüldü). Ayrıca ayrı bir erişilebilirlik işi gerektirirdi. Paket bağımlılıklardan çıkarıldı.
- **Tarih:** 2026-10-27 · C

### D-022 — İlan haritası: MapLibre ve OpenFreeMap, listeyle yedekli
- **Karar:**
  - `/pazar` listesinin üstünde MapLibre GL ve OpenFreeMap "positron" altlığı kullanılır; API anahtarı ve çerez yoktur. Harita yalnızca ilçe düzeyindeki konumu gösterir; aynı bilgi aşağıdaki listede de bulunur. WebGL ya da altlık yoksa harita yerine yedek metin çıkar.
  - Aynı koordinattaki ilanlar tek noktada birleşir ve yanında sayıları yazar. Noktaya dokununca tek ilan açılır; birden çok ilan varsa başlıkları bağlantı olarak listelenir.
  - Nokta renkleri `src/design/map.ts` içinden gelir. Kendi ilanı vurgu dolgulu ve koyu halkalıdır; diğerleri koyu dolgulu ve açık halkalıdır. Her noktanın bir katmanı ölçülen altlık örneklerine karşı ≥ 3:1 olur (M-22). Dokunma alanı görünmez bir katmanla 44 px çapındadır.
  - Harita düğmesi (yakınlaştırma, pusula) konmaz. Atıf haritanın altında kendi metnimizle yazılır.
- **Neden:**
  - Konum, eşleşme skorundaki yakınlık bileşenini görünür kılar. Ama demo ağı ya da eski cihaz yüzünden pazar yeri haritaya bağımlı kalmamalı.
  - MapLibre'nin hazır düğmeleri 29×29 px'tir ve dokunma hedefi kuralını (M-12) bozar.
  - Vurgu rengi açık altlıkta 1,64:1'de kaldı; halka bu yüzden gerekti.
  - Karo isteği kullanıcının IP adresini OpenFreeMap'e gösterir; başka kişisel veri gönderilmez.
- **Tarih:** 2026-10-27 · C

### D-021 — Pazar yeri kuralları: miktar, teslim planı ve eşleşme skoru
- **Karar:**
  - Tekrarlı ilanda (`weekly`, `monthly`) miktar **her teslim** içindir. Teklif ilanın biriminde verilir ve ilandaki miktarı aşamaz; ilk teslim günü geçmişte ya da uygunluk penceresi dışında olamaz.
  - Kabul tek işlemde yapılır: teklif koşullu olarak kabul edilir, anlaşma ve teslim planı yazılır. Tek seferlik ilan kabulde kapanır ve diğer açık teklifler reddedilir; tekrarlı ilan açık kalır. Eşzamanlı iki kabulden yalnızca biri geçer.
  - Teslim planı 09:00 TSİ'dedir: önerilen gün (geçmişse kabul günü), haftalık 7 günde bir, aylık ayın aynı gününde (ay sonuna kırpılır). Plan pencere bitişinde ya da 60 günde kesilir, hangisi önceyse.
  - m² panel tesliminde planlı kg `null` kalır; yoğunluk ölçülmedi, 0 yazılmaz.
  - Eşleşme skoru 0–100'dür. Ağırlıklar: bileşim uyumu 40, miktar karşılama 20, kuş uçuşu yakınlık 20 (100 km ve ötesi 0), izleyenle zamanında teslim 20. İpek içeren atık eşleşmez. Bilinmeyen bileşen 0 sayılmaz; ağırlığı skordan düşülür ve skorun hangi ağırlıktan hesaplandığı ekranda yazar.
  - Güvenilirlik yalnızca izleyenin taraf olduğu teslimlerden hesaplanır (D-016).
- **Neden:** Tedarik sürekliliği tekrarlı teslimle ölçülür. Skorun gerekçesi görünmezse güven vermez; bilinmeyeni sıfır saymak dürüstlük kuralına aykırıdır (D-011). Ağırlıklar ve 100 km sınırı Antalya OSB çevresi için seçildi, pilot verisiyle kalibre edilmedi.
- **Tarih:** 2026-10-27 · C

### D-020 — Claude ortak yazar ya da katkıcı olarak görünmez
- **Karar:**
  - Commit mesajlarına ve PR açıklamalarına `Co-Authored-By: Claude…`, `Claude-Session:` ya da "Generated with Claude Code" satırı eklenmez.
  - Commit'lerin yazarı ve işleyeni ekip üyesidir.
  - `.claude/settings.json` içindeki `attribution` ayarı bu satırları kapatır.
  - `.githooks/commit-msg` atıflı mesajı reddeder; CI'daki `pnpm attribution:check` bütün geçmişi denetler (M-19).
  - 2026-10-27'de var olan 5 commit'in mesajlarından bu satırlar silindi; dosya içeriği değişmedi.
- **Neden:** Kullanıcının isteği. Depo herkese açık ve katkıcı listesi yalnızca ekibi göstermeli.
- **Tarih:** 2026-10-27 · K
