# Hikâye sayfası: storyboard ve boru hattı

> Ana sayfadaki scroll hikâyesinin **şu anki** tasarımı (D-004). Sahne, süre ya da bütçe değişirse bu dosya aynı commit'te güncellenir.

## 1. Fikir

"Powers of Ten" gibi tek yönde uzaklaşan bir zoom. Kamera tek bir lifin üzerinde başlar. Scroll ilerledikçe kamera geri çekilir ve süreç ilerler: lif → kırpıntı → çuval → parçalama → pres → panel → ev → Antalya → Dünya. Son karede Dünya'nın yanında canlı etki sayacı ve pazar yerine çağrı düğmesi durur.

Bölüm sınırlarında ölçek eşleşmeli kurgu (match cut) yapılır: bir bölümün son karesindeki biçim, sonraki bölümün ilk karesindeki biçimle aynı yerde ve aynı boyutta olur.

## 2. Bölümler

Kare sayısı masaüstü (16:9) içindir; mobil (9:16) bunun yarısıdır.

| # | Bölüm | Ölçek | Kareler | Metin (TR) | Metin (EN) |
| --- | --- | --- | --- | --- | --- |
| 1 | Lif | ~1 mm | 0–29 | Her şey tek bir lifle başlar. | It starts with a single fibre. |
| 2 | Kırpıntı | ~10 cm | 30–59 | Konfeksiyonda her kesimden geriye kırpıntı kalır. | Every cut in a garment factory leaves scraps behind. |
| 3 | Çuval ve kantar | ~1 m | 60–89 | Atık tartılır; beyan ve tartım yan yana yazılır. | Waste is weighed; declared and weighed kg sit side by side. |
| 4 | Ayıklama ve parçalama | ~3 m | 90–119 | İpek ayıklanır, kalan lif parçalanır. | Silk is sorted out; the rest is shredded into fibre. |
| 5 | Bağlayıcı ve pres | ~5 m | 120–149 | Bağlayıcıyla preslenir. Reçete henüz seçilmedi ve test edilmedi. | Pressed with a binder. The recipe has not yet been chosen or tested. |
| 6 | Panel | ~2 m | 150–179 | 18 mm hedeflenen bir levha; her lekesi bir kaynaktan gelir. | A board targeted at 18 mm; every fleck comes from a source. |
| 7 | Dolap, oda, ev | ~10 m | 180–209 | Panel mobilyaya, mobilya eve girer. | The panel becomes furniture; furniture becomes home. |
| 8 | Antalya, Türkiye, Dünya | ~10.000 km | 210–239 | Bugüne kadar doğrulanmış geri kazanım, altında sayaç (kg) | Verified recovery so far, counter (kg) below |

- Metinlerin tek kaynağı `messages/{tr,en}.json` içindeki `story.sections` alanıdır; bu tablo onların kopyasıdır.
- 2. bölüm miktar söylemez: kaynaklı bir kırpıntı oranı yok (D-028).
- 5. ve 6. bölüm jüri belgesine uyar: reçete seçilmedi ve test edilmedi, 18 mm ölçülmüş değil hedeftir (D-011).
- 8. bölümdeki sayaç canlı veriden gelir, kareye gömülmez. Sayacın yanında sonuç sınıfı rozeti durur (demoda "Sentetik").
- Her bölümün Wada kombinasyonu T3.2'de seçilir ve bu tabloya eklenir. Son bölüm Deep Indigo `#051230` ve Dull Violet Black `#1e0e3f` ile biter.

## 3. Boru hattı

```mermaid
flowchart LR
  B[story/blender/*.py<br/>sahne kodu] -->|blender -b -P| R[story/out/{d,m}/*.png<br/>git dışı]
  R -->|scripts/story-encode.mjs<br/>sharp| E[public/story/{d,m}/*.avif, *.webp]
  E --> M[public/story/manifest.json<br/>bölümler, kareler, boyutlar]
  M --> P[StoryPlayer<br/>canvas]
```

1. `pnpm story:render` Blender 4.5 LTS'yi arka planda (`-b`) çalıştırır (`story/blender/build.py -- --aspect d|m --quality preview|animatic|final --sections 1-8 [--frames 0,15,29]`). Sahne tamamen kodla kurulur, el ile düzenlenmiş `.blend` dosyası yoktur. Motor Cycles'tır (GPU OptiX, OIDN, AgX); gürültü tohumu sabittir, böylece ileri geri scroll'da titreşim olmaz.
   - `lib.py`: ortak kurulum, ışık, kamera ve malzeme kitaplığı (renkler Wada'dan).
   - `textile.py`: lif düzeyinde 2/1 dimi denim; 1. ve 2. bölüm aynı şeridi kullanır.
   - `scraps.py`: kesim masası. Dışbükey kırpıntılar bir yükseklik alanına üst üste düşer; kenarlarından lif saçağı sarkar. Makas, tebeşir ve toplu iğneler masada durur. Kumaş renkleri Wada 126, 199 ve 279 kombinasyonlarından gelir. 1. bölümde arka planda bulanık, 2. bölümde kadrajın kendisidir.
   - `s1_fibre.py` … `s8_*.py`: bölüm sahneleri (1 birim = 1 mm ya da 1 m, bölüme göre).
2. Dünya dokusu NASA Blue Marble'dan gelir (kamu malı).
3. Render 16:9 için 1920×1080, 9:16 için 1080×1920 olarak alınır. Animatik için yarı çözünürlük ve düşük örnekleme kullanılır.
4. `pnpm story:encode` PNG'leri AVIF'e (WebP yedeğiyle) çevirir ve `manifest.json` üretir.
5. Ham PNG'ler `story/out/` altında durur ve git'e girmez.

## 4. Oynatıcı (`src/components/story/StoryPlayer.tsx`)

- Yapışkan (sticky) bir canvas'a çizer. Scroll ilerlemesi GSAP ScrollTrigger ile (scrub 0,35 s) kare indeksine çevrilir; bölüm başına 120 svh scroll.
- `manifest.json` sunucuda okunur (`source.ts`); manifest yoksa sayfa hikâyesiz açılır.
- İlk kare posterdir (LCP öğesi). Yönü tarayıcı `<picture>` içindeki `media="(orientation: portrait)"` ile seçer; sunucu yönü bilmediği için telefon böylece yalnızca 9:16 kareyi indirir. Oynatıcı hidrasyon bitip yön ve hareket tercihi öğrenilmeden ağa çıkmaz.
- AVIF desteği ilk kare çözülerek sınanır; çözülemezse bütün dizi WebP'den gelir.
- İlk bölümün kareleri önce yüklenir (4 paralel istek); gerisi tarayıcı boştayken (`requestIdleCallback`, Safari'de zamanlayıcı).
- İndirilen kareler sıkıştırılmış durur; `createImageBitmap` ile yalnızca o anki karenin 8 ilerisi ve 3 gerisi çözülür. Çözülmüş kareler LRU önbellekte tutulur (28 kare; `deviceMemory ≤ 4` ise 15). İstenen kare hazır değilse en yakın çözülmüş kare çizilir, boş kare kalmaz.
- Masaüstünde 16:9, dar ve dikey ekranda 9:16 dizisi seçilir.
- Canvas çizilen kareyi `data-frame` özniteliğine yazar; E2E testleri buradan okur (`tests/e2e/story.spec.ts`).
- "Hikâyeyi geç" bağlantısı klavyeyle ilk odakta görünür ve hikâyenin altına atlar.
- `prefers-reduced-motion: reduce` tercihinde her bölüm için tek statik kare ve düz metin gösterilir.
- `navigator.connection.saveData` açıksa ya da bağlantı yavaşsa (`2g`, `slow-2g`) kareler birer atlanarak yüklenir.
- Metin katmanı HTML'dir, kareye gömülmez. Böylece çeviri ve erişilebilirlik korunur.
- Saf hesaplar `src/components/story/sequence.ts` içindedir ve birim testlidir (`tests/unit/story-sequence.test.ts`): en-boy seçimi, ilerlemeden kareye geçiş, yükleme sırası, en yakın yüklü kare, çözülmüş karelerin LRU önbelleği, çözme penceresi ve metin görünürlüğü.
- 8. bölümdeki sayaç `/api/counter` ucundan okunur (`impactCounter`, `src/db/repo/counter.ts`, D-013). Uç 60 s önbelleklenir; sayfa böylece statik kalır. Sayaç sonuç sınıfı rozetini taşır; bilinmeyen kalem varsa "en az" yazar, okunamazsa "bilinmiyor" der, asla 0 demez (D-011). 8. bölüm henüz render edilmediyse sayaç hikâyenin altında durur.

## 5. Bütçe ve ölçümler

| Ölçü | Eşik | Test |
| --- | --- | --- |
| Masaüstü dizisi toplamı | ≤ 14 MB | `tests/unit/story-budget.test.ts` (manifest'i dolaşır) |
| Mobil dizisi toplamı | ≤ 6 MB | aynı |
| İlk bölüm | ≤ 1,5 MB | aynı |
| Metin kartının en kötü kare üstündeki kontrastı (%90 opak zemin, altında saf siyah ya da beyaz) | Her palette ≥ 4,5 | `tests/unit/story-contrast.test.ts` |
| Ardışık karelerde sıçrama | SSIM eşiği ilk renderdan sonra kalibre edilir | `tests/unit/story-continuity.test.ts` |
| Scroll kare süresi | p99 ≤ 25 ms (masaüstü) | `tests/e2e/story-perf.spec.ts` |

## 6. Takvim ve yedek

- **28 Ekim sabahı:** Kaba animatik oynatıcıya bağlanır ve akışın tamamı çalışır.
- **29 Ekim öğlen:** Final render ve bütçe testleri tamamlanır.
- **Yedek:** Render yetişmezse animatik kalır. Hareket azaltma modundaki statik kareler her durumda hazırdır.
