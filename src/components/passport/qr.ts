// QR modül matrisi → tek SVG yolu. Saf: birim testi yolu piksele çevirip gerçek bir çözücüyle okur (M-26).
import QRCode from "qrcode";

/** ISO/IEC 18004'ün istediği sessiz bölge: her yanda 4 modül. */
export const QUIET = 4;

export type QrPath = { /** sessiz bölge dahil kenar, modül */ size: number; d: string; version: number };

/** M düzeyi hata düzeltme: kare bir leke sembolün %8'ini silse de okunur (L'de %6'da yarısı okunmaz); sürüm iki adım büyür. */
export function qrPath(text: string): QrPath {
  const { modules, version } = QRCode.create(text, { errorCorrectionLevel: "M" });
  const n = modules.size;
  let d = "";
  // Yatay koşular tek dikdörtgen olur: yol kısalır, komşu modüller arasında kenar yumuşatma çizgisi kalmaz.
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; ) {
      if (!modules.data[y * n + x]) {
        x++;
        continue;
      }
      let len = 1;
      while (x + len < n && modules.data[y * n + x + len]) len++;
      d += `M${x + QUIET} ${y + QUIET}h${len}v1h-${len}z`;
      x += len;
    }
  }
  return { size: n + 2 * QUIET, d, version };
}
