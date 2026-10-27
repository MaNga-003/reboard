// Lif türleri ve bileşim. Şema (listings, waste_batches) bu tipi kullanır.
export const FIBRES = ["cotton", "polyester", "polycotton", "viscose", "wool", "acrylic", "elastane", "other", "unknown"] as const;
export type Fibre = (typeof FIBRES)[number];

/** Lif bileşimi: lif → yüzde. Toplam en fazla 100; eksik kalan pay "unknown" sayılır. */
export type Composition = Partial<Record<Fibre, number>>;

/** Gösterim sırası: büyükten küçüğe; 100'e tamamlanmayan pay "unknown" olarak eklenir (DATA_DICTIONARY §3). */
export function compositionShares(c: Composition): [Fibre, number][] {
  const known = (Object.entries(c) as [Fibre, number][]).filter(([f, v]) => f !== "unknown" && v > 0);
  const rest = 100 - known.reduce((a, [, v]) => a + v, 0);
  const out = known.sort((a, b) => b[1] - a[1]);
  return rest > 0 ? [...out, ["unknown", rest]] : out;
}
