// Tedarik sürekliliği göstergeleri (DATA_DICTIONARY §5). T2.1 güvenilirliği kullanır; panel göstergeleri T2.3'te genişler.
import { Decimal } from "./result";

export type DeliveryState = { plannedAt: Date; deliveredAt: Date | null; status: "planned" | "delivered" | "cancelled" };

/** Zamanında sayılma payı: planlanandan en çok 1 gün sonra. */
export const ON_TIME_GRACE_MS = 86_400_000;

/**
 * Zamanında teslim oranı. Payda: vadesi gelmiş teslimler (teslim edilen, iptal edilen ya da süresi geçip gelmeyen).
 * İptal ve gecikme zamanında sayılmaz. Vadesi gelmemiş planlar hesaba girmez; hiç vade yoksa oran bilinmiyor (null).
 */
export function onTimeRate(deliveries: readonly DeliveryState[], now: Date): { rate: Decimal | null; due: number; onTime: number } {
  let due = 0;
  let onTime = 0;
  for (const d of deliveries) {
    const deadline = d.plannedAt.getTime() + ON_TIME_GRACE_MS;
    if (d.status === "planned" && deadline >= now.getTime()) continue;
    due++;
    if (d.status === "delivered" && d.deliveredAt && d.deliveredAt.getTime() <= deadline) onTime++;
  }
  return { rate: due === 0 ? null : new Decimal(onTime).div(due), due, onTime };
}
