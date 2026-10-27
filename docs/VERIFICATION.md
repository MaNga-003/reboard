# Doğrulama kataloğu

> Her iddia bir ölçüye, bir eşiğe ve bir teste bağlıdır. Son ölçülen değer `state.json` içindeki `metrics` alanında durur. Bir değer değişince bu tablo ve `state.json` birlikte güncellenir.
>
> Yöntem: gözle ya da elle yapılacak her kontrol önce sayıya çevrilir. Eşik, kötü örneği yakalayacak biçimde kalibre edilir ve test bir kez bilerek bozularak denenir.

## 1. Katalog

| Kimlik | İddia | Ölçü | Eşik | Test | Durum |
| --- | --- | --- | --- | --- | --- |
| M-1 | Metin okunur | WCAG 2 kontrastı, token kataloğu dolaşılarak | Normal ≥ 4,5; büyük metin ve arayüz ≥ 3 | `tests/unit/design-tokens.test.ts` | yazılacak (T3.1) |
| M-2 | Hikâye kare bütçesi | `manifest.json` dosya boyutları | Masaüstü ≤ 14 MB, mobil ≤ 6 MB, ilk bölüm ≤ 1,5 MB | `tests/unit/story-budget.test.ts` | yazılacak (T3.5) |
| M-3 | Scroll akıcı | Playwright ve CDP ile kare süresi kaydı | p99 ≤ 25 ms (masaüstü) | `tests/e2e/story-perf.spec.ts` | yazılacak (T3.4) |
| M-4 | Kiracılar ayrılır | A kullanıcısı B'nin özel uç noktalarını ve repository fonksiyonlarını dener | 0 başarılı erişim | `tests/integration/tenant-isolation.test.ts` | yazılacak (T1.5) |
| M-5 | Hesaplar doğru | Vitest ve fast-check özellik testleri | Uyuşmayan para birimi ya da vergi temeli hata verir; boş girdi `null` döner; `src/domain` kapsamı ≥ %90 | `tests/unit/calc/*.test.ts` | 27 test yeşil (fast-check, her özellik 100 rastgele örnek); rapor sayıları birebir; `src/domain` kapsamı satır, dal ve fonksiyonda %100 (eşik CI'da zorunlu). Bilerek bozma: 4 değişikliğin 4'ü yakalandı |
| M-6 | Kayıt değiştirilemez | Olay değiştirilip `verifyChain` çalıştırılır; DB'de UPDATE, DELETE ve TRUNCATE denenir | 0 kaçak | `tests/integration/append-only.test.ts`, `tests/integration/custody-chain.test.ts`, `tests/unit/traceability/*.test.ts` | DB: 0 kaçak (UPDATE, DELETE, cascade, TRUNCATE ve çatal reddedildi). `verifyChain`: 500 rastgele zincirde 10 tür tek olay değişikliğinin hiçbiri kaçmadı; yer ve neden doğru. Silme, yer değiştirme, araya ekleme, sırayı koruyarak yeniden zincirleme ve başka org kuyruğu da yakalandı. Bütün kuyruğu yeniden yazmayı ve sondan silmeyi yalnızca çapa yakalar (bilinen sınır, testli). PGlite gidiş-dönüşü, 8 eşzamanlı ekleme ve tetikleyiciyi kapatan saldırgan testleri yeşil. Bilerek bozma: 15 değişikliğin 15'i yakalandı |
| M-7 | Kütle dengesi | `abs(Σgirdi − Σçıktı − kayıp) ÷ Σgirdi` | ≤ %2, aşılırsa açıklama zorunlu | `tests/unit/traceability/mass-balance.test.ts` | Testli durumlar: örnek (%1); sınır (%2 içeride, %2,1 dışarıda); negatif fark; bilinmeyen değer → `null`; boş açıklama reddi; 100 rastgele örnekte tanımla eşitlik. Bilerek bozma: sınır `<`, nem kaybının düşmesi, mutlak değerin kalkması ve bilinmeyende açıklama istenmesi yakalandı |
| M-8 | Grafik renkleri ayrışır | OKLab ΔE; Machado CVD benzetimi | ≥ 0,25; CVD'de ≥ 0,1; durum renkleri arası ton farkı ≥ 30° | `tests/unit/design-tokens.test.ts` | yazılacak (T3.1) |
| M-9 | Hikâye metni okunur | Metin kutusunun altındaki gerçek kare piksellerine göre kontrast | Her bölümde ≥ 4,5 | `tests/unit/story-contrast.test.ts` | yazılacak (T3.5) |
| M-10 | Kare dizisi kesintisiz | Ardışık karelerde SSIM, sıçrama dedektörü | İlk renderdan sonra kalibre edilir | `tests/unit/story-continuity.test.ts` | yazılacak (T3.5) |
| M-11 | Hızlı açılır | Lighthouse CI, mobil profil | LCP ≤ 2,5 s; CLS ≤ 0,1; TBT ≤ 200 ms; `/` JS ≤ 200 KB gz | `lighthouserc.json` | yazılacak (T4.1) |
| M-12 | Erişilebilir | axe-core; klavye E2E; dokunma hedefi dikdörtgenleri | 0 ciddi ya da kritik ihlal; hedef ≥ 44×44 px | `tests/e2e/smoke.spec.ts` (ekranlar eklendikçe genişler) | /tr, /en: 0 ciddi ihlal; dokunma hedefi henüz ölçülmedi |
| M-13 | Yerleşim bozulmaz | 360, 390, 768, 1024 ve 1440 px'te yatay taşma ve çakışma; TR ve EN | 0 | `tests/e2e/smoke.spec.ts` (ekranlar eklendikçe genişler) | /tr, /en, 5 genişlik: 0 px |
| M-14 | Çeviri tam | `messages/tr.json` ve `en.json` anahtar eşitliği | 0 eksik | `tests/unit/i18n.test.ts` | 0 eksik (20 anahtar) |
| M-15 | Dürüstlük | KPI bileşeni türü `resultClass` ister; E2E "Sentetik" rozetini arar | Her KPI'da rozet | `tests/e2e/honesty.spec.ts` | yazılacak (T2.3) |
| M-16 | Belgeler güncel | `pnpm docs:check` | Yeşil | `scripts/docs-check.mjs`, CI | yeşil (T0.2) |
| M-17 | Demo çalışır | `DEMO.md` akışı canlı URL'de Playwright ile | Yeşil | `tests/e2e/demo.spec.ts` | yazılacak (T4.3) |
| M-18 | Gizli bilgi sızmaz | gitleaks; Vercel'e yüklenen dosya listesinde hassas yol sayısı | 0 gerçek bulgu; yanlış pozitif yalnızca incelenip `.gitleaksignore` dosyasına parmak iziyle girer | CI `secrets` işi (gitleaks v8.30.1, bütün geçmiş), `tests/unit/deploy-config.test.ts` | gitleaks: 13 commit, 0 gerçek bulgu. 2 yanlış pozitif, ikisi de genel API anahtarı kuralından: seed'deki elektrik fiyatı referansının adı (CI çalıştırması 40450201068) ve bu bulguyu anlatırken o adı alıntılayan belge satırı (40450443734). İkisi de incelendi ve `.gitleaksignore` dosyasına parmak iziyle eklendi. Ders: belgede bulguyu alıntılamak yerine tarif et. Yayın: 67 dosyanın 0'ı hassas (`.private`, `.env*`, `.data`, belge). Bilerek bozma: `!/.private` eklenince, izlenmeyen bir yol izne alınınca ve izlenen bir yol karar listesinden çıkarılınca test düştü |
| M-19 | Claude katkıcı görünmez (D-020) | Bütün geçmişte atıf satırı, Anthropic ya da Claude kimlikli yazar veya işleyen sayısı | 0 | `scripts/no-ai-attribution.mjs --history` (CI), `.githooks/commit-msg`, `tests/unit/no-ai-attribution.test.ts` | 0 bulgu (7 commit, CI). Bilerek bozma: temizlenmeden önceki geçmişte 10 atıf satırının 10u yakalandı; kanca atıflı mesajı reddetti |
| M-20 | Demo verisi dürüst ve tutarlı | Seed gerçek migrasyonlarla PGlite'a yüklenip veritabanından okunur: boş tablolar, sonuç sınıfları, zincir doğrulaması, kütle dengesi, tahsis kuralları, `null` örnekleri, belirlenimcilik | Boş tablo yalnızca `invitation`, `session`, `verification`; `synthetic` dışı sınıf yalnızca `reference_values` ve `saas_costs`; 5 zincir de doğrulanır; 0 hatalı tahsis | `tests/integration/seed.test.ts` | 16/16 yeşil; 366 satır; 63 olay, 5 zincir; 5 üretim partisinden 1'i bilerek toleransı aşar ve açıklamalı. Bilerek bozma: sınıfı `pilot_projection` yapmak ve tahsiste zaman kuralını kaldırıp sırayı ters çevirmek yakalandı (2/2). İlk bozmada tahsis testi kör kaldı; "üretimden önce teslim" kuralı eklendi |

## 2. Kullanıcıya kalanlar (ölçülemez)

- Ana palet seçimi (Q-1, T3.1).
- Hikâyenin his ve zevk onayı (T3.6). En fazla 4 maddelik kontrol listesiyle sorulur.
- Sunum ile platform dilinin uyumu (Q-3, T4.5).
- Provalar (T4.4).
