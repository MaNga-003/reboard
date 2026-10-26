// M-7: |Σgirdi − çıktı − fire − nem kaybı| ÷ Σgirdi ≤ %2; aşılırsa açıklama zorunlu.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { CalcError, Decimal } from "@/domain/result";
import { balanceNoteMissing, DEFAULT_TOLERANCE, massBalance } from "@/domain/traceability";

const g = fc.integer({ min: 0, max: 5_000_000 }).map((x) => new Decimal(x).div(1000)); // gram hassasiyetinde kg

describe("massBalance", () => {
  it("örnek: 1.000 kg girdi, 990 kg hesaplanan → fark 10 kg, %1, tolerans içinde", () => {
    const mb = massBalance({ inputsKg: [600, 400], outputKg: 900, scrapKg: 70, moistureLossKg: 20 });
    expect(mb.diffKg!.toString()).toBe("10");
    expect(mb.diffRatio!.toString()).toBe("0.01");
    expect(mb.withinTolerance).toBe(true);
    expect(mb.noteRequired).toBe(false);
  });

  it("sınır: fark tam %2 ise tolerans içindedir; %2,1 ise açıklama zorunlu", () => {
    expect(massBalance({ inputsKg: [1000], outputKg: 980, scrapKg: 0, moistureLossKg: 0 }).withinTolerance).toBe(true);
    const over = massBalance({ inputsKg: [1000], outputKg: 979, scrapKg: 0, moistureLossKg: 0 });
    expect(over.withinTolerance).toBe(false);
    expect(over.noteRequired).toBe(true);
  });

  it("girdiden fazla çıktı da aynı biçimde yakalanır (negatif fark)", () => {
    const mb = massBalance({ inputsKg: [1000], outputKg: 1050, scrapKg: 0, moistureLossKg: 0 });
    expect(mb.diffKg!.toString()).toBe("-50");
    expect(mb.noteRequired).toBe(true);
  });

  it("açıklama boş ya da yalnız boşluksa kayıt reddedilir", () => {
    const over = massBalance({ inputsKg: [1000], outputKg: 900, scrapKg: 0, moistureLossKg: 0 });
    expect(balanceNoteMissing(over, null)).toBe(true);
    expect(balanceNoteMissing(over, "   ")).toBe(true);
    expect(balanceNoteMissing(over, "Nem ölçümü eksik, tartım tekrarlanacak")).toBe(false);
    expect(balanceNoteMissing(massBalance({ inputsKg: [1000], outputKg: 1000, scrapKg: 0, moistureLossKg: 0 }), null)).toBe(false);
  });

  it("bir değer bilinmiyorsa denge iddia edilmez (null); açıklama da istenmez", () => {
    for (const mb of [
      massBalance({ inputsKg: [1000, null], outputKg: 900, scrapKg: 0, moistureLossKg: 0 }),
      massBalance({ inputsKg: [1000], outputKg: null, scrapKg: 0, moistureLossKg: 0 }),
      massBalance({ inputsKg: [], outputKg: 0, scrapKg: 0, moistureLossKg: 0 }),
    ]) {
      expect(mb.withinTolerance).toBeNull();
      expect(mb.noteRequired).toBe(false);
    }
  });

  it("negatif kg reddedilir", () => {
    expect(() => massBalance({ inputsKg: [-1], outputKg: 0, scrapKg: 0, moistureLossKg: 0 })).toThrow(CalcError);
    expect(() => massBalance({ inputsKg: [1], outputKg: 0, scrapKg: -0.001, moistureLossKg: 0 })).toThrow(/fire/);
  });

  it("tolerans kararı tanımla aynıdır: |fark| ≤ 0,02 × girdi", () => {
    fc.assert(
      fc.property(fc.array(g, { minLength: 1, maxLength: 6 }), g, g, g, (ins, out, scrap, moist) => {
        const mb = massBalance({ inputsKg: ins, outputKg: out, scrapKg: scrap, moistureLossKg: moist });
        const input = ins.reduce((a, b) => a.plus(b), new Decimal(0));
        const diff = input.minus(out).minus(scrap).minus(moist);
        expect(mb.diffKg!.eq(diff)).toBe(true);
        if (input.isZero()) expect(mb.withinTolerance).toBeNull();
        else expect(mb.withinTolerance).toBe(diff.abs().lte(input.times(DEFAULT_TOLERANCE)));
      }),
    );
  });
});
