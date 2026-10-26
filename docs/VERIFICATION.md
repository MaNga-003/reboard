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
| M-5 | Hesaplar doğru | Vitest ve fast-check özellik testleri | Uyuşmayan para birimi ya da vergi temeli hata verir; boş girdi `null` döner; `src/domain` kapsamı ≥ %90 | `tests/unit/calc/*.test.ts` | yazılacak (T1.2) |
| M-6 | Kayıt değiştirilemez | Olay değiştirilip `verifyChain` çalıştırılır; DB'de UPDATE ve DELETE denenir | 0 kaçak | `tests/unit/traceability/*.test.ts`, `tests/integration/append-only.test.ts` | yazılacak (T1.1, T1.3) |
| M-7 | Kütle dengesi | `|Σgirdi − Σçıktı − kayıp| ÷ Σgirdi` | ≤ %2, aşılırsa açıklama zorunlu | `tests/unit/traceability/mass-balance.test.ts` | yazılacak (T1.3) |
| M-8 | Grafik renkleri ayrışır | OKLab ΔE; Machado CVD benzetimi | ≥ 0,25; CVD'de ≥ 0,1; durum renkleri arası ton farkı ≥ 30° | `tests/unit/design-tokens.test.ts` | yazılacak (T3.1) |
| M-9 | Hikâye metni okunur | Metin kutusunun altındaki gerçek kare piksellerine göre kontrast | Her bölümde ≥ 4,5 | `tests/unit/story-contrast.test.ts` | yazılacak (T3.5) |
| M-10 | Kare dizisi kesintisiz | Ardışık karelerde SSIM, sıçrama dedektörü | İlk renderdan sonra kalibre edilir | `tests/unit/story-continuity.test.ts` | yazılacak (T3.5) |
| M-11 | Hızlı açılır | Lighthouse CI, mobil profil | LCP ≤ 2,5 s; CLS ≤ 0,1; TBT ≤ 200 ms; `/` JS ≤ 200 KB gz | `lighthouserc.json` | yazılacak (T4.1) |
| M-12 | Erişilebilir | axe-core; klavye E2E; dokunma hedefi dikdörtgenleri | 0 ciddi ya da kritik ihlal; hedef ≥ 44×44 px | `tests/e2e/a11y.spec.ts` | yazılacak (T2.x) |
| M-13 | Yerleşim bozulmaz | 360, 390, 768, 1024 ve 1440 px'te yatay taşma ve çakışma; TR ve EN | 0 | `tests/e2e/layout.spec.ts` | yazılacak (T2.x) |
| M-14 | Çeviri tam | `messages/tr.json` ve `en.json` anahtar eşitliği | 0 eksik | `tests/unit/i18n.test.ts` | yazılacak (T0.5) |
| M-15 | Dürüstlük | KPI bileşeni türü `resultClass` ister; E2E "Sentetik" rozetini arar | Her KPI'da rozet | `tests/e2e/honesty.spec.ts` | yazılacak (T2.3) |
| M-16 | Belgeler güncel | `pnpm docs:check` | Yeşil | `scripts/docs-check.mjs`, CI | yeşil (T0.2) |
| M-17 | Demo çalışır | `DEMO.md` akışı canlı URL'de Playwright ile | Yeşil | `tests/e2e/demo.spec.ts` | yazılacak (T4.3) |
| M-18 | Gizli bilgi sızmaz | gitleaks | 0 bulgu | CI | yazılacak (T0.5) |

## 2. Kullanıcıya kalanlar (ölçülemez)

- Ana palet seçimi (Q-1, T3.1).
- Hikâyenin his ve zevk onayı (T3.6). En fazla 4 maddelik kontrol listesiyle sorulur.
- Sunum ile platform dilinin uyumu (Q-3, T4.5).
- Provalar (T4.4).
