// Hesap çekirdeğinin değişmez kuralları, fast-check ile rastgele girdilerde (M-5).
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { divide, factoryGain, panelCustomerGain, priceCorridor, quantity, reboardOperatingResult, sumMoney, type MoneyContext } from "@/domain/calc";
import { CalcError, Decimal, RESULT_CLASSES, weakestClass, type MoneyLine, type QuantityLine, type ResultClass } from "@/domain/result";

const ctx: MoneyContext = { currency: "TRY", taxBasis: "excl_vat", period: "2026-10" };

// Tutarlar kuruş cinsinden tamsayı üretilir, Decimal'e 100'e bölünerek çevrilir: kayan nokta hatası testi bulandırmaz.
const amount = fc.integer({ min: -10_000_000_00, max: 10_000_000_00 }).map((k) => new Decimal(k).div(100));
const resultClass = fc.constantFrom(...RESULT_CLASSES);
const moneyLine = fc.record({
  ref: fc.string({ minLength: 1, maxLength: 8 }),
  amount,
  currency: fc.constant(ctx.currency),
  taxBasis: fc.constant(ctx.taxBasis),
  period: fc.constant(ctx.period),
  resultClass,
}) satisfies fc.Arbitrary<MoneyLine>;
const lines = fc.array(moneyLine, { maxLength: 12 });
const nonEmptyLines = fc.array(moneyLine, { minLength: 1, maxLength: 12 });

const mk = (a: Decimal.Value | null, over: Partial<MoneyLine> = {}): MoneyLine => ({
  ref: "x",
  amount: a,
  currency: ctx.currency,
  taxBasis: ctx.taxBasis,
  period: ctx.period,
  resultClass: "realized",
  ...over,
});
const area = (v: Decimal.Value | null, over: Partial<QuantityLine> = {}): QuantityLine => ({
  ref: "alan",
  value: v,
  unit: "m2",
  period: ctx.period,
  resultClass: "realized",
  ...over,
});

const codeOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return e instanceof CalcError ? e.code : "other";
  }
  return null;
};

describe("sumMoney", () => {
  it("toplam kalemlerin sırasından bağımsızdır", () => {
    fc.assert(
      fc.property(lines, fc.infiniteStream(fc.nat()), (ls, rnd) => {
        const shuffled = ls
          .map((l) => ({ l, k: rnd.next().value }))
          .sort((a, b) => a.k - b.k)
          .map((x) => x.l);
        expect(sumMoney(shuffled, ctx).value!.eq(sumMoney(ls, ctx).value!)).toBe(true);
      }),
    );
  });

  it("boş liste bilinen sıfırdır", () => {
    expect(sumMoney([], ctx).value!.isZero()).toBe(true);
  });

  it("kalemlerden biri bilinmiyorsa (null) toplam da bilinmiyor; asla sıfıra çevrilmez", () => {
    fc.assert(
      fc.property(lines, lines, (before, after) => {
        expect(sumMoney([...before, mk(null), ...after], ctx).value).toBeNull();
      }),
    );
  });

  it("para birimi, vergi temeli ya da dönem uyuşmazsa hata verir", () => {
    fc.assert(
      fc.property(nonEmptyLines, fc.nat(), (ls, i) => {
        const k = i % ls.length;
        const swap = (o: Partial<MoneyLine>) => ls.map((l, j) => (j === k ? { ...l, ...o } : l));
        expect(codeOf(() => sumMoney(swap({ currency: "EUR" }), ctx))).toBe("currency_mismatch");
        expect(codeOf(() => sumMoney(swap({ taxBasis: "incl_vat" }), ctx))).toBe("tax_basis_mismatch");
        expect(codeOf(() => sumMoney(swap({ period: "2026-09" }), ctx))).toBe("period_mismatch");
      }),
    );
  });
});

describe("sonuç sınıfı", () => {
  it("en zayıf girdinin sınıfıdır ve sıradan bağımsızdır", () => {
    fc.assert(
      fc.property(fc.array(resultClass, { minLength: 1, maxLength: 10 }), (cs) => {
        const w = weakestClass(cs);
        const minIdx = Math.min(...cs.map((c) => RESULT_CLASSES.indexOf(c)));
        expect(w).toBe(RESULT_CLASSES[minIdx]);
        expect(weakestClass([...cs].reverse())).toBe(w);
      }),
    );
  });

  it("girdisiz sınıf sorulursa hata verir", () => {
    expect(codeOf(() => weakestClass([]))).toBe("no_inputs");
  });

  it("tek bir sentetik girdi bütün sonucu sentetik yapar", () => {
    fc.assert(
      fc.property(nonEmptyLines, (ls) => {
        const realized = ls.map((l) => ({ ...l, resultClass: "realized" as ResultClass }));
        const r = factoryGain(
          { current: { avoidableCosts: realized, wasteSaleRevenue: [] }, next: { costs: [mk(1, { resultClass: "synthetic" })], reboardPayment: [] } },
          ctx,
        );
        expect(r.resultClass).toBe("synthetic");
      }),
    );
  });
});

describe("factoryGain", () => {
  it("bugünkü atık satış geliri x artınca kazanç tam x azalır", () => {
    fc.assert(
      fc.property(nonEmptyLines, lines, lines, lines, amount, (cost, rev, next, pay, x) => {
        const input = (extra: MoneyLine[]) => ({ current: { avoidableCosts: cost, wasteSaleRevenue: [...rev, ...extra] }, next: { costs: next, reboardPayment: pay } });
        const base = factoryGain(input([]), ctx);
        const more = factoryGain(input([mk(x)]), ctx);
        expect(base.value!.minus(more.value!).eq(x)).toBe(true);
      }),
    );
  });
});

describe("reboardOperatingResult", () => {
  it("gelir − gider eşitliğini korur", () => {
    fc.assert(
      fc.property(nonEmptyLines, lines, lines, lines, (panel, acc, mat, ops) => {
        const r = reboardOperatingResult(
          { revenues: { panel, acceptance: acc, service: [] }, costs: { material: mat, operations: ops, fixed: [], depreciation: [] } },
          ctx,
        );
        const s = (l: MoneyLine[]) => sumMoney(l, ctx).value!;
        expect(r.value!.eq(s(panel).plus(s(acc)).minus(s(mat)).minus(s(ops)))).toBe(true);
      }),
    );
  });
});

describe("panelCustomerGain", () => {
  it("teknik eşdeğerlik doğrulanınca koşul kalkar, doğrulanmazsa kalır", () => {
    const input = (equivalenceVerified: boolean) => ({ currentProductCosts: [mk(300)], reboardProductCosts: [mk(250)], equivalenceVerified });
    expect(panelCustomerGain(input(true), ctx).conditions).toEqual([]);
    expect(panelCustomerGain(input(false), ctx).conditions).toEqual(["equivalence_unverified"]);
  });
});

describe("bilinmeyen gider", () => {
  it("tek bir gider kalemi bilinmiyorsa faaliyet sonucu da bilinmiyor", () => {
    const r = reboardOperatingResult(
      { revenues: { panel: [mk(1000)], acceptance: [], service: [] }, costs: { material: [mk(null)], operations: [], fixed: [], depreciation: [] } },
      ctx,
    );
    expect(r.value).toBeNull();
  });
});

describe("girdisiz hesap", () => {
  it("hiç kalem yoksa sonucun sınıfı olamaz; yayımlanmaz, no_inputs hatası verir", () => {
    const none = { revenues: { panel: [], acceptance: [], service: [] }, costs: { material: [], operations: [], fixed: [], depreciation: [] } };
    expect(codeOf(() => reboardOperatingResult(none, ctx))).toBe("no_inputs");
  });
});

describe("priceCorridor", () => {
  const posArea = fc.integer({ min: 1, max: 100_000 });

  it("aralık vardır ⇔ alt sınır ≤ üst sınır", () => {
    fc.assert(
      fc.property(lines, lines, posArea, lines, lines, posArea, (costs, nonPanel, sell, cur, sw, gross) => {
        const c = priceCorridor(
          {
            periodTotalCosts: costs,
            nonPanelRevenues: nonPanel,
            sellableAreaM2: area(sell),
            customerCurrentTotalCost: cur,
            switchingAndExtraCosts: sw,
            requiredGrossAreaM2: area(gross),
          },
          ctx,
        );
        expect(c.exists).toBe(c.lower.value!.lte(c.upper.value!));
        expect(c.lower.conditions.includes("no_corridor")).toBe(c.exists === false);
      }),
    );
  });

  it("sınır durumu: alt sınır üst sınıra eşitse aralık vardır (tek fiyat)", () => {
    fc.assert(
      fc.property(amount, posArea, (x, a) => {
        // (x·a − 0) / a = x her iki tarafta da: alt = üst.
        const c = priceCorridor(
          {
            periodTotalCosts: [mk(x.times(a))],
            nonPanelRevenues: [],
            sellableAreaM2: area(a),
            customerCurrentTotalCost: [mk(x.times(a))],
            switchingAndExtraCosts: [],
            requiredGrossAreaM2: area(a),
          },
          ctx,
        );
        expect(c.lower.value!.eq(c.upper.value!)).toBe(true);
        expect(c.exists).toBe(true);
      }),
    );
  });

  it("alan sıfır, negatif ya da bilinmiyorsa sınır bilinmiyor; aralık da bilinmiyor", () => {
    for (const bad of [0, -5, null]) {
      const c = priceCorridor(
        {
          periodTotalCosts: [mk(100)],
          nonPanelRevenues: [],
          sellableAreaM2: area(bad),
          customerCurrentTotalCost: [mk(500)],
          switchingAndExtraCosts: [],
          requiredGrossAreaM2: area(10),
        },
        ctx,
      );
      expect(c.lower.value).toBeNull();
      expect(c.exists).toBeNull();
    }
  });

  it("alan birimi m² değilse hata verir", () => {
    expect(codeOf(() => quantity(area(10, { unit: "kg" }), "m2", ctx.period))).toBe("unit_mismatch");
    expect(codeOf(() => quantity(area(10, { period: "2026-09" }), "m2", ctx.period))).toBe("period_mismatch");
  });
});

describe("divide", () => {
  it("bölen sıfır ya da negatifse sonuç bilinmiyor (null)", () => {
    fc.assert(
      fc.property(amount, fc.integer({ min: -1000, max: 0 }), (a, b) => {
        expect(divide(a, new Decimal(b))).toBeNull();
      }),
    );
  });
});
