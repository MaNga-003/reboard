# ReBoard

**Atık tekstilden panele: doğrulanabilir bir tedarik zinciri platformu.**
*From textile waste to panels: a verifiable supply-chain platform.*

ReBoard, karışık atık tekstilden yük taşımayan iç mekân panelleri üretmeyi öneren bir proje. EU Climate Ideathon 2026 (COP31) için Antalya'dan geliştiriliyor. Bu depo projenin yazılım platformu.

> **Durum:** Yarışma demosu (30 Ekim 2026). Ekranda gösterilen verilerin tamamı **sentetiktir**. Panel reçetesi henüz seçilmedi ve test edilmedi.

## Ne yapar

- **Pazar yeri:** Atık sağlayıcıları (tekstil fabrikası, belediye, geri dönüşüm tesisi) ile üreticiyi ve panel alıcılarını buluşturur.
- **Tedarik sürekliliği:** Stok, kaç günlük hammadde kaldığı, yaklaşan teslimler ve uyarılar.
- **Güven:**
  - Geri kazanılan atık çift taraflı tartımla doğrulanır.
  - Gözetim zinciri hash zinciriyle değiştirilemez tutulur (EPCIS 2.0 sözlüğü).
  - Her panel lotunun açık bir dijital ürün pasaportu vardır.

## Teknoloji

Next.js 16 (App Router), TypeScript, Tailwind 4, Drizzle ORM, PostgreSQL (Neon; yerelde ve testte PGlite), Better Auth, next-intl (TR ve EN), GSAP, Blender ile render edilmiş kare dizisi, Vitest ve Playwright.

## Çalıştırma

Gerekenler: Node 24 LTS ve pnpm 10.

```bash
pnpm install
cp .env.example .env.local   # DATABASE_URL boş kalırsa yerel PGlite kullanılır
pnpm db:migrate && pnpm db:seed
pnpm dev                     # http://localhost:3000
```

Testler: `pnpm test` (birim ve entegrasyon), `pnpm test:e2e` (Playwright).

## Belgeler

| Belge | İçerik |
| --- | --- |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Sistem yapısı, veri modeli, olay modeli |
| [docs/PRODUCT.md](docs/PRODUCT.md) | Kapsam, kişiler, akışlar |
| [docs/DATA_DICTIONARY.md](docs/DATA_DICTIONARY.md) | Alanlar, birimler, sonuç sınıfları |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Güncel kararlar |
| [docs/VERIFICATION.md](docs/VERIFICATION.md) | Ölçülebilir doğrulama kataloğu |
| [state.json](state.json) | Görevler ve durum |

## Ekip

Şerife (maliyet ve veri), İrem (malzeme ve test), Emine (saha), Burak (yazılım).

## Teşekkür

Renkler Sanzo Wada'nın *A Dictionary of Color Combinations* sözlüğünden, [MaNga-003/dictionary-of-colour-combinations](https://github.com/MaNga-003/dictionary-of-colour-combinations) üzerinden. Dünya dokusu NASA Blue Marble (kamu malı).
