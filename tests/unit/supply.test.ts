import { describe, expect, it } from "vitest";
import { ON_TIME_GRACE_MS, onTimeRate } from "@/domain/supply";

const now = new Date("2026-10-27T12:00:00Z");
const at = (h: number) => new Date(now.getTime() + h * 3600_000);

describe("zamanında teslim oranı", () => {
  it("1 gün pay içinde gelen zamanında; geç gelen, iptal ve süresi geçen gelmeyen zamanında değil", () => {
    const r = onTimeRate(
      [
        { plannedAt: at(-100), deliveredAt: at(-100 + 24), status: "delivered" }, // tam sınırda: zamanında
        { plannedAt: at(-100), deliveredAt: at(-100 + 25), status: "delivered" }, // geç
        { plannedAt: at(-60), deliveredAt: null, status: "cancelled" },
        { plannedAt: at(-30), deliveredAt: null, status: "planned" }, // vadesi geçti, gelmedi
        { plannedAt: at(-10), deliveredAt: null, status: "planned" }, // pay süresi bitmedi: hesaba girmez
        { plannedAt: at(48), deliveredAt: at(-1), status: "delivered" }, // erken teslim: zamanında
      ],
      now,
    );
    expect(r).toMatchObject({ due: 5, onTime: 2 });
    expect(r.rate!.toString()).toBe("0.4");
    expect(ON_TIME_GRACE_MS).toBe(86_400_000);
  });

  it("vadesi gelmiş teslim yoksa oran bilinmiyor", () => {
    expect(onTimeRate([], now).rate).toBeNull();
    expect(onTimeRate([{ plannedAt: at(5), deliveredAt: null, status: "planned" }], now).rate).toBeNull();
  });
});
