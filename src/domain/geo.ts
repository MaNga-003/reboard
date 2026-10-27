// Konum ve mesafe. Yalnızca kuş uçuşu hesaplanır (D-011); yol mesafesi iddia edilmez.
import { CalcError, Decimal } from "./result";

export type Point = { lat: number; lon: number };

const EARTH_RADIUS_KM = 6371.0088;
const rad = (d: number) => (d * Math.PI) / 180;

function check(p: Point) {
  if (!Number.isFinite(p.lat) || !Number.isFinite(p.lon) || Math.abs(p.lat) > 90 || Math.abs(p.lon) > 180) {
    throw new CalcError("invalid_input", `Geçersiz konum: ${p.lat}, ${p.lon}`);
  }
}

/** Haversine; 0,1 km'ye yuvarlanır. Arayüz bu değeri hep "kuş uçuşu" etiketiyle gösterir. */
export function crowFliesKm(a: Point, b: Point): Decimal {
  check(a);
  check(b);
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2;
  return new Decimal(2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)))).toDecimalPlaces(1);
}

/** Açık adres tutulmaz: 2 ondalık enlemde ≈1,1 km çözünürlük verir. */
export const roundCoord = (p: Point): Point => {
  check(p);
  return { lat: Math.round(p.lat * 100) / 100, lon: Math.round(p.lon * 100) / 100 };
};
