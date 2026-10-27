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
- **Neden:** Jüri bir bağlantı ya da QR kodla açabilsin. AB bölgesi seçildi. Ücretsiz katman yetiyor.
- **Tarih:** 2026-10-27 · K

### D-004 — Hikâye: Apple tarzı kare dizisi, Blender ile otonom render
- **Karar:** Ana sayfadaki scroll hikâyesi, yapışkan bir canvas üzerinde scroll ile oynatılan bir kare dizisidir. Kareler Blender 4.5 LTS'de Python (bpy) ile kodla üretilen sahnelerden Eevee ile render edilir. Masaüstü (16:9) ve mobil (9:16) için ayrı render alınır.
- **Neden:** Kullanıcı fotogerçekçi ve sinematik bir akış istedi. Blender'da sahne kodla üretildiği için otonom çalışılabiliyor, sonuç tekrar üretilebiliyor ve palet birebir tutuyor.
- **Tarih:** 2026-10-27 · K

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
- **Tarih:** 2026-10-27 · K

### D-015 — MVP kapsamı dışında kalanlar
- **Karar:** Canlı GPS, yapay zekâ ile rota optimizasyonu, ödeme ve emanet hesabı, karbon kredisi, blokzincir ve mobil uygulama MVP'ye girmez.
- **Neden:** Üç günde güvenilir biçimde bitmezler ve MVP'nin üç hedefi için gerekli değiller.
- **Tarih:** 2026-10-27 · C

### D-016 — Kiracı izolasyonu
- **Karar:**
  - Kurum verisine erişim tek bir repository katmanından geçer: `withTenant(db, orgId)` (`src/db/repo/tenant.ts`). Görünürlük kuralı her sorguya eklenir; çağıranın koşulu onu gevşetemez.
  - Paylaşılanlar bilinçli olarak sınırlıdır: açık ilanlar, herkese açık kurum profilleri ve panel lotları, taraf olunan teklif, anlaşma ve teslimler, sağlayıcının teslim ettiği partinin tartım sonucu, kurumdan bağımsız kaynaklı değerler. Geri kalan her şey yalnızca sahibine açıktır.
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
- **Karar:** Tartım fişi, irsaliye ve fatura gibi kanıt dosyaları en fazla 5 MB olarak Postgres'te `bytea` biçiminde tutulur. Erişim `EvidenceStore` arayüzünden geçer, böylece ileride S3 ya da R2'ye geçmek kolay olur. Her dosyanın SHA-256 özeti kaydedilir.
- **Neden:** Çevrimdışı demoda da çalışıyor ve ek bir hizmet gerektirmiyor.
- **Tarih:** 2026-10-27 · C

### D-019 — Lisans: tüm hakları saklı
- **Karar:** Depo herkese açıktır ama kod açık kaynak lisansıyla yayımlanmaz. `LICENSE` dosyası "tüm hakları saklıdır" der. Üçüncü taraf bileşenler (Wada renk verisi, MIT) kendi lisanslarıyla kalır.
- **Neden:** Yarışmadan sonra şirketleşme seçeneği açık kalır. Sonradan açık lisansa geçmek kolaydır; yayımlanmış bir sürümü geri kapatmak mümkün değildir.
- **Tarih:** 2026-10-27 · K

### D-020 — Claude ortak yazar ya da katkıcı olarak görünmez
- **Karar:**
  - Commit mesajlarına ve PR açıklamalarına `Co-Authored-By: Claude…`, `Claude-Session:` ya da "Generated with Claude Code" satırı eklenmez.
  - Commit'lerin yazarı ve işleyeni ekip üyesidir.
  - `.claude/settings.json` içindeki `attribution` ayarı bu satırları kapatır.
  - `.githooks/commit-msg` atıflı mesajı reddeder; CI'daki `pnpm attribution:check` bütün geçmişi denetler (M-19).
  - 2026-10-27'de var olan 5 commit'in mesajlarından bu satırlar silindi; dosya içeriği değişmedi.
- **Neden:** Kullanıcının isteği. Depo herkese açık ve katkıcı listesi yalnızca ekibi göstermeli.
- **Tarih:** 2026-10-27 · K
