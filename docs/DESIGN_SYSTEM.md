# Tasarım sistemi

> Renk, token, tipografi ve hareketin **şu anki** hâli. Renkler yalnızca Sanzo Wada'nın *A Dictionary of Color Combinations* sözlüğünden gelir (D-014). Kaynak: [MaNga-003/dictionary-of-colour-combinations](https://github.com/MaNga-003/dictionary-of-colour-combinations) (`palettes.json`, `meta.json`, `tokens.json`; MIT).

## 1. Ana palet: seçim bekliyor (Q-1)

Üç aday ölçüldü. Seçim kullanıcının; T3.1'deki önizleme sayfasında gerçek bileşenlerle gösterilecek. Seçilmeyen iki aday seçimden sonra bu dosyadan silinir.

| Aday | Rol: zemin / vurgu / ikincil / metin | Ölçüm (WCAG kontrastı, OKLab ΔE) | Kısıt |
| --- | --- | --- | --- |
| **A #303** enerjik | Naples Yellow `#fbe6a0` / Peach Red `#f15a30` / Neutral Gray `#b6bfc1` / Deep Slate Olive `#253122` | Metin–zemin 10,98:1. Vurgu–zemin 2,71:1. Vurgu–metin 4,05:1 | Vurgu açık zeminde metin olamaz. Düğmede koyu ve büyük yazı gerekir |
| **B #310** toprak, tekstil | Sulpher Yellow `#f5ecc2` / Pinkish Cinnamon `#eeb480` / Olive `#837e31` / Deep Slate Olive `#253122` | Metin–zemin 11,46:1. Olive–zemin 3,54:1. Cinnamon–koyu 7,45:1 | Olive yalnızca büyük metin ve arayüz öğesi için |
| **C #343** panel, güven | Ivory Buff `#ebd3a2` / Burnt Sienna `#ae5224` / Deep Grayish Olive `#635a3a` / Vandar Poel's Blue `#064f6e` | Mavi–zemin 6,11:1. Sienna–zemin 3,56:1. Olive–zemin 4,71:1. ΔE: sienna–olive 0,134, olive–mavi 0,139 | Sienna ile olive ayrı kategori olamaz (ΔE < 0,25) |

Uzay finali (hikâyenin son bölümü): Deep Indigo `#051230` ve Dull Violet Black `#1e0e3f`.

**Geçici durum:** Seçim gelene kadar `ACTIVE_PALETTE = "B"` kullanılıyor; metin kontrastı en yüksek aday bu. Seçim bir satırlık değişikliktir.

## 2. Token yapısı (`src/design/tokens.ts`)

- **Ham renkler:** Wada adı ve hex. Yalnızca `palettes.json` içinden alınır; test bunu denetler.
- **Anlamsal tokenlar:** `bg`, `surface`, `text`, `text-muted`, `accent`, `accent-contrast`, `border`, `focus`.
- **Durum tokenları** (`STATUS`, CSS'te `--rb-ok`, `--rb-on-ok` vb.): kaç günlük hammadde düzeyi ve uyarılar bunları kullanır. Dolgu paletten bağımsızdır; üstündeki yazının rengi paletin rolünden gelir.

  | Durum | Yazı (TR / EN) | Dolgu | Üstündeki yazı | Simge |
  | --- | --- | --- | --- | --- |
  | `ok` | Yeterli / Sufficient | Cobalt Green `#96d1aa` | `text` | daire içinde onay |
  | `warn` | Dikkat / Watch | Orange Yellow `#fcb315` | `text` | üçgen içinde ünlem |
  | `danger` | Kritik / Critical | Carmine Red `#a62c37` | `bg` | sekizgen içinde çarpı |

  Durum çipi açık ya da doygun dolgu, `text` renginde 1 px kenarlık, simge ve yazıdan oluşur; durum renkle tek başına anlatılmaz. Zemine 3:1 tutan koyu üçlüler renk körlüğü benzetiminde en çok 0,089 ΔE'ye ulaştığı için bu yapı seçildi: kenarlık çipi zeminden ayırır, dolgular birbirinden ayrışır (D-024).
- **Sonuç sınıfı rozetleri:** `synthetic`, `sourced_estimate`, `pilot_projection`, `realized`. Her birinin rengi ayrıdır (ΔE ≥ 0,25) ve rozet her zaman metin taşır.
- **Grafik kategorileri:** 159 Wada renginden seçilir. Her çift arasında ΔE en az 0,25, renk körlüğü benzetiminde en az 0,1 olur.
- **Harita noktaları** (`src/design/map.ts`): kendi ilanı `accent` dolgu ve `text` halka; diğerleri `text` dolgu ve `bg` halka; sayı `text` rengiyle `bg` hale üstünde, dolgunun yanında. Altlık dışarıdan geldiği için renkler ölçülen altlık örneklerine karşı denetlenir. A ve C paletlerinde vurgu üstü metin 4,5:1 altında kaldığından sayı dolgunun üstüne yazılmaz.
- **Grafikler** (`src/components/panel/Charts.tsx`, bağımlılıksız SVG): tek eksen; veri çizgisi 2 px `text` renginde; nokta yarıçapı 4 px ve 2 px zemin halkası; sütun en çok 24 px genişlikte ve üstü 4 px yuvarlak; ızgara ince ve düz, eşik çizgileri kesikli. Etiket seçicidir (son sütun, eşikler, kritik iniş günü). Eşik ve işaret etiketlerinin yerini saf yerleşim modülü (`chart-layout.ts`) seçer. Etiket veri çizgisine (kesin parça–kutu kesişimi, 3 px boşluk), noktalara, eşik çizgilerine ve öteki etiketlere değmez. Uzun yazı sığmazsa kısa biçim denenir ("14 gün", "24. gün"). Eşik etiketi için son çare çizginin üstüne oturmaktır; çizgi o noktada 4 px boşlukla kesilir. Hiçbiri sığmazsa etiket çizilmez, bilgi eşik paragrafında, uyarıda ve tabloda kalır. Bu davranış birim testle ve E2E ile ölçülür (M-25). Her grafik klavyeyle gezilir ve altında tablo görünümü bulunur.
- Tokenlar CSS değişkeni olarak Tailwind 4 `@theme` bloğuna aktarılır. Bileşenlerde sabit hex yazılmaz.

## 3. Ölçülen eşikler

| İddia | Ölçü | Eşik | Test |
| --- | --- | --- | --- |
| Metin okunur | WCAG 2 kontrastı | Normal metin ≥ 4,5; büyük metin ve arayüz ≥ 3 | `tests/unit/design-tokens.test.ts` |
| Grafik kategorileri ayrışır | OKLab ΔE; Machado 2009 benzetimi (protan, deutan, tritan) ve ΔE | ≥ 0,25; CVD'de ≥ 0,1 | yazılacak: bugünkü grafikler tek serili, kategori paleti ilk çok serili grafikle gelir (M-8) |
| Durum çipi okunur | Çip yazısı ile dolgu arası WCAG kontrastı; kenarlık (`text`) ile zemin arası | Yazı ≥ 4,5; kenarlık ≥ 3. Ölçülen en düşük: yazı 4,73 (C/danger), kenarlık 6,11 (C) | `tests/unit/design-tokens.test.ts`; ekrandaki hesaplanmış renklerle `tests/e2e/panel.spec.ts` |
| Durum dolgusu zeminden seçilir | OKLab ΔE, dolgu ile zemin | ≥ 0,1. Ölçülen en düşük 0,109 (C/ok) | `tests/unit/design-tokens.test.ts` |
| Durum renkleri ayrı | OKLCh ton farkı; OKLab ΔE; renk körlüğü benzetiminde ΔE | Ton ≥ 30°, ΔE ≥ 0,15, CVD ≥ 0,1. Ölçülen en düşük: ton 57,9° (warn~danger), ΔE 0,168 ve CVD 0,130 (ok~warn). Kategori eşiği 0,25 aranmaz: durum her zaman simge ve yazıyla gelir | aynı |
| Grafik yazıları çakışmaz | Rastgele projeksiyonlarda kesin geometri; tarayıcıda gerçek yazı kutusu, noktalar, eşik çizgileri ve veri işareti. Yazı kutusu iki yandan 2 px mürekkep payı taşır (`INK`) | 0 çakışma; varsayılan eşiklerde 0 düşen etiket | `tests/unit/chart-layout.test.ts`, `tests/e2e/panel.spec.ts` (M-25) |
| Kırmızı sonuç kutusu seçilir (senaryo) | Kutunun üst çizgisi `danger` dolgusu, ekrandaki hesaplanmış renk ve kalınlık; çizgi ile zemin, çip yazısı ile dolgu arası WCAG kontrastı. Kırmızı yalnız gelmez: "Zarar" ya da "Koridor yok" çipi ve açıklama cümlesiyle | Çizgi 4 px ve ≥ 3; çip yazısı ≥ 4,5. Ölçülen: çizgi–zemin 5,82 (B), 5,57 (A), 4,73 (C) | `tests/e2e/scenario.spec.ts` (M-28) |
| Renkler Wada'dan | Her rolün ve durumun hex'i sözlükte var | %100 | `tests/unit/design-tokens.test.ts` |
| Pasaport QR'ı okunur | ISO/IEC 15415 sembol kontrastı (zemin ile modülün göreli parlaklık farkı); jsQR ile çözme; modül başına piksel. Koyu modül `text`, zemin `bg` | SC ≥ 0,55; modül ≥ 4 px. Ölçülen SC: A 0,769, B 0,806, C 0,601. Ekranda 0,806 ve 4,53 px | `tests/unit/qr.test.ts`, `tests/e2e/passport.spec.ts` (M-26) |
| Harita noktası altlıkta seçilir | WCAG kontrastı, altlık örneklerine ve ekran pikseline karşı | Nokta ≥ 3; etiket ≥ 4,5 | `tests/unit/map.test.ts`, `tests/e2e/market.spec.ts` (M-22) |

## 4. Tipografi

- Yazı tipleri: [Inter](https://rsms.me/inter/) (arayüz ve metin) ve [Fraunces](https://fonts.google.com/specimen/Fraunces) (hikâye başlıkları). İkisi de OFL lisanslıdır ve `next/font` ile yerel olarak sunulur. Türkçe karakterleri (ç, ğ, ı, İ, ö, ş, ü) kapsadıkları testle denetlenir.
- Ölçek: 12 / 14 / 16 / 18 / 24 / 32 / 48 / 72 px. Gövde metni 16 px'tir.
- Sayılar `font-variant-numeric: tabular-nums` ile yazılır; tablolarda sütunlar böyle hizalanır. Tek başına duran büyük gösterge sayısı istisnadır: orantılı rakamla yazılır, çünkü eşit genişlikli "1" büyük boyda dağınık görünür. Binlik ayırıcı dile göredir (`tr`: 361.500; `en`: 361,500).

## 5. Yerleşim ve dokunma

- Kırılım noktaları 360, 390, 768, 1024 ve 1440 px'tir. Hiçbirinde yatay taşma olmaz.
- Dokunma hedefi en az 44×44 px, komşu hedefler arası en az 8 px.
- Odak halkası `focus` tokenıyla en az 2 px çizilir ve zemine karşı kontrastı en az 3'tür.

## 6. Hareket

- Hikâye kare dizisi scroll ile ilerler: GSAP ScrollTrigger ile scrub, Lenis ile yumuşak scroll.
- Arayüz geçişleri 150–250 ms sürer.
- `prefers-reduced-motion: reduce` tercihinde kare dizisi yerine bölüm başına tek statik kare gösterilir ve geçişler kapanır.
