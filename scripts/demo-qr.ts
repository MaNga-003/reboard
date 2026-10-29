// Sunum ve etiket QR'ı (T4.3, D-025, D-030). Satılan lotun etiket çapası veritabanından, pasaport sayfasıyla aynı kod
// yoluyla (publicPassport) okunur; çapayla doğrulama geçmezse dosya yazılmaz. Adres tr ve en için kurulur, SVG ve PNG
// olarak .private/demo/ altına yazılır (depo dışı); PNG gerçek bir çözücüyle geri okunur. Çapayı üreten seed günü de
// bulunur: DEMO_NOW=<o gün> ile yeniden yükleme aynı çapayı verir, basılı QR geçerli kalır.
// Kullanım: pnpm demo:qr [taban adres]   (Neon: .env.neon; taban adres varsayılanı canlı adres)
import { mkdirSync, writeFileSync } from "node:fs";
import { asc, eq } from "drizzle-orm";
import jsQR from "jsqr";
import sharp from "sharp";
import { qrPath } from "../src/components/passport/qr";
import { createDb } from "../src/db/client";
import { publicPassport } from "../src/db/repo/passport";
import { panelLots } from "../src/db/schema";
import { buildDemo } from "../src/db/seed/demo";
import { formatAnchor } from "../src/domain/traceability";

const BASE = (process.argv[2] ?? "https://reboard-lovat.vercel.app").replace(/\/$/, "");
const OUT = ".private/demo";
// Baskıda modül başına en az 0,5 mm kalsın: 41 modüllük sembol 24 px'te ~1000 px, 300 dpi'da ~8,5 cm.
const MODULE_PX = 24;
const DAY_MS = 86_400_000;

/** Siyah modül, beyaz zemin, 4 modül sessiz bölge: sayfadaki QR'ın aynı yolu, baskı renkleriyle. */
function svgOf(text: string) {
  const q = qrPath(text);
  const px = q.size * MODULE_PX;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${q.size} ${q.size}" width="${px}" height="${px}" shape-rendering="crispEdges"><rect width="${q.size}" height="${q.size}" fill="#fff"/><path d="${q.d}" fill="#000"/></svg>\n`;
}

async function decode(png: Buffer) {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return jsQR(new Uint8ClampedArray(data.buffer, data.byteOffset, data.length), info.width, info.height)?.data ?? null;
}

/** Çapadaki olayı üreten seed günü: zincir yalnızca seed'in UTC gününe bağlıdır (seed.test.ts). Son 60 gün taranır. */
function seedDay(head: string) {
  const today = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate());
  for (let k = 0; k <= 60; k++) {
    const day = new Date(today - k * DAY_MS + DAY_MS / 2);
    if (buildDemo(day).custodyEvents.some((e) => e.hash === head)) return day.toISOString().slice(0, 10);
  }
  return null;
}

async function main() {
  const db = createDb();
  const [lot] = await db.select({ code: panelLots.code }).from(panelLots).where(eq(panelLots.isPublic, true)).orderBy(asc(panelLots.code)).limit(1);
  if (!lot) throw new Error("açık lot yok: önce seed yüklenmeli");
  const view = await publicPassport(db, lot.code);
  if (!view?.anchor) throw new Error(`${lot.code}: etiket çapası yok`);
  const anchor = formatAnchor(view.anchor);
  const checked = await publicPassport(db, lot.code, view.anchor);
  if (!checked?.ok || !checked.anchorChecked) throw new Error(`${lot.code}: çapayla doğrulama geçmedi; QR yazılmadı`);

  mkdirSync(OUT, { recursive: true });
  const urls: Record<string, string> = {};
  for (const locale of ["tr", "en"]) {
    const url = `${BASE}/${locale}/pasaport/${lot.code}?a=${anchor}`;
    const svg = svgOf(url);
    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    const read = await decode(png);
    if (read !== url) throw new Error(`${locale}: PNG geri okunamadı (${read})`);
    writeFileSync(`${OUT}/qr-${locale}.svg`, svg);
    writeFileSync(`${OUT}/qr-${locale}.png`, png);
    urls[locale] = url;
  }
  const day = seedDay(view.anchor.head);
  const info = { lot: lot.code, anchor, seedDay: day, urls, chains: checked.chains.map((c) => `${c.role}:${c.verdict.ok ? "ok" : "bozuk"}`), writtenAt: new Date().toISOString() };
  writeFileSync(`${OUT}/qr.json`, `${JSON.stringify(info, null, 2)}\n`);
  console.log(`${lot.code} çapa ${anchor.slice(0, 18)}…; zincirler ${info.chains.join(", ")}`);
  console.log(`QR: ${OUT}/qr-{tr,en}.{svg,png} (PNG geri okundu)`);
  console.log(day ? `Seed günü ${day}: sıfırlama gerekirse DEMO_NOW=${day} ile yüklenirse bu QR geçerli kalır.` : "Seed günü son 60 günde bulunamadı.");
  const c = (db as unknown as { $client: { end?: () => Promise<void>; close?: () => Promise<void> } }).$client;
  await (c.end ?? c.close)?.call(c);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
