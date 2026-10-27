import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { crowFliesKm, roundCoord } from "@/domain/geo";
import { CalcError } from "@/domain/result";

describe("kuş uçuşu mesafe", () => {
  it("bilinen bir çifti 0,5 km içinde verir", () => {
    // Antalya (36,8969; 30,7133) – Ankara (39,9334; 32,8597): yaklaşık 386 km (haversine, ortalama yarıçap).
    expect(crowFliesKm({ lat: 36.8969, lon: 30.7133 }, { lat: 39.9334, lon: 32.8597 }).toNumber()).toBeCloseTo(386.2, 0);
  });

  it("aynı nokta 0, simetrik ve üçgen eşitsizliğine uyar", () => {
    const pt = fc.record({ lat: fc.double({ min: -89, max: 89, noNaN: true }), lon: fc.double({ min: -179, max: 179, noNaN: true }) });
    fc.assert(
      fc.property(pt, pt, pt, (a, b, c) => {
        expect(crowFliesKm(a, a).toNumber()).toBe(0);
        expect(crowFliesKm(a, b).toNumber()).toBe(crowFliesKm(b, a).toNumber());
        // Yuvarlama payı: üç değer de 0,05 km'ye kadar yuvarlanmış olabilir.
        expect(crowFliesKm(a, c).toNumber()).toBeLessThanOrEqual(crowFliesKm(a, b).plus(crowFliesKm(b, c)).toNumber() + 0.15);
      }),
    );
  });

  it("geçersiz konumu reddeder", () => {
    expect(() => crowFliesKm({ lat: 91, lon: 0 }, { lat: 0, lon: 0 })).toThrow(CalcError);
    expect(() => crowFliesKm({ lat: 0, lon: Number.NaN }, { lat: 0, lon: 0 })).toThrow(CalcError);
    expect(() => roundCoord({ lat: 0, lon: 181 })).toThrow(CalcError);
  });

  it("konum ≈1 km'ye yuvarlanır", () => {
    expect(roundCoord({ lat: 36.91234, lon: 30.65678 })).toEqual({ lat: 36.91, lon: 30.66 });
  });
});
