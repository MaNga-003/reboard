// Ürün parametreleri (ekip planı). Reçete seçilmedi: bunlar hedef ölçülerdir, test sonucu değildir.
import { CalcError, Decimal } from "./result";

export const SHEET_MM = { width: 1830, length: 3660 } as const;
/** Bir levha: 1,830 m × 3,660 m = 6,6978 m². */
export const SHEET_AREA_M2 = new Decimal(SHEET_MM.width).times(SHEET_MM.length).div(1_000_000);
export const TARGET_THICKNESS_MM = 18;
export const DENSITY_RANGE_KG_M3 = [550, 750] as const;
/** Bağlayıcı adayları (ekip planı); reçete seçilmedi. */
export const BINDERS = ["pet_copet", "pmdi", "none", "unknown"] as const;
export type Binder = (typeof BINDERS)[number];

/** Levha kütlesi = alan × kalınlık × yoğunluk. */
export function sheetMassKg(densityKgM3: Decimal.Value, thicknessMm: Decimal.Value = TARGET_THICKNESS_MM): Decimal {
  const d = new Decimal(densityKgM3);
  const t = new Decimal(thicknessMm);
  if (!d.isFinite() || !t.isFinite() || d.lte(0) || t.lte(0)) throw new CalcError("invalid_input", `Yoğunluk ve kalınlık pozitif olmalı: ${d}, ${t}`);
  return SHEET_AREA_M2.times(t).div(1000).times(d);
}
