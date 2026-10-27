// Form alanlarının ortak Zod parçaları. Boş alan bilinmeyen demektir: null olur, 0 olmaz.
import { z } from "zod";
import { FIBRES, type Composition } from "@/domain/fibre";
import { routing } from "@/i18n/routing";

export const locale = z.enum(routing.locales);
export const blank = z.literal("").transform(() => null);

// Virgüllü ondalık da kabul edilir (Türkçe klavye).
export const decimal = (scale: number) =>
  z
    .string()
    .trim()
    .transform((s) => s.replace(",", "."))
    .pipe(z.string().regex(new RegExp(`^\\d{1,9}(\\.\\d{1,${scale}})?$`)));
export const optionalDecimal = (scale: number) => z.union([blank, decimal(scale)]);

export const FIBRE_FIELDS = FIBRES.filter((f) => f !== "unknown");
const share = z.union([blank, z.coerce.number().int().min(0).max(100)]);
/** c_cotton, c_polyester… alanları; boş bırakılan lif bileşime girmez. */
export const compositionFields = Object.fromEntries(FIBRE_FIELDS.map((f) => [`c_${f}`, share.optional()]));

export function compositionOf(v: Record<string, unknown>): Composition | null {
  const c = Object.fromEntries(FIBRE_FIELDS.flatMap((f) => (typeof v[`c_${f}`] === "number" ? [[f, v[`c_${f}`]]] : []))) as Composition;
  return Object.keys(c).length ? c : null;
}

export const SILK = ["no", "yes", "unknown"] as const;
export const silkOf = (s: (typeof SILK)[number]) => (s === "unknown" ? null : s === "yes");
