// Etki göstergeleri (DATA_DICTIONARY §5, T2.3). Ana sayı doğrulanmış kg'dır (D-013); beyan edilen ayrı durur.
// Toplamda bilinmeyen kalem 0 sayılmaz: toplam bir alt sınır olur ve kaç kalemin bilinmediği yanında taşınır.
import { istanbulDay } from "./market";
import { Decimal, weakestClass, type ResultClass } from "./result";
import { acceptedKg } from "./traceability/batches";

type Kg = Decimal.Value | null;

export type KgTotal = {
  /** Bilinen kalemlerin toplamı. Hiç kalem yoksa 0 (bilinen sıfır); kalemlerin hepsi bilinmiyorsa null. */
  kg: Decimal | null;
  /** Bilinmeyen kalem sayısı. 0'dan büyükse kg bir alt sınırdır. */
  unknown: number;
  count: number;
};

export function kgTotal(values: readonly Kg[]): KgTotal {
  let kg = new Decimal(0);
  let unknown = 0;
  for (const v of values) {
    if (v === null) unknown++;
    else kg = kg.plus(v);
  }
  return { kg: values.length > 0 && unknown === values.length ? null : kg, unknown, count: values.length };
}

/** Sınıf, hesaba giren kayıtların en zayıfıdır. Kayıt yoksa sayı da gösterilmez; çağıran boş durumu ayrıca ele alır. */
export const classOf = (rows: readonly { resultClass: ResultClass }[], ...extra: ResultClass[]): ResultClass | null => {
  const all = [...rows.map((r) => r.resultClass), ...extra];
  return all.length === 0 ? null : weakestClass(all);
};

export type ImpactBatch = {
  id: string;
  /** Teslim alan kurum */
  orgId: string;
  supplierOrgId: string;
  receivedAt: Date;
  declaredKg: Kg;
  weighedKg: Kg;
  rejectedKg: Kg;
  verified: boolean;
  resultClass: ResultClass;
};

export type ImpactProduction = {
  id: string;
  hasLot: boolean;
  inputs: { allocatedKg: Decimal.Value; resultClass: ResultClass }[];
  resultClass: ResultClass;
};

export type CounterpartyShare = { orgId: string; verified: KgTotal; share: Decimal | null };
export type MonthTotal = { month: string; verified: KgTotal };

export type Impact = {
  batches: number;
  verifiedBatches: number;
  verified: KgTotal;
  declared: KgTotal;
  /** Kurumun üretimi yoksa yok: sağlayıcı başkasının tahsisini görmez (D-016), 0 yazmak yanıltır. */
  inPanel?: KgTotal & { resultClass: ResultClass };
  byCounterparty: CounterpartyShare[];
  monthly: MonthTotal[];
  resultClass: ResultClass;
};

export const TREND_MONTHS = 6;

/** "2026-10" biçiminde, Türkiye takvimine göre ay; n ay geriye. */
export function monthsBack(now: Date, n: number): string[] {
  const [y, m] = istanbulDay(now).slice(0, 7).split("-").map(Number);
  return Array.from({ length: n }, (_, k) => {
    const i = y * 12 + (m - 1) - (n - 1 - k);
    return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`;
  });
}

/**
 * Kurumun gördüğü partilerden (teslim aldığı ya da teslim ettiği, D-016) etki özeti. Parti yoksa null:
 * "0 kg" bir başarı sayısı gibi okunur, kurumun bu akışta hiç kaydı olmadığını söylemez.
 * counterparty: partinin karşı tarafı (üretici için sağlayıcı, sağlayıcı için teslim alan).
 */
export function impactSummary(
  batches: readonly ImpactBatch[],
  productions: readonly ImpactProduction[] | null,
  counterparty: (b: ImpactBatch) => string,
  now: Date,
): Impact | null {
  const resultClass = classOf(batches);
  if (resultClass === null) return null;
  const verifiedRows = batches.filter((b) => b.verified);
  const accepted = (b: ImpactBatch) => acceptedKg(b.weighedKg, b.rejectedKg);
  const verified = kgTotal(verifiedRows.map(accepted));

  const groups = new Map<string, ImpactBatch[]>();
  for (const b of verifiedRows) groups.set(counterparty(b), [...(groups.get(counterparty(b)) ?? []), b]);
  const byCounterparty = [...groups].map(([orgId, rows]): CounterpartyShare => {
    const t = kgTotal(rows.map(accepted));
    const share = t.kg === null || verified.kg === null || verified.kg.isZero() ? null : t.kg.div(verified.kg);
    return { orgId, verified: t, share };
  });
  byCounterparty.sort((a, b) => (b.verified.kg ?? new Decimal(-1)).cmp(a.verified.kg ?? new Decimal(-1)) || a.orgId.localeCompare(b.orgId));

  // Trend ilk kaydın ayından başlar: kurum akışa girmeden önceki aylara "0 kg" yazmak yanıltır.
  const first = istanbulDay(new Date(Math.min(...batches.map((b) => b.receivedAt.getTime())))).slice(0, 7);
  const monthly = monthsBack(now, TREND_MONTHS)
    .filter((month) => month >= first)
    .map((month) => ({
      month,
      verified: kgTotal(verifiedRows.filter((b) => istanbulDay(b.receivedAt).startsWith(month)).map(accepted)),
    }));

  let inPanel: Impact["inPanel"];
  if (productions && productions.length > 0) {
    const reached = productions.filter((p) => p.hasLot);
    const inputs = reached.flatMap((p) => p.inputs);
    inPanel = { ...kgTotal(inputs.map((i) => i.allocatedKg)), resultClass: classOf([...productions, ...inputs])! };
  }

  return {
    batches: batches.length,
    verifiedBatches: verifiedRows.length,
    verified,
    declared: kgTotal(batches.map((b) => b.declaredKg)),
    inPanel,
    byCounterparty,
    monthly,
    resultClass,
  };
}
