// Herkese açık etki sayacı ucu (D-013). Ana sayfa statik kalır; sayaç hikâyenin sonuna yaklaşınca buradan okunur.
// Yanıt CDN'de kısa süre önbelleklenir: her ziyaret veritabanına gitmez, yeni bir doğrulama en geç bir dakikada görünür.
import { getDb } from "@/db/client";
import { impactCounter } from "@/db/repo/counter";
import type { ResultClass } from "@/domain/result";

export type CounterResponse = { counter: { kg: string | null; unknown: number; batches: number; resultClass: ResultClass } | null };

export async function GET() {
  const c = await impactCounter(getDb());
  const body: CounterResponse = {
    counter: c && { kg: c.verified.kg?.toString() ?? null, unknown: c.verified.unknown, batches: c.batches, resultClass: c.resultClass },
  };
  return Response.json(body, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=600" } });
}
