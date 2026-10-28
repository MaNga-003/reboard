// Herkese açık etki sayacı (D-013, hikâyenin 8. bölümü). Girişsiz okunur ve kiracı katmanından geçmez: satırlar
// yalnızca burada okunur, dışarı platform geneli toplam ve sınıf çıkar. Kurum, parti kodu ve dönem çıkmaz (D-016).
import { eq } from "drizzle-orm";
import { publicCounter, type PublicCounter } from "../../domain/impact";
import type { Db } from "../client";
import { wasteBatches } from "../schema";

export async function impactCounter(db: Db): Promise<PublicCounter | null> {
  const rows = await db
    .select({ weighedKg: wasteBatches.weighedKg, rejectedKg: wasteBatches.rejectedKg, resultClass: wasteBatches.resultClass })
    .from(wasteBatches)
    .where(eq(wasteBatches.verified, true));
  return publicCounter(rows);
}
