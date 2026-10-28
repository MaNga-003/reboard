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
  R -->|scripts/story-encode.mjs<br/>sharp| E[public/story/{d,m}/*.avif<br/>durağan karelerde *.webp]
  E --> M[public/story/manifest.json<br/>bölümler, kareler, boyutlar]
  M --> P[StoryPlayer<br/>canvas]
```

1. `pnpm story:render` Blender 4.5 LTS'yi arka planda (`-b`) çalıştırır (`story/blender/build.py -- --aspect d|m --quality preview|animatic|final --sections 1-8 [--frames 0,15,29]`). Sahne tamamen kodla kurulur, el ile düzenlenmiş `.blend` dosyası yoktur. Motor Cycles'tır (GPU OptiX, OIDN, AgX); gürültü tohumu sabittir, böylece ileri geri scroll'da titreşim olmaz.
   - `lib.py`: ortak kurulum, ışık, kamera ve malzeme kitaplığı (renkler Wada'dan).
   - `textile.py`: lif düzeyinde 2/1 dimi denim; 1. ve 2. bölüm aynı şeridi kullanır.
   - `scraps.py`: kesim masası. Dışbükey kırpıntılar bir yükseklik alanına üst üste düşer; kenarlarından lif saçağı sarkar. Makas, tebeşir ve toplu iğneler masada durur. Kumaş renkleri Wada 126, 199 ve 279 kombinasyonlarından gelir. 1. bölümde arka planda bulanık, 2. bölümde kadrajın kendisidir.
   - `weighing.py`: atölyenin geri kalanı. Kraft kâğıtlı kontrplak masa, beton zemin, önde yer kantarı (indikatörün ekranı kameraya dönük değil, karede rakam yok; D-011) ve kantarın üstünde kırpıntı dolu PP çuval. Çuvalın ağzı dışa kıvrılır, kumaşı mathutils gürültüsüyle buruşur; üstündeki kırpıntılar `scraps.heap` ile, daha buruşuk (`crumple`) düşer. Çuvalda rakamsız, çubuk çizgili kraft etiket ve sicim vardır. Kesim masasında 3. bölümün ara kareleri boş kalmasın diye yıkanmış denim topu (dimi görünür; ekru atkıyla uzaktan gri-mor okunuyordu) ve farklı boyda, kaymış katlanmış kumaşlar durur. 1. bölümden beri sahnede durur; ilk iki bölümde kadraj dışında kalır ve gölge de düşürmez: top bir ara anahtar ışığın %9'unu kesip 2. bölümün son karesini karartıyordu, yeri değiştirildi (`pnpm story:check`, M-30).
   - `shredding.py`: 4. bölümün ayıklama ve parçalama istasyonu. Ayıklama bandının üstünde koyu, çoğu denim bir kumaş katmanı ve onun üstünde kırpıntılar var. Bant uzakta kaldığı için kırpıntıların köşesi yuvarlanır, ortası kabarır ve kenarı alttakinin üstüne sarkar (`scraps.heap(drape=…)`). Yassı ve sivri köşeli kırpıntılar kırık fayans mozaiği gibi okunuyordu. Bu uzaklıkta denimin yüz rengi çözgünün rengidir; desendeki %33 ekru, doğrusal ışıkta laciverti leylak griye çekiyordu. Kırpıntıların arasında ayıklanmayı bekleyen iki ipek saten parça var. Ayrılan ipek bandın yanındaki kasada durur. Yazısız yırtma makinesinin çıkış oluğunun önünde bir lif yığını oluşur:
     - 300 büyük 3B topak ve her birinin yanında 1–4 küçük topak (yüzey altı saçılımlı `lib.fibre_mass`);
     - 160.000 yüzey tutamı;
     - havada ve yerde serbest lif.

     Yığının ana tonu mavi-gridir, benekleri çuvaldaki kumaşların renklerinden gelir. Işıklar iki dar açılı tavan havuzu ve yığının arka ışığıdır. Havuzlar çuvalın tersine eğilir, böylece konileri 3. bölümün kadrajına taşmaz.
   - `s4_shred.py`: Kamera 3. bölümün son karesinden geri çekilip sağa kayar. Masaüstü son karede çuval metin kartının üstünde kalır.
   - `pressing.py`: 5. bölümün bağlayıcı ve pres istasyonu, parçalama hattının devamında. Besleme masasında sac üstünde açılmış lif keçesi, ortada çerçeve plakalı tek katlı sıcak pres (arkada hidrolik ünite ve pano), çıkış masasında preslenmiş benekli levha (1830×3660 mm; 18 mm hedef, ölçüm değil). Keçenin yanında iki bağlayıcı adayı durur: palette sarılı elyaf balyası (PET/CoPET) ve kapalı varil (pMDI). Reçete seçilmediği için ikisi de etiketsizdir, hiçbiri öne çıkmaz (D-011). Keçenin zemini tek tondur; renkler tutamlarda ve seyrek beneklerde kalır. Köşe başına rastgele ton yüzde ara değerlenip sabit rampada eşiklenince keçe kamuflaj gibi, kısa dalgalı sinüs kabarıklığı yakından yumurta kolisi gibi okunuyordu; kabarıklık artık bulanıklaştırılmış beyaz gürültüdür. Işıklar dört dar tavan havuzudur ve 4. bölümdekiler gibi önceki bölümlerin tersine eğilir.
   - `s5_press.py`: Kamera 4. bölümün son karesinden hat boyunca sağa kayıp geri çekilir; lif yığını soldan çıkar, keçe, pres ve levha açılır. Zemin düzlemi 100 m'dir: 5. bölümde kamera 13 m genişliğe çekildiğinde mobil karenin köşesi 40 m'lik zeminin dışına düşüp ufuk çizgisi görünüyordu.
   - `check.py`: render etmeden sahne denetimi (`pnpm story:check`). Sonraki bölümlerin kattıkları (3.: zemin, tartım köşesi, masa eşyaları; 4.: istasyon ve ışıkları; 5.: pres istasyonu ve ışıkları) önceki bölümlerin hiçbir karesinde görünmez ve görünen yüzeye gölge düşürmez. 4. ve 5. bölümün ışıkları 1.–4. bölümde görünen yüzeylere doğrudan ulaşmaz. Çuvaldaki yığın folyo gibi oluklu, dik ya da taşkın değildir. Banttaki yükün çoğu denimdir ve üstünde iki ipek parça vardır. Ölçümler sahne kodunun özetiyle `story/checks.json`'a yazılır; `story/blender` değişip denetim yeniden koşulmazsa `tests/unit/story-scene.test.ts` düşer.
   - `s1_fibre.py` … `s8_*.py`: bölüm sahneleri (1 birim = 1 mm ya da 1 m, bölüme göre).
   - Kamera: 2. bölüm kesim masasının ortasına iner (odak `s2.CENTER`). 3. bölüm oradan geri çekilip azimut 222°'den 200°'ye döner. Bu açıda 1. bölümün üç ışığı klasik üçlü düzen kurar: anahtar ışık sağ önden, arka ışık arkadan, dolgu sol önden. 236°'de anahtar ışık kamera ekseninde kalıyor ve görüntü düzleşiyordu. Işıklar kameraya görünmez (`visible_camera = False`), yansımalarda görünür.
2. Dünya dokusu NASA Blue Marble Next Generation'dan gelir (Ağustos 2004; künye "NASA Earth Observatory", kaynak `docs/RESEARCH.md` §4).
3. Render 16:9 için 1920×1080, 9:16 için 1080×1920 olarak alınır. Final render piksel başına 128 örnekle (uyarlamalı eşik 0,004) alınır; 360 kare ≈ 3,6 saat (D-004). Animatik yarı çözünürlükte ve 128 örnekle (eşik 0,02) alınır.
4. `pnpm story:encode` her kareyi, kendi PNG'sine karşı SSIM 0,97'ye ulaşan en düşük AVIF kalitesiyle kodlar ve `manifest.json` üretir. Böylece sade kare küçük kalır, lif dolu kare inceliğini korur (1. bölümün 0. karesi q20 ile 5 kB, 29. karesi q55 ile 165 kB). Tavan aşılırsa hedef bütün kareler için 0,005 adımla düşer, 0,95'in altına inmez. WebP yalnızca posterde ve her bölümün durağan karesinde (bölümün ortadaki karesi) üretilir.
5. Ham PNG'ler `story/out/` altında durur ve git'e girmez.

## 4. Oynatıcı (`src/components/story/StoryPlayer.tsx`)

- Yapışkan (sticky) bir canvas'a çizer. Scroll ilerlemesi GSAP ScrollTrigger ile (scrub 0,35 s) kare indeksine çevrilir; bölüm başına 120 svh scroll.
- `manifest.json` sunucuda okunur (`source.ts`); manifest yoksa sayfa hikâyesiz açılır.
- İlk kare posterdir (LCP öğesi). Yönü tarayıcı `<picture>` içindeki `media="(orientation: portrait)"` ile seçer; sunucu yönü bilmediği için telefon böylece yalnızca 9:16 kareyi indirir. Oynatıcı hidrasyon bitip yön ve hareket tercihi öğrenilmeden ağa çıkmaz.
- AVIF desteği ilk kare çözülerek sınanır; çözülemezse statik hikâye gösterilir (hareket azaltma modundaki gibi, kareler WebP). Dizinin WebP kopyası yoktur: aynı kalitede AVIF'in 1,7–2,4 katı yer tutar ve yayın paketini 100 MB sınırının üstüne taşırdı.
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
| Kare kalitesi (SSIM, kendi PNG'sine karşı) | Hedef 0,97; tavan için en çok 0,95'e iner | `tests/unit/story-budget.test.ts` (manifest'i dolaşır; ham PNG diskteyse yeniden ölçer) |
| Masaüstü dizisi toplamı | ≤ 25 MB | aynı |
| Mobil dizisi toplamı | ≤ 12 MB | aynı |
| İlk bölüm | ≤ 3 MB | aynı |
| Yayın paketi (CLI yüklemesi, kareler dahil) | ≤ 90 MB (Vercel Hobby sınırı 100 MB) | `tests/unit/deploy-config.test.ts` |
| Metin kartının en kötü kare üstündeki kontrastı (%90 opak zemin, altında saf siyah ya da beyaz) | Her palette ≥ 4,5 | `tests/unit/story-contrast.test.ts` |
| Ardışık karelerde sıçrama | SSIM eşiği ilk renderdan sonra kalibre edilir; bölüm sınırındaki bir karelik duraklama sıçrama sayılmaz | `tests/unit/story-continuity.test.ts` |
| Sonraki bölümün eşyaları önceki bölümlerde | Görünen ışın 0; her ışıkta kesilen pay ≤ 0,02; sonraki bölüm ışığının ulaşan payı ≤ 0,02 | `tests/unit/story-scene.test.ts` (`pnpm story:check` ölçer) |
| Çuvaldaki yığın | Dik yüz ≤ 0,02, oluk ≤ 0,15, tepe ≤ 90 mm, örtü ≥ 0,85 | aynı |
| Banttaki yük | Denimin alan payı ≥ 0,5; ipek 2 parça | aynı |
| Scroll kare süresi | p99 ≤ 25 ms (masaüstü) | `tests/e2e/story-perf.spec.ts` |

## 6. Takvim ve yedek

- **28 Ekim sabahı:** Kaba animatik oynatıcıya bağlanır ve akışın tamamı çalışır.
- **29 Ekim öğlen:** Final render ve bütçe testleri tamamlanır.
- **Yedek:** Render yetişmezse animatik kalır. Hareket azaltma modundaki statik kareler her durumda hazırdır.
