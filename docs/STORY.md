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
| 8 | Antalya, Türkiye, Dünya | 36 m → ~34.000 km | 210–239 | Bugüne kadar doğrulanmış geri kazanım, altında sayaç (kg) | Verified recovery so far, counter (kg) below |

- Metinlerin tek kaynağı `messages/{tr,en}.json` içindeki `story.sections` alanıdır; bu tablo onların kopyasıdır.
- 2. bölüm miktar söylemez: kaynaklı bir kırpıntı oranı yok (D-028).
- 5. ve 6. bölüm jüri belgesine uyar: reçete seçilmedi ve test edilmedi, 18 mm ölçülmüş değil hedeftir (D-011).
- 8. bölümdeki sayaç canlı veriden gelir, kareye gömülmez. Sayacın yanında sonuç sınıfı rozeti durur (demoda "Sentetik").
- Renkler: kareler fotogerçekçidir; her malzemenin taban rengi Wada sözlüğünden gelir (D-014), karedeki piksel ışıkla değişir. Bölümlerin baskın renkleri sahne kodundan:

| # | Baskın Wada renkleri (malzeme) |
| --- | --- |
| 1 | Denim çözgüsü Deep Lyons Blue, Dark Tyrian Blue, Olympic Blue; atkı Ecru; anahtar ışık Sulpher Yellow |
| 2 | 1. bölümün denimi; kesim masasındaki kırpıntılar Wada 126, 199 ve 279 kombinasyonlarından (Ivory Buff, Ecru, Raw Sienna, Peacock Blue…) |
| 3 | Kraft kâğıt Isabella Color, Maple, Ivory Buff; kontrplak Ivory Buff ve Maple; kantar Dark Medici Blue; çuval White ve Ivory Buff |
| 4 | Lif Salvia Blue, Deep Violet / Plumbeous, Olympic Blue; makine gövdesi Slate Color, motor Dark Medici Blue, koruyucu Orange Yellow |
| 5 | Pres plakası ve boruları Deep Violet / Plumbeous; ünite Dark Medici Blue; koruyucu ve zemin çizgisi Orange Yellow; varil Deep Lyons Blue |
| 6 | Levha zemini Violet Blue, benekleri 4. bölümün lif tonları |
| 7 | Sıva Sulpher Yellow ve Ivory Buff; meşe Maple ve Isabella Color; saksı Burnt Sienna; halı Pinkish Cinnamon; bitki Cossack Green ve Oil Green; güneş Sulpher Yellow |
| 8 | Yer uydu görüntüsünün kendi tonunda (EOX Sentinel-2, M-31); uzay Deep Indigo `#051230`'dan Dull Violet Black `#1e0e3f`'e |

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
   - `s6_panel.py`: Kamera 5. bölümün son karesinden çıkış masasındaki levhaya iner; benekli yüz kadrajı doldurur, ön kenarda 18 mm'lik kalınlık (hedef, ölçüm değil) seçilir ve son karelerde kadrajdan çıkar. Bölümler arasında tek yaklaşma budur.
   - `house.py`: 7. ve 8. bölümün evi (atölyeden ayrı sahne): levhadan dolap, levha kaplı duvar, oturma odası, kesitli iki katlı ev, çatı terası ve havuzlu bahçe. Dolabın üstü levhanın yerelinden kesilir ve aynı malzemeyi taşır; 6. bölümün son karesindeki benekler 7. bölümün ilk karesinde aynı yerde durur. Levha yük taşımayan iç mekân panelidir: evde yalnız dolapta ve duvar kaplamasında görünür.
   - `town.py`: Antalya'da bahçeli bir mahalle. Bitki örtüsü (turunç, zeytin, servi, palmiye, begonvil, çit), sokak (kaldırım, şerit, lamba, park etmiş otomobil) ve sekiz parsel çeşidi. Komşular koleksiyon örneğidir: Cycles geometriyi bir kez tutar.
   - `s7_house.py`: Kamera dolabın üstünden geri çekilip yükselir; dolap, oda, ev ve mahalle açılır, son karede ev neredeyse tepeden görünür. Kesmede ışık: 6. bölümün son karesinde levhayı presin tavan ışıkları aydınlatır. Aynı ışıklar kesmeyle eve taşınır, pozlama −3,16'dan sıfıra dönerken kısılır; yüzeyin ortalama parlaklığı ve eğimi kesmede korunur (M-10).
   - `s8_earth.py`: Kamera 7. bölümün son karesinden dikine yükselir: mahalle 1,6 km'lik bir yerleşime büyür (aynı ızgara, 16 parsel çeşidi, aynalama, sınırda seyrekleşme; ~10.000 koleksiyon örneği), ardından Aksu'nun tarlaları, Antalya körfezi, Türkiye ve uzayda Dünya. Ev gerçek bir noktaya oturur (36,891° K, 30,89° D; kurgusal mahalle). Dünya küresinin kutbu evdedir: halkalar evin yakınında geometrik (12 m'den başlar), uzakta 0,46°'de birdir; tek ağ hem 36 m'lik hem 34.000 km'lik kadrajda yeterince incedir. Her köşe dünya merkezli birim yönünü taşır, enlem ve boylam gölgelendiricide hesaplanır. Zoom hızı kesmede 7. bölümün son karesindeki hızla başlar. Aradaki hız içeriğe göre ayarlanır (`PACE` tablosu, kare başına log genişlik): eşit eğriyle iki aralıkta ardışık kareler bir anda çok farklılaşıyordu. Biri yerleşimin 2–15 km'de saydamlaşmasıydı (mobilde bir gösterilen adımda biterdi, ×1,77). Öbürü Sahra'nın 2000–3600 km'de kadraja girişiydi (masaüstü ×1,39; M-10). Kamera bu aralıklarda yavaşlar, aralarda hızlanır. Tablo `pnpm story:pace --probe` ile yeniden üretilir. `pace_probe.py` bölümü log genişlikte eşit adımlı, düşük çözünürlüklü karelerle render eder. `story-pace.mjs` her kare çiftinin farkını bu karelerin arasından kestirir ve fark dizisini ve zoom hızını pürüzsüz tutan adımları seçer. Kestirim eski eğrinin gerçek karelerini ~%10 içinde tutturdu (×1,38 / ×1,71). Yeni tabloyla final karelerde en büyük basamak masaüstünde ×1,12, mobilde ×1,13 oldu (kestirim ×1,09 / ×1,17); sıçrama yok. Masaüstünde 218–221. karelerde (kadraj 1–4 km) ardışık fark 0,02'ye iner. Burada kamera en hızlı adımlarına yakındır (kare başına ×1,9), ama yerleşimin düzgün ızgarası kendini tekrar ettiği için küçük önizleme az değişir. Kesmedeki ve sondaki adım `lib.soft` eğrisininkiyle aynı kalır; 7. bölüm değişirse `camera_path` hata verir, tablo yeniden üretilir. Gökyüzü ışığı 30–1500 km arasında söner, güneş Wada "White"a döner ve güçlenir: evdeki düz zeminin aydınlığı parlaklıkta sabit kalır (Cycles'ta dik güneş beyaz yüzeyi 1/π yapar; ölçüm, M-31). Kadraj 1000 km'den 10.000 km'ye büyürken pozlama iner; sonunda güneşin dik geldiği nokta evdeki ilk aydınlığı alır. Evde güneş 45,4° eğik gelir; pozlama sabit kalsaydı dik geldiği yer 1,42 kat aydınlanıyor, Sahra pembe-beyaza kayıyordu. Yerleşim, kadraj 2 km'den 15 km'ye büyürken kenarından içe doğru saydamlaşır (bütün malzemelere eklenen ortak `VillageFade` düğüm grubu; evden yatay uzaklık ile anahtarlanan yarıçap). Yerine uydu görüntüsündeki gerçek kent dokusu kalır; önizlemede 3 km'lik gri bir leke gibi duruyordu. Atmosfer yalnız kameranın gördüğü ince bir kabuktur, kenarda ve gündüz yüzünde parlar. Uzay, kürenin çevresinde Deep Indigo'dan köşelerde Dull Violet Black'e gider. AgX koyu ve doygun renkleri değiştirir (Deep Indigo doğrudan verilince ekranda ΔE 0,051); `on_screen` görünüm dönüşümünü render etmeden ölçer (doğrusal renkler `save_render` ile sahnenin ayarlarından geçer) ve ekranda hex'i verecek doğrusal rengi arar (ΔE ≤ 0,0005). Uydu dokusu ekranda kaynağıyla aynı tonda görünür (M-31). Gölgelendiricinin eğrisi (`view_curve`) yalnız gri ekseni çevirir; AgX kanalları karıştırdığı için doygun renkte ton kayar (çöl −23°, deniz −9°). Bu kayma dokunun kendisinde düzeltilir.
   - `earth_tex.py`: 8. bölümün dokularını yüklemeden önce bir kez düzeltir. Görünüm dönüşümü 65³ ızgarada ölçülür; her renk, ekranda kaynağını verecek değere bu tablo üzerinde çözülür. AgX'in beyaza giden yolunda parlak doygun renklere ulaşılamaz; bunlar doğrusal ışıkta adım adım koyulaştırılır ve OKLab'da kaynağa en yakın olan seçilir. Aynı adımda açık deniz tek tona (16, 30, 56) çekilir. Kaynakta Sentinel-2 kıyı şeridinin (~20 km) dışı düz bir dolgudur (24, 44, 76); dolgu ile şerit arasındaki sınır, şerit dikişleri ve kıyı halkaları uzaktan yama gibi görünüyordu. Kıyıya ~4 km'ye kadar su olduğu gibi kalır (sığlık, Nil deltasının bulanık suyu). Sonuç `story/cache/imagery/graded` altına (git dışı) kaynağın, ayarların ve ölçülen tablonun özetiyle yazılır.
   - `check.py`: render etmeden sahne denetimi (`pnpm story:check`). Sonraki bölümlerin kattıkları (3.: zemin, tartım köşesi, masa eşyaları; 4.: istasyon ve ışıkları; 5.: pres istasyonu ve ışıkları) önceki bölümlerin hiçbir karesinde görünmez ve görünen yüzeye gölge düşürmez. 4. ve 5. bölümün ışıkları 1.–4. bölümde görünen yüzeylere doğrudan ulaşmaz. Çuvaldaki yığın folyo gibi oluklu, dik ya da taşkın değildir. Banttaki yükün çoğu denimdir ve üstünde iki ipek parça vardır. Ölçümler sahne kodunun özetiyle `story/checks.json`'a yazılır; `story/blender` değişip denetim yeniden koşulmazsa `tests/unit/story-scene.test.ts` düşer.
   - `s1_fibre.py` … `s8_earth.py`: bölüm sahneleri (1 birim = 1 mm ya da 1 m, bölüme göre).
   - Kamera: 2. bölüm kesim masasının ortasına iner (odak `s2.CENTER`). 3. bölüm oradan geri çekilip azimut 222°'den 200°'ye döner. Bu açıda 1. bölümün üç ışığı klasik üçlü düzen kurar: anahtar ışık sağ önden, arka ışık arkadan, dolgu sol önden. 236°'de anahtar ışık kamera ekseninde kalıyor ve görüntü düzleşiyordu. Işıklar kameraya görünmez (`visible_camera = False`), yansımalarda görünür.
2. 8. bölümün yer dokusu EOX Sentinel-2 cloudless 2016 mozaiğidir (CC BY 4.0, künye ana sayfada hikâyenin altında; kaynak `docs/RESEARCH.md` §4). `node scripts/story-imagery.mjs` karoları indirir ve `story/cache/imagery/` altına (git dışı) evin çevresinde iç içe yamalar (z5 3840 px, z6–z13 2560 px; her düzey bir öncekinin iki katı çözünürlükte, en incesi ~8 m/px) ve küresel mozaik (z4, 8192×4096) yazar. Gölgelendirici yamaları kenarlarını yumuşatarak üst üste koyar. Hepsi aynı mozaikten küçültüldüğü için ton tutarlıdır; kamera yükselirken yalnız çözünürlük değişir. Blue Marble bu yüzden kullanılmadı: denizi parlak mavi, EOX'unki koyu lacivert; kanal başına doğrusal uyum kara ile denizi birlikte eşleyemedi.
3. Render 16:9 için 1920×1080, 9:16 için 1080×1920 olarak alınır. Final render piksel başına 128 örnekle (uyarlamalı eşik 0,004) alınır; 360 kare ≈ 3,6 saat (D-004). Animatik yarı çözünürlükte ve 128 örnekle (eşik 0,02) alınır.
4. `pnpm story:encode` her kareyi, kendi PNG'sine karşı SSIM 0,97'ye ulaşan en düşük AVIF kalitesiyle kodlar ve `manifest.json` üretir. Böylece sade kare küçük kalır, lif dolu kare inceliğini korur (1. bölümün 0. karesi q20 ile 5 kB, 29. karesi q55 ile 165 kB). Tavan aşılırsa hedef bütün kareler için 0,005 adımla düşer, 0,95'in altına inmez. WebP yalnızca posterde ve her bölümün durağan karesinde (bölümün ortadaki karesi) üretilir.
5. Ham PNG'ler `story/out/` altında durur ve git'e girmez.

## 4. Oynatıcı (`src/components/story/StoryPlayer.tsx`)

- Yapışkan (sticky) bir canvas'a çizer; bölüm başına 120 svh scroll. Scroll ilerlemesi oynatıcının kendi `requestAnimationFrame` döngüsüyle yumuşatılıp kare indeksine çevrilir. Eğri ilk sürümdeki GSAP ScrollTrigger `scrub: 0.35` ile aynıdır: gsap'in `expo` eğrisi, 350 ms, kaydırmadan sonraki ilk karede başlar (`sequence.ts`: `expoOut`, `retarget`, `scrubAt`). GSAP paketten çıkarıldı (R-7); birim testte kâhin olarak durur ve iki yumuşatma rastgele scroll dizilerinde 1e-5 içinde aynıdır (M-38). Açılışta ve pencere boyutu değişince yumuşatma yoktur, doğru kare hemen çizilir.
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
| Ardışık karelerde sıçrama | Küçük önizlemede (32 × 18, mobil 9 × 16) OKLab ΔE: basamak, dışarıdaki kare ve tümsek oranları sağlam dizinin uçlarından ~%15 pay; bölüm sınırındaki bir karelik duraklama sıçrama sayılmaz (M-10) | `tests/unit/story-continuity.test.ts` (`node scripts/story-continuity.mjs` ölçer ve uç değerleri yazar) |
| Bölüm sınırı (kesme) | 480 px'te ham ve yapı SSIM ≥ 0,99, ortalama ΔE ≤ 0,004, parlaklık eğimi ≤ 0,008; mobil dikiş ≤ 0,95 × komşu adım | aynı |
| Sonraki bölümün eşyaları önceki bölümlerde | Görünen ışın 0; her ışıkta kesilen pay ≤ 0,02; sonraki bölüm ışığının ulaşan payı ≤ 0,02 | `tests/unit/story-scene.test.ts` (`pnpm story:check` ölçer) |
| Çuvaldaki yığın | Dik yüz ≤ 0,02, oluk ≤ 0,15, tepe ≤ 90 mm, örtü ≥ 0,85 | aynı |
| Banttaki yük | Denimin alan payı ≥ 0,5; ipek 2 parça | aynı |
| Scroll kare süresi | p99 ≤ 25 ms (masaüstü) | `tests/e2e/story-perf.spec.ts` |

## 6. Takvim ve yedek

- **28 Ekim sabahı:** Kaba animatik oynatıcıya bağlanır ve akışın tamamı çalışır.
- **29 Ekim öğlen:** Final render ve bütçe testleri tamamlanır.
- **Yedek:** Render yetişmezse animatik kalır. Hareket azaltma modundaki statik kareler her durumda hazırdır.
