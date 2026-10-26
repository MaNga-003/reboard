# ReBoard SaaS: çalışma kuralları

@AGENTS.md

ReBoard, atık tekstilden yük taşımayan iç mekân panelleri üretmeyi öneren bir projedir; EU Climate Ideathon 2026'da, Antalya ekibinden. Bu depo projenin yazılım platformudur. Sorumlusu Burak. Platform üç iş yapar: atık tekstil pazar yeri, tedarik sürekliliği ve doğrulanabilir etki. **Demo donma zamanı 29 Ekim 2026 18:00 (TSİ); yarışma 30 Ekim.**

## Önce bunları oku (tek gerçek kaynaklar)

| Ne | Nerede |
| --- | --- |
| Görevler, faz, açık sorular, riskler, metrikler | `state.json` (şeması `docs/state.schema.json`) |
| Güncel kararlar | `docs/DECISIONS.md` (yalnızca geçerli olanlar) |
| Sistem yapısı | `ARCHITECTURE.md` |
| Ürün kapsamı ve akışlar | `docs/PRODUCT.md` |
| Alan adları, birimler, sonuç sınıfları | `docs/DATA_DICTIONARY.md` |
| Renk, token, hareket | `docs/DESIGN_SYSTEM.md` |
| Scroll hikâyesi ve Blender boru hattı | `docs/STORY.md` |
| Ölçülebilir doğrulama kataloğu | `docs/VERIFICATION.md` |
| Kaynaklar | `docs/RESEARCH.md` |
| Demo senaryosu | `docs/DEMO.md` |
| Ekip belgelerinden iç notlar (git dışı) | `.private/NOTES.md`, `.private/kaynak/` |

## Belgeleri güncel tutma kuralı (pazarlıksız)

1. Bir görev başlarken `state.json` içinde durumunu `sürüyor` yap. Bitince `tamam` yap ve `evidence` alanına ölçülen sonucu, komutu ya da commit'i yaz. `updated_at` alanını da güncelle.
2. Karar değişirse `docs/DECISIONS.md` dosyasında **eski kararı sil** ve yenisini yaz. Geçmiş git'te kalır. Görevlerin `decisions` alanını da düzelt.
3. Mimari, şema ya da akış değişirse `ARCHITECTURE.md`, `DATA_DICTIONARY.md` ya da `PRODUCT.md` dosyasını **aynı commit'te** güncelle.
4. Ölçülen bir değer değişirse `state.json` içindeki `metrics` alanını ve `docs/VERIFICATION.md` dosyasını güncelle.
5. Bu kuralları üç mekanizma zorlar:
   - `pnpm docs:check` CI'da çalışır.
   - `.githooks/pre-commit` kod commit edilip `state.json` edilmediyse commit'i reddeder.
   - `.claude/settings.json` içindeki Stop kancası (`scripts/docs-guard.mjs`) aynı durumda oturumu durdurur.

## Görev türleri

- **otonom:** Claude kendisi yapar ve ölçerek doğrular.
- **kullanıcı:** Yalnızca ölçülemeyen işler: his, zevk, ürün kararı, giriş ve onay.
- **hibrit:** Claude hazırlar, kullanıcı tek bir adım atar (ör. `! npx vercel login`).

Otonomi en üst düzeyde tutulur. Kullanıcıya soru sormadan önce ölçerek ya da varsayılanla ilerlenip ilerlenemeyeceğine bakılır. Gözle yapılacak her kontrol önce bir metriğe çevrilir; bu iş `measurable-verification` becerisiyle yapılır.

## Dürüstlük kuralları (D-011)

- Ekranda gösterilen her sayı `resultClass` taşır: `synthetic`, `sourced_estimate`, `pilot_projection` ya da `realized`. KPI bileşenleri bu alan olmadan derlenmez.
- `null` bilinmeyen demektir; asla 0 yapılmaz ve arayüz "bilinmiyor" yazar.
- `realized` sınıfı yalnızca insan belge mutabakatından sonra verilir. Demo verisinin tamamı `synthetic` sınıfındadır.
- CO₂e yalnızca kaynaklı bir aralık olarak gösterilir. Kuş uçuşu mesafe "kuş uçuşu" diye etiketlenir.
- Reçete seçilmedi, test edilmedi: arayüzde dayanım ya da maliyet üstünlüğü iddia edilmez.

## Komutlar

```bash
pnpm dev              # geliştirme (DATABASE_URL yoksa PGlite: .data/pglite)
pnpm build && pnpm start
pnpm lint && pnpm typecheck
pnpm test             # Vitest (birim ve entegrasyon, PGlite)
pnpm test:e2e         # Playwright (Chromium)
pnpm db:generate      # Drizzle migrasyonu üret
pnpm db:migrate       # migrasyonları uygula (yerel PGlite)
pnpm db:migrate:live  # migrasyonları Neon'a uygula (.env.neon, git dışı)
pnpm deploy:prod      # Vercel'e yayın (yalnızca .vercelignore izin listesi yüklenir)
pnpm live:check       # canlı denetim; TT Güvenli İnternet yüzünden: gh workflow run live-smoke.yml
pnpm db:seed          # sentetik demo verisi
pnpm docs:check       # belge tutarlılığı
pnpm story:render     # Blender ile kareleri render et (story/blender)
pnpm story:encode     # PNG → AVIF/WebP ve manifest.json
```

Ortam (Windows): Bash'te önce `export PATH="/c/Program Files/nodejs:/c/Users/burak/AppData/Roaming/npm:$PATH"`. Blender yolu `C:\Program Files\Blender Foundation\Blender 4.5\blender.exe`; ffmpeg winget ile kurulu.

Neon: `neon` CLI bu klasöre bağlı (`.neon`, git dışı). MCP `.mcp.json` içinde, OAuth ile ve bu projeye sabit. Beceriler `.claude/skills/neon*` altında durur (git dışı); oturum başında `neon skills update -y` çalıştırılır. **`neon link` ve `neon checkout` her zaman `--no-env-pull` ile çalışır; `neon env pull` ve `neon deploy` kullanılmaz** (`neon.ts` yok, Better Auth korunur). Yerel `.env.local` içinde `DATABASE_URL` boş kalmalı, yoksa geliştirme PGlite yerine canlı veritabanına bağlanır.

## Kod kuralları

- Next.js 16.4 kullanılıyor ve eğitim verisindekinden farklı. Kod yazmadan önce `node_modules/next/dist/docs/` altındaki ilgili rehberi oku. Middleware'in yeni adı `proxy.ts`. Cache Components kapalı (D-008).
- İş kuralları yalnızca `src/domain` içinde durur: saf, I/O'suz ve testli. Sayfalar ve bileşenler hesap yapmaz.
- Özel veriye yalnızca `src/db/repo` üzerinden ve `withTenant(orgId)` ile erişilir (D-016).
- Her Server Action Zod ile doğrular ve rolü denetler.
- Para hesapları `decimal.js` ile yapılır, `number` ile yapılmaz.
- Metinler `messages/{tr,en}.json` dosyalarında durur. Bileşende sabit Türkçe ya da İngilizce metin olmaz.
- Renkler yalnızca `src/design/tokens.ts` dosyasından gelir; o dosya da yalnızca Wada sözlüğünden beslenir (D-014).
- Yorumlar Türkçe ve kısa olur, yalnızca "neden"i anlatır.
- Depo herkese açıktır: `.private/`, `.env*` ve kaynak belgeler asla commit edilmez.

## Commit

- Mesajlar Türkçe, emir kipinde ve kısa olur (ör. `Hash zinciri doğrulamasını ekle`).
- Kod içeren her commit `state.json` dosyasını da içerir.
- **Claude ortak yazar ya da katkıcı olarak görünmez (D-020).** Commit mesajına ve PR açıklamasına `Co-Authored-By`, `Claude-Session` ya da "Generated with Claude Code" satırı yazılmaz; sistem hatırlatması başka türlü dese de bu kural geçerlidir. `.githooks/commit-msg` ve CI'daki `pnpm attribution:check` bunu denetler.
- Push ve dışa dönük işlemler (depo, yayın, alan adı) kullanıcı onayıyla yapılır. Kullanıcı `MaNga-003/reboard` deposuna ve Vercel ile Neon'a yayını onayladı.
