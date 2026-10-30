# Tasarım sistemi

> Renk, token, tipografi ve hareketin **şu anki** hâli. Renkler yalnızca Sanzo Wada'nın *A Dictionary of Color Combinations* sözlüğünden gelir (D-014). Kaynak: [MaNga-003/dictionary-of-colour-combinations](https://github.com/MaNga-003/dictionary-of-colour-combinations) (`palettes.json`, `meta.json`, `tokens.json`; MIT).

## 1. Paletler

Renkler yalnızca Wada sözlüğünden gelir (D-014). İki katman vardır.

### 1.1 Arayüz paleti (UI, D-034)

Kenar çubuğu, kartlar, düğmeler, tablolar ve grafikler bu rolleri kullanır (`src/design/tokens.ts` → `UI`; Tailwind'de `bg-surface`, `text-ink`, `bg-brand` …). Koyu indigo hikâyenin uzay finalinden, terrakota atölyenin sıcak ışığından gelir.

| Rol | Wada rengi | Hex | Nerede |
| --- | --- | --- | --- |
| `ink` | Deep Indigo | `#051230` | metin |
| `muted` | Slate Color | `#34454c` | ikincil metin |
| `subtle` | Dark Medici Blue | `#547076` | üçüncül metin, hash, etiket |
| `surface` | White | `#ffffff` | kart ve üst başlık zemini |
| `brand` | Burnt Sienna | `#ae5224` | düğme, bağlantı, veri çizgisi, kendi ilanı noktası |
| `onBrand` | White | `#ffffff` | düğme yazısı |
| `side`, `sideInk` | Deep Indigo, White | `#051230`, `#ffffff` | koyu yüzey (kenar çubuğu, görselli başlık) ve yazısı |
| `glow` | Golden Yellow | `#f3a257` | yalnızca süs ışığı ve işaret; yazı rengi değil |
| `sky` | Pale King's Blue | `#a7d4e4` | gösterge üst çizgisi, lif çubuğu |

Ton açıkları (Wada rengi + saydamlık, hex'e çözülür): `canvas` = ink %3,5 → `#f6f7f8` (sayfa zemini); `line` = ink %12 → `#e1e3e6`; `lineStrong` = ink %50 → `#828998` (input kenarı); `brandSoft` = brand %10; `sideMuted` = beyaz %68; `sideActive` = beyaz %10 (koyu yüzeyde).

Ölçümler (WCAG kontrastı): ink 18,49 (beyaz) ve 17,24 (canvas); muted 9,99 ve 9,32; subtle 5,31 ve 4,95; düğme yazısı 5,21; brand bağlantı yazısı 5,21 (beyaz) ve 4,86 (canvas); koyu yüzeyde sideInk 18,49, sideMuted 8,81 (aktif öğede 6,80); input kenarı 3,51 (arayüz öğesi, eşik 3).

### 1.2 Hikâye ve eski sınıflar

`PALETTES[ACTIVE_PALETTE]` (palet B: Sulpher Yellow zemin, Deep Slate Olive metin, Pinkish Cinnamon vurgu) hikâye kartının, `body` zemininin, durum çiplerinin (`STATUS`) ve senaryo uyarı çizgisinin rengidir. Hikâye bölümlerinin kare renkleri paletten bağımsızdır (her bölüm kendi Wada rengini taşır). A ve C adayları seçilmeyecek; ölçüm testleri için kodda duruyor.

Uzay finali (hikâyenin son bölümü): Deep Indigo `#051230` ve Dull Violet Black `#1e0e3f`.

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
- **Harita noktaları** (`src/design/map.ts`): kendi ilanı `brand` dolgu ve `ink` halka; diğerleri `ink` dolgu ve beyaz halka; sayı `ink` rengiyle beyaz hale üstünde, dolgunun yanında. Altlık dışarıdan geldiği için renkler ölçülen altlık örneklerine karşı denetlenir. Sayı dolgunun üstüne değil yanına yazılır; kontrastı kendi haleyle ölçülür.
- **Grafikler** (`src/components/panel/Charts.tsx`, bağımlılıksız SVG): tek eksen; veri çizgisi 2 px `text` renginde; nokta yarıçapı 4 px ve 2 px zemin halkası; sütun en çok 24 px genişlikte ve üstü 4 px yuvarlak; ızgara ince ve düz, eşik çizgileri kesikli. Etiket seçicidir (son sütun, eşikler, kritik iniş günü). Eşik ve işaret etiketlerinin yerini saf yerleşim modülü (`chart-layout.ts`) seçer. Etiket veri çizgisine (kesin parça–kutu kesişimi, 3 px boşluk), noktalara, eşik çizgilerine ve öteki etiketlere değmez. Uzun yazı sığmazsa kısa biçim denenir ("14 gün", "24. gün"). Eşik etiketi için son çare çizginin üstüne oturmaktır; çizgi o noktada 4 px boşlukla kesilir. Hiçbiri sığmazsa etiket çizilmez, bilgi eşik paragrafında, uyarıda ve tabloda kalır. Bu davranış birim testle ve E2E ile ölçülür (M-25). Her grafik klavyeyle gezilir ve altında tablo görünümü bulunur.
- Tokenlar CSS değişkeni olarak Tailwind 4 `@theme` bloğuna aktarılır. Bileşenlerde sabit hex yazılmaz.

## 3. Ölçülen eşikler

| İddia | Ölçü | Eşik | Test |
| --- | --- | --- | --- |
| Metin okunur | WCAG 2 kontrastı | Normal metin ≥ 4,5; büyük metin ve arayüz ≥ 3 | `tests/unit/design-tokens.test.ts` |
| Arayüz paleti okunur (T4.8) | WCAG 2 kontrastı, UI rolleri: ink, muted, subtle, düğme yazısı, bağlantı, koyu yüzey, input kenarı | ink ≥ 7; ikincil ve üçüncül metin, düğme yazısı, bağlantı ≥ 4,5; input kenarı ≥ 3. Ölçülen en düşük metin: subtle / canvas 4,95; düğme yazısı 5,21. Kötü örnek: glow rengi beyazda yazı olarak < 4,5 | `tests/unit/design-tokens.test.ts` (UI bloğu); ekranda axe `color-contrast` (`tests/e2e`) |
| Grafik kategorileri ayrışır | OKLab ΔE; Machado 2009 benzetimi (protan, deutan, tritan) ve ΔE | ≥ 0,25; CVD'de ≥ 0,1 | yazılacak: bugünkü grafikler tek serili, kategori paleti ilk çok serili grafikle gelir (M-8) |
| Durum çipi okunur | Çip yazısı ile dolgu arası WCAG kontrastı; kenarlık (`text`) ile zemin arası | Yazı ≥ 4,5; kenarlık ≥ 3. Ölçülen en düşük: yazı 4,73 (C/danger), kenarlık 6,11 (C) | `tests/unit/design-tokens.test.ts`; ekrandaki hesaplanmış renklerle `tests/e2e/panel.spec.ts` |
| Durum dolgusu zeminden seçilir | OKLab ΔE, dolgu ile zemin | ≥ 0,1. Ölçülen en düşük 0,109 (C/ok) | `tests/unit/design-tokens.test.ts` |
| Durum renkleri ayrı | OKLCh ton farkı; OKLab ΔE; renk körlüğü benzetiminde ΔE | Ton ≥ 30°, ΔE ≥ 0,15, CVD ≥ 0,1. Ölçülen en düşük: ton 57,9° (warn~danger), ΔE 0,168 ve CVD 0,130 (ok~warn). Kategori eşiği 0,25 aranmaz: durum her zaman simge ve yazıyla gelir | aynı |
| Grafik yazıları çakışmaz | Rastgele projeksiyonlarda kesin geometri; tarayıcıda gerçek yazı kutusu, noktalar, eşik çizgileri ve veri işareti. Yazı kutusu iki yandan 2 px mürekkep payı taşır (`INK`) | 0 çakışma; varsayılan eşiklerde 0 düşen etiket | `tests/unit/chart-layout.test.ts`, `tests/e2e/panel.spec.ts` (M-25) |
| Kırmızı sonuç kutusu seçilir (senaryo) | Kutunun üst çizgisi `danger` dolgusu, ekrandaki hesaplanmış renk ve kalınlık; çizgi ile zemin, çip yazısı ile dolgu arası WCAG kontrastı. Kırmızı yalnız gelmez: "Zarar" ya da "Koridor yok" çipi ve açıklama cümlesiyle | Çizgi 4 px ve ≥ 3; çip yazısı ≥ 4,5. Ölçülen: çizgi–zemin 5,82 (B), 5,57 (A), 4,73 (C) | `tests/e2e/scenario.spec.ts` (M-28) |
| Renkler Wada'dan | Her rolün ve durumun hex'i sözlükte var | %100 | `tests/unit/design-tokens.test.ts` |
| Pasaport QR'ı okunur | ISO/IEC 15415 sembol kontrastı (zemin ile modülün göreli parlaklık farkı); jsQR ile çözme; modül başına piksel. Koyu modül `ink`, zemin beyaz (`surface`) | SC ≥ 0,55; modül ≥ 4 px. Sayfadaki QR beyaz zeminde ink modül: SC 0,993 (WCAG 18,49:1); ekranda e2e eşikleri geçti. Palet adaylarında SC: A 0,769, B 0,806, C 0,601 | `tests/unit/qr.test.ts`, `tests/e2e/passport.spec.ts` (M-26) |
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

- Hikâye kare dizisi scroll ile ilerler. Yumuşatmayı GSAP ScrollTrigger scrub'ı (0,35 s) yapar. Sayfanın kendi scroll'una dokunulmaz: klavye, ekran okuyucu ve tarayıcı bul (Ctrl+F) bildikleri gibi çalışır.
- Arayüz geçişleri 150–250 ms sürer.
- `prefers-reduced-motion: reduce` tercihinde kare dizisi yerine bölüm başına tek statik kare gösterilir ve geçişler kapanır.

## 7. Uygulama kabuğu ve sayfa kalıpları (T4.8, D-034)

- **Kabuk** (`src/app/[locale]/(app)/layout.tsx`): ≥ 1024 px'te sol koyu kenar çubuğu (marka, gezinme, "hikâyeyi yeniden izle" kartı) ve üstte yapışkan açık başlık (rol menüsü, kurum ve rol, çıkış). Daha dar ekranda kenar çubuğu gizlenir, gezinme altta sabit sekme çubuğuna geçer.
- **Test sözleşmeleri** (davranışı sabitler; değişirse testler de değişmelidir): görünür `<nav>` tek olur; başlıkta tek `<summary>` (rol menüsü) bulunur ve `<header>` yalnızca kabukta kullanılır; `data-testid="viewer"` tek olur; `data-kpi`, `data-level`, `data-result-class` öznitelikleri ve gezinme bağlantı adları (Pazar yeri, İzlenebilirlik, Panel, Senaryo) korunur.
- **Sayfa başlığı:** `PageBanner` (koyu yüzey, sağda hikâyenin render karesi) ya da `PageHeader`. Görsel yalnızca süstür (`alt=""`); anlam yazıdadır. Kare `<Still name>` ile gelir (`src/components/ui/Still.tsx`; düz `<img>` bilinçli: kareler hazır WebP, `next/image` üretimde sharp ister).
- **Kartlar ve tablolar:** `card`, `cardPad` (`src/components/ui/classes.ts`); tablo `TableWrap`, `th`, `td`, `tr` (`src/components/trace/Table.tsx`). Dar ekranda hücre dolgusu 8 px: tablolar 360 px'te kaymadan sığar.
- **Izgara tuzağı:** `<details>` ızgara konteyneridir; içinde kendi kabında kayan geniş bir tablo varsa `min-w-0` ve `grid-cols-[minmax(0,1fr)]` verilir, yoksa sayfayı ya da kendi kutusunu taşırır (M-13, M-37).
