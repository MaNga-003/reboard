// Ürün pasaportu (T2.4, D-025): herkese açık görünümün kuralları. Dışarı çıkan alanlar burada tek yerde seçilir.
import { FIBRES, type Fibre } from "../fibre";
import { Decimal } from "../result";
import type { BizStep, ChainAnchor, ChainVerdict, ChainedEvent, EventType, QuantityRef } from "./chain";

/** Lot kodu biçimi (nextCode): PL-yyyy-nnn. Biçime uymayan adres veritabanına gitmeden "yok" sayılır. */
export const isLotCode = (s: string) => /^PL-\d{4}-\d{3,9}$/.test(s);

// Etiket çapası "<sıra>-<64 hex>": QR'daki adreste `a` parametresi. Sıra 1'den başlar; 0 çapası hiçbir şeyi bağlamaz.
const ANCHOR = /^([1-9]\d{0,8})-([0-9a-f]{64})$/i;

export function parseAnchor(s: string | null | undefined): ChainAnchor | null {
  const m = ANCHOR.exec(s ?? "");
  return m ? { count: Number(m[1]), head: m[2].toLowerCase() } : null;
}

export const formatAnchor = (a: ChainAnchor) => `${a.count}-${a.head}`;

/**
 * Lotun etiket çapası: lotu ilk kez çıktı olarak yazan olay. Etikete basılan çapa o anki zinciri bağlar;
 * o olay ya da öncesi sonradan yeniden yazılırsa (bütün hash'ler yeniden hesaplansa bile) çapa uymaz.
 */
export function lotAnchor(events: readonly ChainedEvent[], lotCode: string): ChainAnchor | null {
  const e = events.find((x) => x.payload.outputs.some((q) => q.ref === lotCode));
  return e ? { count: e.seq, head: e.hash } : null;
}

export type AnchorStatus = "missing" | "invalid" | "matched" | "mismatch" | "unchecked";

/**
 * Adresteki etiket çapasının durumu, üretici zincirinin hükmüne göre. Zincir çapadan önce kırıldıysa çapa
 * denetlenemedi demektir ("unchecked"); kırılmayı zincir satırı zaten söyler.
 */
export function anchorStatus(given: string | null, producer: PublicVerdict): AnchorStatus {
  if (given === null) return "missing";
  if (!parseAnchor(given)) return "invalid";
  if (producer.ok) return "matched";
  return producer.reason === "anchor_mismatch" ? "mismatch" : "unchecked";
}

export type ChainRole = "producer" | "supplier" | "buyer";

/** Zincirin lottaki rolü: lotun sahibi üretici, partilerin sağlayıcısı sağlayıcı, lota sonradan dokunan alıcıdır. */
export function chainRole(orgId: string, producerOrgId: string, supplierOrgIds: ReadonlySet<string>): ChainRole {
  if (orgId === producerOrgId) return "producer";
  return supplierOrgIds.has(orgId) ? "supplier" : "buyer";
}

const ROLE_ORDER: Record<ChainRole, number> = { producer: 0, supplier: 1, buyer: 2 };
export const byRole = (a: { role: ChainRole }, b: { role: ChainRole }) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role];

/**
 * Açık hüküm. Adı paylaşılmayan zincirin olay sayısı ve son hash'i yazılmaz: aynı uç iki pasaportta görünürse
 * iki lotu aynı alıcıya bağlar; olay sayısı kurumun iş hacmini sezdirir. Kırılma ise her zaman yerini söyler.
 */
export type PublicVerdict = ChainVerdict | { ok: true };
export const publicVerdict = (v: ChainVerdict, named: boolean): PublicVerdict => (v.ok && !named ? { ok: true } : v);

/** Pasaport ancak en az bir zincir varsa ve hepsi sağlamsa doğrulanmış sayılır. */
export const passportOk = (chains: readonly { verdict: ChainVerdict }[]) => chains.length > 0 && chains.every((c) => c.verdict.ok);

export type PublicEvent = {
  /** Adı paylaşılmayan zincirde null (bkz. publicVerdict). */
  seq: number | null;
  type: EventType;
  bizStep: BizStep;
  eventTime: string;
  inputs: QuantityRef[];
  outputs: QuantityRef[];
  hash: string | null;
};

/**
 * Herkese açık olay: not ve kanıt kimlikleri çıkar, yalnızca lotun soy ağacındaki nesneler kalır.
 * Not serbest metindir, kanıt kimliği iç belgeye götürür; ikisi de kurumun kendi ekranında kalır.
 */
export function publicEvent(e: ChainedEvent, refs: ReadonlySet<string>, named = true): PublicEvent {
  const keep = (qs: QuantityRef[]) => qs.filter((q) => refs.has(q.ref)).map(({ ref, kg }) => ({ ref, kg }));
  return {
    seq: named ? e.seq : null,
    type: e.type,
    bizStep: e.bizStep,
    eventTime: new Date(e.eventTime).toISOString(),
    inputs: keep(e.payload.inputs),
    outputs: keep(e.payload.outputs),
    hash: named ? e.hash : null,
  };
}

export type FibreRow = { fibre: Fibre; kg: Decimal; share: Decimal | null };

/** Lif bileşimi satırları: büyükten küçüğe, bilinmeyen pay en sonda; pay toplam kg'a göre (toplam 0 ise bilinmez). */
export function fibreRows(fibreKg: Record<Fibre, Decimal> | null): FibreRow[] | null {
  if (!fibreKg) return null;
  const total = FIBRES.reduce((a, f) => a.plus(fibreKg[f]), new Decimal(0));
  return FIBRES.filter((f) => fibreKg[f].gt(0))
    .map((f) => ({ fibre: f, kg: fibreKg[f], share: total.isZero() ? null : fibreKg[f].div(total) }))
    .sort((a, b) => Number(a.fibre === "unknown") - Number(b.fibre === "unknown") || b.kg.comparedTo(a.kg));
}
