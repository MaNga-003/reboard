import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { Decimal } from "@/domain/result";
import { canonicalJson, CanonicalJsonError, kgText } from "@/domain/traceability";

// Kesirli sayı içermeyen rastgele JSON (kg gibi ondalıklar metin olarak taşınır).
const { json } = fc.letrec<{ json: unknown }>((tie) => ({
  json: fc.oneof(
    { depthSize: "small" },
    fc.constant(null),
    fc.boolean(),
    fc.integer(),
    fc.string(),
    fc.array(tie("json"), { maxLength: 4 }),
    fc.dictionary(fc.string(), tie("json"), { maxKeys: 4, noNullPrototype: true }),
  ),
}));

const reverseKeys = (v: unknown): unknown => {
  if (Array.isArray(v)) return v.map(reverseKeys);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).reverse().map(([k, x]) => [k, reverseKeys(x)]));
  return v;
};

describe("canonicalJson", () => {
  it("bilinen örnek: anahtarlar sıralı, boşluksuz", () => {
    expect(canonicalJson({ b: 1, a: [true, null, "x"], c: { z: "ğ", y: -0 } })).toBe('{"a":[true,null,"x"],"b":1,"c":{"y":0,"z":"ğ"}}');
  });

  it("anahtarların yazılış sırasından bağımsızdır", () => {
    fc.assert(
      fc.property(json, (v) => {
        expect(canonicalJson(reverseKeys(v))).toBe(canonicalJson(v));
      }),
    );
  });

  it("JSON olarak geri okununca aynı metni verir (jsonb gidiş-dönüşü gibi)", () => {
    fc.assert(
      fc.property(json, (v) => {
        const c = canonicalJson(v);
        expect(JSON.parse(c)).toEqual(v);
        expect(canonicalJson(JSON.parse(c))).toBe(c);
      }),
    );
  });

  it("undefined alanlar yazılmaz; dizide undefined hata verir", () => {
    expect(canonicalJson({ a: 1, b: undefined })).toBe('{"a":1}');
    expect(() => canonicalJson([1, undefined])).toThrow(CanonicalJsonError);
  });

  it.each([
    ["kesirli sayı", 1.5],
    ["NaN", Number.NaN],
    ["sonsuz", Number.POSITIVE_INFINITY],
    ["güvenli olmayan tamsayı", 2 ** 53],
    ["Date", new Date(0)],
    ["Decimal", new Decimal(1)],
    ["bigint", BigInt(1)],
    ["fonksiyon", () => 1],
  ])("%s reddedilir", (_name, v) => {
    expect(() => canonicalJson({ v })).toThrow(CanonicalJsonError);
  });

  it("kgText numeric(14,3) ölçeğinde yazar", () => {
    expect(kgText(1250.5)).toBe("1250.500");
    expect(kgText("0.0004")).toBe("0.000");
    expect(kgText(new Decimal("12.3456"))).toBe("12.346");
  });
});
