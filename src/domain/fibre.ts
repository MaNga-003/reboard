// Lif türleri ve bileşim. Şema (listings, waste_batches) bu tipi kullanır.
export const FIBRES = ["cotton", "polyester", "polycotton", "viscose", "wool", "acrylic", "elastane", "other", "unknown"] as const;
export type Fibre = (typeof FIBRES)[number];

/** Lif bileşimi: lif → yüzde. Toplam en fazla 100; eksik kalan pay "unknown" sayılır. */
export type Composition = Partial<Record<Fibre, number>>;
