import { qrPath } from "./qr";

/**
 * Sunucuda çizilen QR. Koyu modül metin rengi, zemin sayfa zemini: okuyucular açık zeminde koyu modül bekler
 * ve sembol kontrastı 0,81 (WCAG 11,46:1; M-26). Yüksek kontrast modunda renkler değiştirilmez; QR ters dönerse okunmaz.
 */
export function QrCode({ text, label }: { text: string; label: string }) {
  const { size, d, version } = qrPath(text);
  return (
    <svg
      role="img"
      aria-label={label}
      data-qr={text}
      data-qr-version={version}
      data-qr-size={size}
      viewBox={`0 0 ${size} ${size}`}
      shapeRendering="crispEdges"
      className="block aspect-square w-full max-w-60 forced-color-adjust-none"
    >
      <rect width={size} height={size} className="fill-bg" />
      <path d={d} className="fill-fg" />
    </svg>
  );
}
