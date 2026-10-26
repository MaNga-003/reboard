// Gözetim zinciri deposu. Hash ve sıra alan katmanında (nextEvent) hesaplanır; burası yalnızca okur ve ekler.
// Aynı anda iki ekleme aynı ucu okursa (org_id, seq) benzersizliği ikincisini reddeder; ekleme yeniden denenir.
import { asc, desc, eq } from "drizzle-orm";
import { nextEvent, type ChainedEvent, type EventBody, type EventPayload } from "../../domain/traceability";
import type { Db } from "../client";
import { custodyEvents } from "../schema";

type Row = typeof custodyEvents.$inferSelect;

const toChained = (r: Row): ChainedEvent => ({
  orgId: r.orgId,
  seq: r.seq,
  type: r.type,
  bizStep: r.bizStep,
  eventTime: r.eventTime,
  payload: r.payload as EventPayload,
  prevHash: r.prevHash,
  hash: r.hash,
});

const isSeqConflict = (e: unknown) => {
  const cause = (e as { cause?: unknown })?.cause ?? e;
  return (cause as { code?: string })?.code === "23505" && String((cause as { message?: string }).message).includes("custody_events_org_seq");
};

export async function appendCustodyEvent(db: Db, body: Omit<EventBody, "seq">, attempts = 3): Promise<ChainedEvent> {
  for (let i = 1; ; i++) {
    try {
      return await db.transaction(async (tx) => {
        const [tip] = await tx.select().from(custodyEvents).where(eq(custodyEvents.orgId, body.orgId)).orderBy(desc(custodyEvents.seq)).limit(1);
        const ev = nextEvent(tip ? toChained(tip) : null, body);
        await tx.insert(custodyEvents).values({
          orgId: ev.orgId,
          seq: ev.seq,
          type: ev.type,
          bizStep: ev.bizStep,
          eventTime: new Date(ev.eventTime),
          payload: ev.payload,
          prevHash: ev.prevHash,
          hash: ev.hash,
        });
        return ev;
      });
    } catch (e) {
      if (i >= attempts || !isSeqConflict(e)) throw e;
    }
  }
}

export async function listCustodyEvents(db: Db, orgId: string): Promise<ChainedEvent[]> {
  const rows = await db.select().from(custodyEvents).where(eq(custodyEvents.orgId, orgId)).orderBy(asc(custodyEvents.seq));
  return rows.map(toChained);
}
