// Renk ölçüm fonksiyonları bağımsız araçla (measurable-verification/color_metrics.py) çapraz denetlenir.
import { describe, expect, it } from "vitest";
import { contrastRatio, deltaE, hueDifference, minCvdDeltaE, simulateCvd } from "@/design/color";

describe("WCAG kontrastı", () => {
  it("siyah–beyaz 21:1", () => expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5));
  it("aynı renk 1:1", () => expect(contrastRatio("#ae5224", "#ae5224")).toBe(1));
  it("Deep Slate Olive / Naples Yellow = 10,98 (color_metrics.py)", () =>
    expect(contrastRatio("#253122", "#fbe6a0")).toBeCloseTo(10.98, 2));
  it("Burnt Sienna / Ivory Buff = 3,56 (color_metrics.py)", () =>
    expect(contrastRatio("#ae5224", "#ebd3a2")).toBeCloseTo(3.56, 2));
});

describe("OKLab ΔE", () => {
  it("sienna–olive 0,134; olive–mavi 0,139; sienna–mavi 0,258 (color_metrics.py)", () => {
    expect(deltaE("#ae5224", "#635a3a")).toBeCloseTo(0.134, 3);
    expect(deltaE("#635a3a", "#064f6e")).toBeCloseTo(0.139, 3);
    expect(deltaE("#ae5224", "#064f6e")).toBeCloseTo(0.258, 3);
  });
  it("simetrik ve aynı renkte 0", () => {
    expect(deltaE("#f15a30", "#253122")).toBeCloseTo(deltaE("#253122", "#f15a30"), 12);
    expect(deltaE("#f15a30", "#f15a30")).toBe(0);
  });
});

describe("renk körlüğü benzetimi", () => {
  it("Peach Red ~ Deep Slate Olive en küçük CVD ΔE 0,275 (protan, color_metrics.py)", () =>
    expect(minCvdDeltaE("#f15a30", "#253122")).toBeCloseTo(0.275, 2));
  it("gri tonlar benzetimde neredeyse değişmez", () => {
    for (const k of ["protan", "deutan", "tritan"] as const) expect(deltaE(simulateCvd("#808080", k), "#808080")).toBeLessThan(0.01);
  });
});

describe("ton farkı", () => {
  it("0–180 aralığında ve simetrik", () => {
    const d = hueDifference("#f15a30", "#064f6e");
    expect(d).toBeGreaterThan(0);
    expect(d).toBeLessThanOrEqual(180);
    expect(hueDifference("#064f6e", "#f15a30")).toBeCloseTo(d, 10);
  });
});
