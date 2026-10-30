import { qrPath } from "./qr";

/**
 * Sunucuda çizilen QR. Koyu modül ink, zemin beyaz (surface): okuyucular açık zeminde koyu modül bekler
 * (M-26). Yüksek kontrast modunda renkler değiştirilmez; QR ters dönerse okunmaz.
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
      <rect width={size} height={size} className="fill-surface" />
      <path d={d} className="fill-ink" />
    </svg>
  );
}
