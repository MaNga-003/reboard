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

## 2. Token yapısı (`src/design/tokens.ts`)

- **Ham renkler:** Wada adı ve hex. Yalnızca `palettes.json` içinden alınır; test bunu denetler.
- **Anlamsal tokenlar:** `bg`, `surface`, `text`, `text-muted`, `accent`, `accent-contrast`, `border`, `focus`.
- **Durum tokenları:** `ok`, `warn`, `danger`, `info`. Kaç günlük hammadde eşikleri ve uyarılar bunları kullanır. Aralarındaki ton farkı en az 30° olur. Durum renkle tek başına anlatılmaz; simge ve metin de bulunur.
- **Sonuç sınıfı rozetleri:** `synthetic`, `sourced_estimate`, `pilot_projection`, `realized`. Her birinin rengi ayrıdır (ΔE ≥ 0,25) ve rozet her zaman metin taşır.
- **Grafik kategorileri:** 159 Wada renginden seçilir. Her çift arasında ΔE en az 0,25, renk körlüğü benzetiminde en az 0,1 olur.
- Tokenlar CSS değişkeni olarak Tailwind 4 `@theme` bloğuna aktarılır. Bileşenlerde sabit hex yazılmaz.

## 3. Ölçülen eşikler

| İddia | Ölçü | Eşik | Test |
| --- | --- | --- | --- |
| Metin okunur | WCAG 2 kontrastı | Normal metin ≥ 4,5; büyük metin ve arayüz ≥ 3 | `tests/unit/design-tokens.test.ts` |
| Kategoriler ayrışır | OKLab ΔE | ≥ 0,25 | aynı |
| Renk körü de ayırır | Machado 2009 benzetimi (protan, deutan, tritan) ve ΔE | ≥ 0,1 | aynı |
| Durum renkleri ayrı | OKLCh ton farkı | ≥ 30° | aynı |
| Renkler Wada'dan | Hex, `palettes.json` içinde var | %100 | aynı |

## 4. Tipografi

- Yazı tipleri: [Inter](https://rsms.me/inter/) (arayüz ve metin) ve [Fraunces](https://fonts.google.com/specimen/Fraunces) (hikâye başlıkları). İkisi de OFL lisanslıdır ve `next/font` ile yerel olarak sunulur. Türkçe karakterleri (ç, ğ, ı, İ, ö, ş, ü) kapsadıkları testle denetlenir.
- Ölçek: 12 / 14 / 16 / 18 / 24 / 32 / 48 / 72 px. Gövde metni 16 px'tir.
- Sayılar `font-variant-numeric: tabular-nums` ile yazılır. Binlik ayırıcı dile göredir (`tr`: 361.500; `en`: 361,500).

## 5. Yerleşim ve dokunma

- Kırılım noktaları 360, 390, 768, 1024 ve 1440 px'tir. Hiçbirinde yatay taşma olmaz.
- Dokunma hedefi en az 44×44 px, komşu hedefler arası en az 8 px.
- Odak halkası `focus` tokenıyla en az 2 px çizilir ve zemine karşı kontrastı en az 3'tür.

## 6. Hareket

- Hikâye kare dizisi scroll ile ilerler: GSAP ScrollTrigger ile scrub, Lenis ile yumuşak scroll.
- Arayüz geçişleri 150–250 ms sürer.
- `prefers-reduced-motion: reduce` tercihinde kare dizisi yerine bölüm başına tek statik kare gösterilir ve geçişler kapanır.
