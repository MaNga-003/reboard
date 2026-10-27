// Parti kabulü, kanıt ve üretim tahsisi kuralları (T2.2). Saf; depo bu kararları uygular.
// Boş değer bilinmeyen demektir: tartılmamış partinin kabul edilen kg'ı 0 değil null'dır.
import { FIBRES, type Composition } from "../fibre";
import { SHEET_AREA_M2 } from "../panel";
import { Decimal } from "../result";
import type { ChainedEvent } from "./chain";
import { balanceNoteMissing, massBalance } from "./mass-balance";

type Kg = Decimal.Value | null;

const dec = (v: Kg) => (v === null ? null : new Decimal(v));
const badKg = (v: Kg, positive = false) => {
  const d = dec(v);
  return d !== null && (!d.isFinite() || d.isNeg() || (positive && d.isZero()));
};

// ---- Kabul ----

export type ReceiveInput = {
  declaredKg: Kg;
  weighedKg: Kg;
  moisturePct: Kg;
  rejectedKg: Kg;
  containsSilk: boolean | null;
  composition: Composition | null;
};

export type ReceiveRuleError = "weight_missing" | "kg_invalid" | "moisture_invalid" | "rejected_exceeds" | "composition_invalid" | "silk_not_rejected";

export function receiveError(i: ReceiveInput): ReceiveRuleError | null {
  if (i.declaredKg === null && i.weighedKg === null) return "weight_missing";
  if (badKg(i.declaredKg, true) || badKg(i.weighedKg, true) || badKg(i.rejectedKg)) return "kg_invalid";
  const m = dec(i.moisturePct);
  if (m !== null && (!m.isFinite() || m.isNeg() || m.gt(100))) return "moisture_invalid";
  if (i.weighedKg !== null && i.rejectedKg !== null && new Decimal(i.rejectedKg).gt(i.weighedKg)) return "rejected_exceeds";
  if (i.composition) {
    const shares = FIBRES.map((f) => i.composition![f]).filter((p) => p !== undefined);
    if (shares.some((p) => !Number.isInteger(p) || p < 0 || p > 100) || shares.reduce((a, p) => a + p, 0) > 100) return "composition_invalid";
  }
  // İpek kapsam dışı: kabulde ayrılır. İpek var deniyorsa ayıklanan kg bilinmeli ve sıfır olmamalı.
  if (i.containsSilk === true && (i.rejectedKg === null || new Decimal(i.rejectedKg).isZero())) return "silk_not_rejected";
  return null;
}

/** Kabul edilen = tartım − ayıklanan. İkisinden biri bilinmiyorsa kabul edilen de bilinmiyor. */
export function acceptedKg(weighedKg: Kg, rejectedKg: Kg): Decimal | null {
  return weighedKg === null || rejectedKg === null ? null : new Decimal(weighedKg).minus(rejectedKg);
}

/** Beyan ile tartım farkı, beyana oranla (D-013: tedarikçi güvenilirliğine yansır). Negatifse beyandan az geldi. */
export function declaredGap(declaredKg: Kg, weighedKg: Kg): Decimal | null {
  if (declaredKg === null || weighedKg === null || new Decimal(declaredKg).isZero()) return null;
  return new Decimal(weighedKg).minus(declaredKg).div(declaredKg);
}

// ---- Kanıt ----

// Vercel işlevi en çok 4,5 MB istek gövdesi kabul eder; çok parçalı form başlıkları da sığsın diye 4 MiB (D-018).
export const EVIDENCE_MAX_BYTES = 4 * 1024 * 1024;
export const EVIDENCE_MIMES = ["application/pdf", "image/png", "image/jpeg", "image/webp"] as const;
export type EvidenceMime = (typeof EVIDENCE_MIMES)[number];
export const EVIDENCE_KINDS = ["weighbridge_ticket", "waybill", "invoice", "test_report", "photo", "other"] as const;
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];
export type EvidenceStatus = "declared" | "documented" | "reconciled";

const has = (b: Uint8Array, sig: readonly number[], at = 0) => b.length >= at + sig.length && sig.every((x, k) => b[at + k] === x);

/** Tür, tarayıcının söylediği MIME'den değil dosyanın ilk baytlarından belirlenir. */
export function sniffMime(b: Uint8Array): EvidenceMime | null {
  if (has(b, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf";
  if (has(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (has(b, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (has(b, [0x52, 0x49, 0x46, 0x46]) && has(b, [0x57, 0x45, 0x42, 0x50], 8)) return "image/webp";
  return null;
}

export type EvidenceRuleError = "file_empty" | "file_too_large" | "file_type";

export function evidenceError(b: Uint8Array): EvidenceRuleError | null {
  if (b.length === 0) return "file_empty";
  if (b.length > EVIDENCE_MAX_BYTES) return "file_too_large";
  return sniffMime(b) ? null : "file_type";
}

/** D-013: tartım var ve kantar fişi bir insan tarafından kontrol edilmişse parti doğrulanmıştır. */
export function isVerified(weighedKg: Kg, evidence: readonly { kind: string; status: EvidenceStatus }[]): boolean {
  return weighedKg !== null && evidence.some((e) => e.kind === "weighbridge_ticket" && e.status !== "declared");
}

export function remainingKg(accepted: Decimal | null, allocated: readonly Decimal.Value[]): Decimal | null {
  return accepted === null ? null : allocated.reduce<Decimal>((a, v) => a.minus(v), accepted);
}

// ---- Üretim ----

export type StockBatch = { id: string; verified: boolean; remainingKg: Decimal | null };
export type ProductionInput = {
  inputs: { wasteBatchId: string; kg: Decimal.Value }[];
  outputKg: Kg;
  scrapKg: Kg;
  moistureLossKg: Kg;
  balanceNote: string | null;
  /** Lot isteğe bağlı: levha sayısı boşsa yalnızca üretim partisi kaydedilir. */
  sheetCount: number | null;
  densityKgM3: Kg;
};

export type ProductionRuleError =
  | "no_inputs"
  | "input_duplicate"
  | "input_unknown"
  | "input_unverified"
  | "allocation_exceeds"
  | "kg_invalid"
  | "balance_note_missing"
  | "lot_invalid";

export function productionError(p: ProductionInput, stock: readonly StockBatch[]): ProductionRuleError | null {
  if (p.inputs.length === 0) return "no_inputs";
  if (new Set(p.inputs.map((i) => i.wasteBatchId)).size !== p.inputs.length) return "input_duplicate";
  for (const i of p.inputs) {
    if (badKg(i.kg, true)) return "kg_invalid";
    const s = stock.find((b) => b.id === i.wasteBatchId);
    if (!s) return "input_unknown";
    // Doğrulanmamış partiden panel üretilirse pasaporttaki kg doğrulanamaz.
    if (!s.verified) return "input_unverified";
    if (s.remainingKg === null || new Decimal(i.kg).gt(s.remainingKg)) return "allocation_exceeds";
  }
  // Kütle dengesi kurulmadan üretim kaydı olmaz: çıktı, fire ve nem kaybı zorunlu.
  if (p.outputKg === null || p.scrapKg === null || p.moistureLossKg === null) return "kg_invalid";
  if (badKg(p.outputKg, true) || badKg(p.scrapKg) || badKg(p.moistureLossKg)) return "kg_invalid";
  const mb = massBalance({ inputsKg: p.inputs.map((i) => i.kg), outputKg: p.outputKg, scrapKg: p.scrapKg, moistureLossKg: p.moistureLossKg });
  if (balanceNoteMissing(mb, p.balanceNote)) return "balance_note_missing";
  if (p.sheetCount !== null && (!Number.isInteger(p.sheetCount) || p.sheetCount < 1)) return "lot_invalid";
  if (p.sheetCount === null && p.densityKgM3 !== null) return "lot_invalid";
  if (badKg(p.densityKgM3, true)) return "lot_invalid";
  return null;
}

export const lotAreaM2 = (sheetCount: number) => SHEET_AREA_M2.times(sheetCount);

// ---- Kodlar ----

export const CODE_PAD = { WB: 4, PB: 2, PL: 3 } as const;
export type CodePrefix = keyof typeof CODE_PAD;

/** Yılın sıradaki kodu: WB-2026-0007 gibi. Var olan en büyük numaradan devam eder; boşluklar doldurulmaz. */
export function nextCode(prefix: CodePrefix, year: number, existing: readonly string[]): string {
  const re = new RegExp(`^${prefix}-${year}-(\\d+)$`);
  const max = existing.reduce((m, c) => Math.max(m, Number(re.exec(c)?.[1] ?? 0)), 0);
  return `${prefix}-${year}-${String(max + 1).padStart(CODE_PAD[prefix], "0")}`;
}

// ---- Zaman çizelgesi ----

/** Olay bu nesnelerden birine dokunuyor mu: girdi ya da çıktı kodu ya da kanıt kimliği. */
export function touches(e: Pick<ChainedEvent, "payload">, refs: ReadonlySet<string>, evidenceIds: ReadonlySet<string> = new Set()): boolean {
  const p = e.payload;
  return p.inputs.some((q) => refs.has(q.ref)) || p.outputs.some((q) => refs.has(q.ref)) || p.evidenceIds.some((id) => evidenceIds.has(id));
}
