// Gözetim zinciri (D-012): hash = SHA-256(kanonik JSON ∥ önceki hash), zincir organizasyon başına.
// @noble/hashes eşzamanlı ve tarayıcıda da çalışır; pasaport doğrulaması istemcide tekrarlanabilir.
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { canonicalJson } from "./canonical";

export const GENESIS_HASH = "0".repeat(64);

export const EVENT_TYPES = ["object", "transformation", "transaction"] as const;
export type EventType = (typeof EVENT_TYPES)[number];
export const BIZ_STEPS = ["receiving", "inspecting", "commissioning", "shipping", "transforming", "accepting"] as const;
export type BizStep = (typeof BIZ_STEPS)[number];

/** EPCIS quantityList karşılığı: nesne kodu ve 3 ondalıklı kg metni. */
export type QuantityRef = { ref: string; kg: string };

export type EventPayload = {
  inputs: QuantityRef[];
  outputs: QuantityRef[];
  evidenceIds: string[];
  note?: string;
};

/** Hash'e giren her şey. Kolonlar da içeride: tür, adım, zaman ya da sıra değişirse hash de değişir. */
export type EventBody = {
  orgId: string;
  seq: number;
  type: EventType;
  bizStep: BizStep;
  eventTime: Date | string;
  payload: EventPayload;
};

export type ChainedEvent = EventBody & { prevHash: string; hash: string };

const isoTime = (t: Date | string) => {
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) throw new RangeError(`Geçersiz olay zamanı: ${String(t)}`);
  return d.toISOString();
};

export function hashEvent(body: EventBody, prevHash: string): string {
  const { orgId, seq, type, bizStep, eventTime, payload } = body;
  const canonical = canonicalJson({ orgId, seq, type, bizStep, eventTime: isoTime(eventTime), payload });
  return bytesToHex(sha256(utf8ToBytes(canonical + prevHash)));
}

/** Zincirin ucuna yeni olay ekler. İlk olayın sırası 1, önceki hash'i GENESIS_HASH'tir. */
export function nextEvent(tip: Pick<ChainedEvent, "orgId" | "seq" | "hash"> | null, body: Omit<EventBody, "seq">): ChainedEvent {
  if (tip && tip.orgId !== body.orgId) throw new Error(`Zincir organizasyonu farklı: ${tip.orgId} ≠ ${body.orgId}`);
  const seq = tip ? tip.seq + 1 : 1;
  const prevHash = tip ? tip.hash : GENESIS_HASH;
  const full = { ...body, seq };
  return { ...full, prevHash, hash: hashEvent(full, prevHash) };
}

export type ChainBreak = "seq_gap" | "org_mismatch" | "prev_hash_mismatch" | "hash_mismatch" | "anchor_mismatch";
export type ChainVerdict = { ok: true; count: number; head: string } | { ok: false; brokenAt: number; reason: ChainBreak };

/** Dışarıda yayımlanan kontrol noktası: o an zincirde `count` olay vardı ve sonuncusunun hash'i `head` idi. */
export type ChainAnchor = { count: number; head: string };

/**
 * Bir organizasyonun zincirini baştan doğrular. Olaylar sıra numarasına göre artan verilir.
 * Zincirin sonundan olay silinmesi ya da bütün hash'lerin yeniden hesaplanması zincirden tek başına
 * anlaşılamaz; bunları çapa yakalar. Zincir çapadan sonra büyümüş olabilir, bu bir kırılma değildir.
 */
export function verifyChain(events: readonly ChainedEvent[], anchor?: ChainAnchor): ChainVerdict {
  let prev = GENESIS_HASH;
  const orgId = events[0]?.orgId;
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    const at = i + 1;
    if (e.seq !== at) return { ok: false, brokenAt: at, reason: "seq_gap" };
    if (e.orgId !== orgId) return { ok: false, brokenAt: at, reason: "org_mismatch" };
    if (e.prevHash !== prev) return { ok: false, brokenAt: at, reason: "prev_hash_mismatch" };
    if (hashEvent(e, e.prevHash) !== e.hash) return { ok: false, brokenAt: at, reason: "hash_mismatch" };
    prev = e.hash;
  }
  if (anchor) {
    if (events.length < anchor.count) return { ok: false, brokenAt: events.length + 1, reason: "anchor_mismatch" };
    const anchored = anchor.count === 0 ? GENESIS_HASH : events[anchor.count - 1].hash;
    if (anchored !== anchor.head) return { ok: false, brokenAt: Math.max(anchor.count, 1), reason: "anchor_mismatch" };
  }
  return { ok: true, count: events.length, head: prev };
}
