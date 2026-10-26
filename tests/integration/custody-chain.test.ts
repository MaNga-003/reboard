// M-6: zincir veritabanı gidiş-dönüşünden (jsonb, timestamptz) sağlam çıkar. Tetikleyiciyi atlayabilen
// bir saldırganın yaptığı değişiklik de verifyChain'de yakalanır.
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPgliteDb } from "@/db/client";
import { appendCustodyEvent, listCustodyEvents } from "@/db/repo/custody";
import { kgText, nextEvent, verifyChain, type ChainedEvent, type EventBody } from "@/domain/traceability";

const client = new PGlite();
const db = createPgliteDb(client);

const body = (orgId: string, i: number): Omit<EventBody, "seq"> => ({
  orgId,
  type: i % 3 === 0 ? "transformation" : "object",
  bizStep: i % 3 === 0 ? "transforming" : "receiving",
  eventTime: new Date(Date.UTC(2026, 9, 27, 8, 0, i, 123)),
  payload: {
    inputs: [{ ref: `WB-${i}`, kg: kgText(1250.5 + i) }],
    outputs: i % 3 === 0 ? [{ ref: `PB-${i}`, kg: kgText(1200.25) }] : [],
    evidenceIds: [],
    note: "İpek ayıklandı — ğüşıöç “tırnak” \\ ters bölü",
  },
});

/** Tetikleyiciyi kapatıp satırı doğrudan değiştirir: veritabanına tam erişimi olan saldırgan. */
async function bypass(sql: string, params: unknown[] = []) {
  await client.query("alter table custody_events disable trigger custody_events_no_update_delete");
  try {
    await client.query(sql, params);
  } finally {
    await client.query("alter table custody_events enable trigger custody_events_no_update_delete");
  }
}

beforeAll(async () => {
  await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
  for (const o of ["org-a", "org-b", "org-c", "org-d", "org-e"]) {
    await client.query(`insert into organization (id, name, slug) values ($1, $1, $1)`, [o]);
  }
});
afterAll(() => client.close());

describe("custody_events gidiş-dönüşü", () => {
  it("jsonb ve timestamptz'den okunan zincir doğrulanır; organizasyon zincirleri ayrıdır", async () => {
    for (let i = 1; i <= 6; i++) {
      await appendCustodyEvent(db, body("org-a", i));
      if (i % 2 === 0) await appendCustodyEvent(db, body("org-b", i));
    }
    const a = await listCustodyEvents(db, "org-a");
    const b = await listCustodyEvents(db, "org-b");
    expect(verifyChain(a)).toMatchObject({ ok: true, count: 6 });
    expect(verifyChain(b)).toMatchObject({ ok: true, count: 3 });
    expect(a[0].prevHash).toBe("0".repeat(64));
    expect(b[0].seq).toBe(1);
  });

  it("aynı anda gelen eklemeler zinciri çatallamaz", async () => {
    await Promise.all(Array.from({ length: 8 }, (_, i) => appendCustodyEvent(db, body("org-c", i + 1))));
    const c = await listCustodyEvents(db, "org-c");
    expect(c.map((e) => e.seq)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(verifyChain(c).ok).toBe(true);
  });

  it("sıra çakışması yeniden denenir; denemeler biterse hata yükselir", async () => {
    // Uçtaki olay bilinerek aynı sıra numarasıyla doğrudan yazılır: çatallanma girişimi.
    const tip = (await listCustodyEvents(db, "org-c")).at(-1)!;
    const fork = nextEvent({ ...tip, seq: tip.seq - 1 }, body("org-c", 99));
    await expect(
      client.query(
        `insert into custody_events (org_id, seq, type, biz_step, event_time, payload, prev_hash, hash) values ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [fork.orgId, fork.seq, fork.type, fork.bizStep, new Date(fork.eventTime), JSON.stringify(fork.payload), fork.prevHash, fork.hash],
      ),
    ).rejects.toThrow(/custody_events_org_seq/);
    expect(verifyChain(await listCustodyEvents(db, "org-c")).ok).toBe(true);
  });
});

describe("tetikleyiciyi atlayan saldırgan", () => {
  it("bir olayın kg'ını değiştirirse o olayda yakalanır", async () => {
    for (let i = 1; i <= 5; i++) await appendCustodyEvent(db, body("org-d", i));
    await bypass(`update custody_events set payload = jsonb_set(payload, '{inputs,0,kg}', '"9999.000"') where org_id = 'org-d' and seq = 3`);
    expect(verifyChain(await listCustodyEvents(db, "org-d"))).toEqual({ ok: false, brokenAt: 3, reason: "hash_mismatch" });
  });

  it("hash'i de yeniden hesaplarsa bir sonraki olayda; bütün sonrakileri yeniden yazarsa çapada yakalanır", async () => {
    for (let i = 1; i <= 5; i++) await appendCustodyEvent(db, body("org-e", i));
    const before = await listCustodyEvents(db, "org-e");
    const anchor = { count: before.length, head: before.at(-1)!.hash };

    // 3. olay değiştirilir, kendi hash'i yeniden hesaplanır.
    const forged = (prev: ChainedEvent, e: ChainedEvent, kg?: string) =>
      nextEvent(prev, { ...e, payload: kg ? { ...e.payload, inputs: [{ ref: e.payload.inputs[0].ref, kg }] } : e.payload });
    const e3 = forged(before[1], before[2], "9999.000");
    await bypass(`update custody_events set payload = $1, hash = $2 where org_id = 'org-e' and seq = 3`, [JSON.stringify(e3.payload), e3.hash]);
    expect(verifyChain(await listCustodyEvents(db, "org-e"))).toEqual({ ok: false, brokenAt: 4, reason: "prev_hash_mismatch" });

    // Sonraki olaylar da yeniden zincirlenir: zincir kendi içinde tutarlı, yalnızca çapa yakalar.
    let prev = e3;
    for (const e of before.slice(3)) {
      const re = forged(prev, e);
      await bypass(`update custody_events set prev_hash = $1, hash = $2 where org_id = 'org-e' and seq = $3`, [re.prevHash, re.hash, re.seq]);
      prev = re;
    }
    const after = await listCustodyEvents(db, "org-e");
    expect(verifyChain(after).ok).toBe(true);
    expect(verifyChain(after, anchor)).toEqual({ ok: false, brokenAt: 5, reason: "anchor_mismatch" });
  });
});
