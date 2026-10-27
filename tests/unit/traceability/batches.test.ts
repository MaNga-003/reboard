import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SHEET_AREA_M2 } from "@/domain/panel";
import { Decimal } from "@/domain/result";
import {
  EVIDENCE_MAX_BYTES,
  acceptedKg,
  cleanFileName,
  declaredGap,
  evidenceError,
  isVerified,
  lotAreaM2,
  nextCode,
  producible,
  productionError,
  receiveError,
  remainingKg,
  sniffMime,
  touches,
  type ProductionInput,
  type ReceiveInput,
  type StockBatch,
} from "@/domain/traceability";

const receive = (o: Partial<ReceiveInput> = {}): ReceiveInput => ({
  declaredKg: "500",
  weighedKg: "490",
  moisturePct: "6.5",
  rejectedKg: "12",
  containsSilk: false,
  composition: { cotton: 70, polyester: 30 },
  ...o,
});

describe("receiveError", () => {
  it("geçerli kabul", () => expect(receiveError(receive())).toBeNull());
  it("tartım bekleyen parti beyanla kabul edilir; ayıklanan bilinmeyebilir", () =>
    expect(receiveError(receive({ weighedKg: null, rejectedKg: null, moisturePct: null }))).toBeNull());
  it("beyan da tartım da yoksa ret", () => expect(receiveError(receive({ declaredKg: null, weighedKg: null }))).toBe("weight_missing"));
  it.each([
    [{ declaredKg: "0" }, "kg_invalid"],
    [{ weighedKg: "-1" }, "kg_invalid"],
    [{ weighedKg: "Infinity" }, "kg_invalid"],
    [{ rejectedKg: "-0.5" }, "kg_invalid"],
    [{ moisturePct: "101" }, "moisture_invalid"],
    [{ moisturePct: "-1" }, "moisture_invalid"],
    [{ rejectedKg: "490.001" }, "rejected_exceeds"],
    [{ composition: { cotton: 70, polyester: 31 } }, "composition_invalid"],
    [{ composition: { cotton: 70.5 } }, "composition_invalid"],
    [{ composition: { cotton: -5 } }, "composition_invalid"],
    [{ containsSilk: true, rejectedKg: "0" }, "silk_not_rejected"],
    [{ containsSilk: true, rejectedKg: null }, "silk_not_rejected"],
  ] as const)("%o → %s", (o, code) => expect(receiveError(receive(o as Partial<ReceiveInput>))).toBe(code));
  it("ayıklanan tartıma eşit olabilir (hepsi ret)", () => expect(receiveError(receive({ rejectedKg: "490" }))).toBeNull());
  it("ipekli parti ayıklanan kg ile kabul edilir", () => expect(receiveError(receive({ containsSilk: true, rejectedKg: "3" }))).toBeNull());
  it("bileşim bilinmiyorsa kabul edilir; eksik lif bilinmeyen sayılır, 0 değil", () => {
    expect(receiveError(receive({ composition: null }))).toBeNull();
    expect(receiveError(receive({ composition: { cotton: 60 } }))).toBeNull();
  });
});

describe("kabul edilen, fark ve kalan", () => {
  it("kabul edilen = tartım − ayıklanan; biri bilinmiyorsa null (0 değil)", () => {
    expect(acceptedKg("490", "12")?.toString()).toBe("478");
    expect(acceptedKg(null, "12")).toBeNull();
    expect(acceptedKg("490", null)).toBeNull();
  });
  it("beyan farkı oran olarak; beyan sıfır ya da bilinmiyorsa null", () => {
    expect(declaredGap("500", "490")?.toString()).toBe("-0.02");
    expect(declaredGap(null, "490")).toBeNull();
    expect(declaredGap("0", "490")).toBeNull();
    expect(declaredGap("500", null)).toBeNull();
  });
  it("kalan = kabul edilen − tahsisler", () => {
    expect(remainingKg(new Decimal(478), ["100", "78.5"])?.toString()).toBe("299.5");
    expect(remainingKg(null, ["1"])).toBeNull();
  });
});

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d];
const bytes = (xs: number[], pad = 0) => new Uint8Array([...xs, ...new Array(pad).fill(0)]);

describe("kanıt dosyası", () => {
  it("türü baytlardan tanır", () => {
    expect(sniffMime(bytes([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]))).toBe("application/pdf");
    expect(sniffMime(bytes(PNG))).toBe("image/png");
    expect(sniffMime(bytes([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffMime(bytes([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50]))).toBe("image/webp");
  });
  it("uzantısı değiştirilmiş metin ya da HTML reddedilir", () => {
    expect(sniffMime(new TextEncoder().encode("<html><script>alert(1)</script>"))).toBeNull();
    expect(sniffMime(bytes([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x41, 0x56, 0x49, 0x20]))).toBeNull(); // RIFF AVI
    expect(sniffMime(bytes([0x89, 0x50]))).toBeNull(); // kesik imza
  });
  it("boyut sınırı 4 MiB; sınırda kabul, bir bayt fazlası ret", () => {
    expect(EVIDENCE_MAX_BYTES).toBe(4_194_304);
    expect(evidenceError(bytes(PNG, EVIDENCE_MAX_BYTES - PNG.length))).toBeNull();
    expect(evidenceError(bytes(PNG, EVIDENCE_MAX_BYTES - PNG.length + 1))).toBe("file_too_large");
    expect(evidenceError(new Uint8Array())).toBe("file_empty");
    expect(evidenceError(bytes([1, 2, 3]))).toBe("file_type");
  });
  it("dosya adı: yol ve tehlikeli karakter atılır, boşsa varsayılan ad", () => {
    expect(cleanFileName("C:\\fakepath\\kantar fişi.pdf")).toBe("kantar fişi.pdf");
    expect(cleanFileName("../../etc/passwd")).toBe("passwd");
    expect(cleanFileName('a"<b>\u0000.png')).toBe("ab.png");
    expect(cleanFileName("x".repeat(300))).toHaveLength(120);
    expect(cleanFileName("  /  ")).toBe("kanit");
  });
  it("D-013: tartım ve kontrol edilmiş kantar fişi varsa doğrulanmış", () => {
    const ticket = (status: "declared" | "documented" | "reconciled") => ({ kind: "weighbridge_ticket", status });
    expect(isVerified("490", [ticket("documented")])).toBe(true);
    expect(isVerified("490", [ticket("reconciled")])).toBe(true);
    expect(isVerified("490", [ticket("declared")])).toBe(false);
    expect(isVerified("490", [{ kind: "waybill", status: "documented" }])).toBe(false);
    expect(isVerified(null, [ticket("documented")])).toBe(false);
  });
});

const stock: StockBatch[] = [
  { id: "a", verified: true, remainingKg: new Decimal(400) },
  { id: "b", verified: true, remainingKg: new Decimal(100) },
  { id: "u", verified: false, remainingKg: new Decimal(300) },
  { id: "n", verified: true, remainingKg: null },
];
const production = (o: Partial<ProductionInput> = {}): ProductionInput => ({
  inputs: [
    { wasteBatchId: "a", kg: "400" },
    { wasteBatchId: "b", kg: "100" },
  ],
  outputKg: "440",
  scrapKg: "30",
  moistureLossKg: "25",
  balanceNote: null,
  sheetCount: 6,
  densityKgM3: "650",
  ...o,
});

describe("productionError", () => {
  it("geçerli üretim: fark %1, tolerans içinde", () => expect(productionError(production(), stock)).toBeNull());
  it("lotsuz üretim de kaydedilir", () => expect(productionError(production({ sheetCount: null, densityKgM3: null }), stock)).toBeNull());
  it.each([
    [{ inputs: [] }, "no_inputs"],
    [{ inputs: [{ wasteBatchId: "a", kg: "1" }, { wasteBatchId: "a", kg: "2" }] }, "input_duplicate"],
    [{ inputs: [{ wasteBatchId: "x", kg: "1" }] }, "input_unknown"],
    [{ inputs: [{ wasteBatchId: "u", kg: "1" }] }, "input_unverified"],
    [{ inputs: [{ wasteBatchId: "n", kg: "1" }] }, "allocation_exceeds"],
    [{ inputs: [{ wasteBatchId: "b", kg: "100.001" }] }, "allocation_exceeds"],
    [{ inputs: [{ wasteBatchId: "a", kg: "0" }] }, "kg_invalid"],
    [{ outputKg: null }, "kg_invalid"],
    [{ scrapKg: "-1" }, "kg_invalid"],
    [{ outputKg: "0" }, "kg_invalid"],
    [{ outputKg: "400" }, "balance_note_missing"],
    [{ sheetCount: 0 }, "lot_invalid"],
    [{ sheetCount: 2.5 }, "lot_invalid"],
    [{ sheetCount: null }, "lot_invalid"],
    [{ densityKgM3: "0" }, "lot_invalid"],
  ] as const)("%o → %s", (o, code) => expect(productionError(production(o as Partial<ProductionInput>), stock)).toBe(code));
  it("tolerans aşımı açıklamayla kabul edilir", () => expect(productionError(production({ outputKg: "400", balanceNote: "Elek kaybı tartılmadı" }), stock)).toBeNull());
  it("özellik: kalanın tamamı tahsis edilebilir, bir gram fazlası edilemez", () =>
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 1_000_000 }), (grams) => {
        const rem = new Decimal(grams).div(1000);
        const s: StockBatch[] = [{ id: "a", verified: true, remainingKg: rem }];
        const base = { outputKg: rem.times(0.9).toFixed(3), scrapKg: rem.times(0.05).toFixed(3), moistureLossKg: rem.times(0.05).toFixed(3), sheetCount: null, densityKgM3: null };
        const ok = productionError(production({ ...base, inputs: [{ wasteBatchId: "a", kg: rem.toFixed(3) }] }), s);
        const over = productionError(production({ ...base, inputs: [{ wasteBatchId: "a", kg: rem.plus("0.001").toFixed(3) }] }), s);
        return ok !== "allocation_exceeds" && over === "allocation_exceeds";
      }),
    ));
  it("lot alanı levha sayısı × levha alanı", () => expect(lotAreaM2(6).toString()).toBe(SHEET_AREA_M2.times(6).toString()));
});

describe("producible", () => {
  it.each([
    [true, "0.001", true],
    [true, "0", false],
    [true, null, false],
    [false, "100", false],
  ] as const)("doğrulanmış=%s, kalan=%s → %s", (verified, rem, want) =>
    expect(producible({ verified, remainingKg: rem === null ? null : new Decimal(rem) })).toBe(want));
  // Form listesi ile kaydetme kuralı ayrışırsa kullanıcı seçtiği partiyle hata alır ya da geçerli partiyi göremez.
  it("özellik: listelenen parti en küçük tahsisle productionError'dan geçer, listelenmeyen geçmez", () =>
    fc.assert(
      // Sınırlar (0 ve 1 g) açıkça üretilir: rastgele tamsayıyla 100 örnekte 0 çıkmadı, gt → gte bozması kaçtı.
      fc.property(fc.boolean(), fc.option(fc.oneof(fc.constantFrom(0, 1), fc.integer({ min: 0, max: 1_000_000 })), { nil: null }), (verified, grams) => {
        const b: StockBatch = { id: "a", verified, remainingKg: grams === null ? null : new Decimal(grams).div(1000) };
        const p = production({ inputs: [{ wasteBatchId: "a", kg: "0.001" }], outputKg: "0.001", scrapKg: "0", moistureLossKg: "0", sheetCount: null, densityKgM3: null });
        return producible(b) === (productionError(p, [b]) === null);
      }),
    ));
});

describe("nextCode", () => {
  it("yılın en büyük numarasından devam eder; başka yıl ve önek karışmaz", () => {
    expect(nextCode("WB", 2026, [])).toBe("WB-2026-0001");
    expect(nextCode("WB", 2026, ["WB-2026-0007", "WB-2026-0003", "WB-2025-0099", "PB-2026-50"])).toBe("WB-2026-0008");
    expect(nextCode("PB", 2026, ["PB-2026-09"])).toBe("PB-2026-10");
    expect(nextCode("PL", 2026, ["PL-2026-012", "PL-2026-x"])).toBe("PL-2026-013");
  });
  it("özellik: üretilen kod listede yoktur ve listeye eklenince bir sonraki farklıdır", () =>
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 1, max: 9999 }), { maxLength: 30 }), (ns) => {
        const codes = ns.map((n) => `WB-2026-${String(n).padStart(4, "0")}`);
        const c = nextCode("WB", 2026, codes);
        return !codes.includes(c) && nextCode("WB", 2026, [...codes, c]) !== c;
      }),
    ));
});

describe("touches", () => {
  const e = { payload: { inputs: [{ ref: "WB-2026-0001", kg: "1.000" }], outputs: [{ ref: "PB-2026-01", kg: "1.000" }], evidenceIds: ["ev1"] } };
  it("girdi, çıktı ya da kanıt kimliğiyle eşleşir", () => {
    expect(touches(e, new Set(["WB-2026-0001"]))).toBe(true);
    expect(touches(e, new Set(["PB-2026-01"]))).toBe(true);
    expect(touches(e, new Set(), new Set(["ev1"]))).toBe(true);
    expect(touches(e, new Set(["WB-2026-0002"]), new Set(["ev2"]))).toBe(false);
  });
});
