import { describe, expect, it } from "vitest";
import { SHEET_AREA_M2, sheetMassKg } from "@/domain/panel";
import { CalcError } from "@/domain/result";

describe("levha ölçüleri", () => {
  it("1830×3660 mm levha 6,6978 m²", () => {
    expect(SHEET_AREA_M2.toString()).toBe("6.6978");
  });

  it("levha kütlesi alan × kalınlık × yoğunluk", () => {
    // 6,6978 × 0,018 × 640 = 77,158656 kg
    expect(sheetMassKg(640).toString()).toBe("77.158656");
    expect(sheetMassKg(640, 9).toString()).toBe("38.579328");
  });

  it("sıfır ya da negatif değeri reddeder", () => {
    expect(() => sheetMassKg(0)).toThrow(CalcError);
    expect(() => sheetMassKg(640, -1)).toThrow(CalcError);
  });
});
