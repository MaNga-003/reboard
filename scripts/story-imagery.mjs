#!/usr/bin/env node
// 8. bölümün yer dokuları: evin noktası çevresinde iç içe uydu görüntüsü yamaları ve küre için küresel mozaik.
// story/cache/imagery/ altına JPEG'ler ve manifest.json yazar (git dışı); indirmeler kendi klasöründe önbelleklenir.
// Kullanım: node scripts/story-imagery.mjs
//
// Kaynak (lisans kaydı docs/RESEARCH.md §4): EOX Sentinel-2 cloudless 2016 (`s2cloudless`, WGS84 karoları),
// CC BY 4.0. Künye: "EOxCloudless https://cloudless.eox.at by EOX IT Services GmbH (Contains modified Copernicus
// Sentinel data 2016)". Bütün düzeyler aynı mozaikten küçültüldüğü için tonları tutarlıdır: kamera mahalleden
// küreye çıkarken kaynak değişmez, geçiş yalnızca çözünürlükte olur.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";

const ROOT = resolve(import.meta.dirname, "..");
const CACHE = resolve(ROOT, "story/cache");
const OUT = resolve(CACHE, "imagery");
const EOX_DIR = resolve(CACHE, "dl-eox");
const EOX_URL = "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless/default/WGS84";

// Evin yeri: Aksu, Kundu'nun kuzeyindeki tarlalar (kurgusal mahalle buraya oturur; kıyı ~4 km güneyde).
export const HOME = { lon: 30.89, lat: 36.891 };
// Her düzey bir öncekinin iki katı çözünürlükte. Bir düzey kendi çözünürlüğünün 1:1 ile 2 kat büyütme arasındaki
// kadrajlarda birincildir; 2560 px'lik yama 1920 px'lik kadrajı iki en-boy oranında da payla örter. z5 yaması daha
// geniştir (84°): küre kadraja sığana kadar (genişlik ~6000 km) kadrajın tamamını örter.
const LEVELS = [5, 6, 7, 8, 9, 10, 11, 12, 13];
const PATCH = { 5: 3840 };
const PATCH_DEFAULT = 2560;
const GLOBAL_Z = 4; // küre: 8192 × 4096 (son karede kürenin çapı ~900 px; 4× fazla örnek)

mkdirSync(OUT, { recursive: true });
mkdirSync(EOX_DIR, { recursive: true });

async function download(url, file) {
  if (existsSync(file)) return;
  for (let k = 0; ; k++) {
    const r = await fetch(url);
    if (r.ok) return writeFileSync(file, Buffer.from(await r.arrayBuffer()));
    if (k > 3) throw new Error(`${url}: ${r.status}`);
    await new Promise((s) => setTimeout(s, 1000 * (k + 1)));
  }
}

// WGS84 karo ızgarası: z düzeyinde 2^(z+1) × 2^z karo, 256 px, sol üst köşe (−180°, 90°).
async function mosaic(z, tx0, tx1, ty0, ty1) {
  const tiles = [];
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) tiles.push([tx, ty]);
  for (let i = 0; i < tiles.length; i += 8)
    await Promise.all(tiles.slice(i, i + 8).map(([tx, ty]) => download(`${EOX_URL}/${z}/${ty}/${tx}.jpg`, `${EOX_DIR}/${z}_${ty}_${tx}.jpg`)));
  const W = (tx1 - tx0 + 1) * 256, H = (ty1 - ty0 + 1) * 256;
  const parts = tiles.map(([tx, ty]) => ({ input: `${EOX_DIR}/${z}_${ty}_${tx}.jpg`, left: (tx - tx0) * 256, top: (ty - ty0) * 256 }));
  return sharp({ create: { width: W, height: H, channels: 3, background: "#000" }, limitInputPixels: false })
    .composite(parts).png().toBuffer();
}

async function patch(z) {
  const size = PATCH[z] ?? PATCH_DEFAULT;
  const dpp = 0.703125 / 2 ** z;
  const cx = Math.round((HOME.lon + 180) / dpp), cy = Math.round((90 - HOME.lat) / dpp);
  const X0 = cx - size / 2, Y0 = cy - size / 2;
  if (Y0 < 0) throw new Error(`z${z}: yama kuzey kutbunu aşıyor`);
  const tx0 = Math.floor(X0 / 256), ty0 = Math.floor(Y0 / 256);
  const full = await mosaic(z, tx0, Math.floor((X0 + size - 1) / 256), ty0, Math.floor((Y0 + size - 1) / 256));
  // composite çıktısı alfa kanalı taşır; ham tampon 3 kanal varsayılarak okunduğu için atılır.
  const raw = await sharp(full, { limitInputPixels: false })
    .extract({ left: X0 - tx0 * 256, top: Y0 - ty0 * 256, width: size, height: size }).removeAlpha().raw().toBuffer();
  if (raw.length !== size * size * 3) throw new Error(`z${z}: ${raw.length} bayt`);
  const file = `eox_z${z}.jpg`;
  await sharp(raw, { raw: { width: size, height: size, channels: 3 } }).jpeg({ quality: 92 }).toFile(`${OUT}/${file}`);
  return { name: `eox_z${z}`, file, lon0: X0 * dpp - 180, lon1: (X0 + size) * dpp - 180, lat1: 90 - Y0 * dpp, lat0: 90 - (Y0 + size) * dpp };
}

const layers = [];
const full = await mosaic(GLOBAL_Z, 0, 2 ** (GLOBAL_Z + 1) - 1, 0, 2 ** GLOBAL_Z - 1);
await sharp(full, { limitInputPixels: false }).removeAlpha().jpeg({ quality: 92 }).toFile(`${OUT}/eox_global.jpg`);
layers.push({ name: "eox_global", file: "eox_global.jpg", lon0: -180, lon1: 180, lat0: -90, lat1: 90 });
console.log(`EOX z${GLOBAL_Z}: küresel`);
for (const z of LEVELS) {
  const p = await patch(z);
  layers.push(p);
  console.log(`EOX z${z}: ${p.lon0.toFixed(4)}…${p.lon1.toFixed(4)} E, ${p.lat0.toFixed(4)}…${p.lat1.toFixed(4)} N`);
}

writeFileSync(`${OUT}/manifest.json`, JSON.stringify({ home: HOME, layers }, null, 2));
console.log(`${layers.length} katman → ${OUT}`);
