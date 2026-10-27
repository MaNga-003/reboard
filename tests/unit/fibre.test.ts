import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { FIBRES, compositionShares, type Composition } from "@/domain/fibre";

describe("bileşim payları", () => {
  it("büyükten küçüğe sıralar; 100'e tamamlanmayan pay bilinmiyor olarak sona eklenir", () => {
    expect(compositionShares({ polyester: 30, cotton: 50 })).toEqual([
      ["cotton", 50],
      ["polyester", 30],
      ["unknown", 20],
    ]);
  });

  it("toplam 100 ise bilinmiyor eklenmez; sıfır pay ve elle yazılmış bilinmiyor yok sayılır", () => {
    expect(compositionShares({ cotton: 100, wool: 0, unknown: 40 })).toEqual([["cotton", 100]]);
  });

  it("boş bileşim tamamen bilinmiyor", () => {
    expect(compositionShares({})).toEqual([["unknown", 100]]);
  });

  it("özellik: toplam 100, bilinen paylar azalan, bilinmiyor yalnızca sonda", () => {
    const known = FIBRES.filter((f) => f !== "unknown");
    const arb = fc
      .array(fc.tuple(fc.constantFrom(...known), fc.integer({ min: 0, max: 100 })), { maxLength: known.length })
      .map((pairs) => Object.fromEntries(pairs) as Composition)
      .filter((c) => Object.values(c).reduce((a, v) => a + (v ?? 0), 0) <= 100);
    fc.assert(
      fc.property(arb, (c) => {
        const out = compositionShares(c);
        expect(out.reduce((a, [, v]) => a + v, 0)).toBe(100);
        const body = out.filter(([f]) => f !== "unknown");
        expect(body.every(([, v], i) => i === 0 || body[i - 1][1] >= v)).toBe(true);
        expect(out.findIndex(([f]) => f === "unknown")).toBe(body.length === out.length ? -1 : out.length - 1);
      }),
    );
  });
});
