// Etki ve tedarik paneli (T2.3): depo, demo verisinden alanın beklediği girdileri doğru kurumla toplar.
// Toplamlar burada SQL ile bağımsız olarak yeniden hesaplanır; panel bu sayılarla aynı olmalı.
import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeAll, describe, expect, it } from "vitest";
import { createPgliteDb } from "@/db/client";
import { impactCounter } from "@/db/repo/counter";
import { panelData } from "@/db/repo/panel";
import { seedDemo } from "@/db/seed";
import { DEMO_ORGS, orgIdOf } from "@/db/seed/demo";
import { Decimal } from "@/domain/result";

const NOW = new Date("2026-10-29T15:00:00Z");
const client = new PGlite();
const db = createPgliteDb(client);
const R = orgIdOf(DEMO_ORGS.reboard);
const A = orgIdOf(DEMO_ORGS.a);
const F = orgIdOf(DEMO_ORGS.f);

const one = async (q: ReturnType<typeof sql>) => {
  const res = (await db.execute(q)) as unknown as { rows: Record<string, string | null>[] };
  return res.rows[0];
};

beforeAll(async () => {
  await migrate(db as never, { migrationsFolder: "./drizzle" });
  await seedDemo(db, { now: NOW, env: { DEMO_MODE: "true" } });
}, 60_000);

describe("üretici (ReBoard)", () => {
  it("etki: doğrulanmış, beyan edilen ve panele giren kg SQL toplamlarıyla aynı", async () => {
    const { impact } = await panelData(db, R, NOW);
    const s = await one(sql`
      select
        (select sum(weighed_kg - rejected_kg) from waste_batches where (org_id = ${R} or supplier_org_id = ${R}) and verified) as verified,
        (select sum(declared_kg) from waste_batches where org_id = ${R} or supplier_org_id = ${R}) as declared,
        (select count(*) from waste_batches where (org_id = ${R} or supplier_org_id = ${R}) and verified and (weighed_kg is null or rejected_kg is null)) as unknown,
        (select sum(allocated_kg) from batch_inputs bi join production_batches pb on pb.id = bi.production_batch_id
           where pb.org_id = ${R} and exists (select 1 from panel_lots pl where pl.production_batch_id = pb.id)) as in_panel`);
    expect(impact!.verified.kg!.eq(s.verified!)).toBe(true);
    expect(impact!.verified.unknown).toBe(Number(s.unknown));
    expect(impact!.declared.kg!.eq(s.declared!)).toBe(true);
    expect(impact!.inPanel!.kg!.eq(s.in_panel!)).toBe(true);
    expect(impact!.verified.kg!.lt(impact!.declared.kg!)).toBe(true);
    expect(impact!.byCounterparty.map((r) => r.orgId).sort()).toEqual([A, orgIdOf(DEMO_ORGS.b), orgIdOf(DEMO_ORGS.c)].sort());
    expect(impact!.resultClass).toBe("synthetic");
  });

  it("tedarik: üretime hazır stok doğrulanmış kalan; gün sayısı ÷ 400 kg; yaklaşan teslimler 30 gün içinde", async () => {
    const { supply, names } = await panelData(db, R, NOW);
    const s = await one(sql`
      select sum(w.weighed_kg - w.rejected_kg - coalesce((select sum(allocated_kg) from batch_inputs bi where bi.waste_batch_id = w.id), 0)) as usable
      from waste_batches w where w.org_id = ${R} and w.verified`);
    expect(supply!.usable.kg!.eq(s.usable!)).toBe(true);
    expect(supply!.dailyNeedKg!.toString()).toBe("400");
    expect(supply!.days!.eq(new Decimal(s.usable!).div(400))).toBe(true);
    expect(supply!.thresholds.fromModel).toBe(true);
    expect(supply!.projection!.points).toHaveLength(30);

    const upcoming = await one(sql`
      select count(*) as n from deliveries d join deals x on x.id = d.deal_id join listings l on l.id = x.listing_id
      where x.buyer_org_id = ${R} and l.kind in ('waste_offer', 'waste_request') and d.status = 'planned'
        and d.planned_at + interval '1 day' >= ${NOW.toISOString()}::timestamptz and d.planned_at <= ${NOW.toISOString()}::timestamptz + interval '30 days'`);
    expect(supply!.upcoming).toHaveLength(Number(upcoming.n));
    expect(supply!.upcoming.length).toBeGreaterThan(0);

    // Demo verisinde kantar fişi kontrol bekleyen ve tartımı bekleyen birer parti var; üç kaynak HHI eşiğini aşar.
    const kinds = supply!.alerts.map((a) => a.kind);
    expect(kinds).toEqual(expect.arrayContaining(["pending", "concentration"]));
    expect(supply!.pending.batches).toBe(2);
    expect(supply!.suppliers.every((r) => names.has(r.orgId))).toBe(true);
    expect(supply!.resultClass).toBe("synthetic");
  });
});

describe("kurum sınırı", () => {
  it("sağlayıcı yalnızca kendi teslim ettiği partileri görür; panele giren ve tedarik görünümü yok", async () => {
    const { impact, supply } = await panelData(db, A, NOW);
    const s = await one(sql`select sum(weighed_kg - rejected_kg) as verified from waste_batches where supplier_org_id = ${A} and verified`);
    expect(impact!.verified.kg!.eq(s.verified!)).toBe(true);
    expect(impact!.byCounterparty.map((r) => r.orgId)).toEqual([R]);
    expect(impact!.inPanel).toBeUndefined();
    expect(supply).toBeNull();
  });

  it("panel alıcısının atık partisi ve hammadde teslimi yok: iki bölüm de boş, panel teslimi stoğa girmez", async () => {
    const { impact, supply } = await panelData(db, F, NOW);
    expect(impact).toBeNull();
    expect(supply).toBeNull();
  });
});

describe("herkese açık sayaç (D-013)", () => {
  it("platform genelinde doğrulanmış kabul kg'ı SQL toplamıyla aynı; kurum ayrıntısı taşımaz", async () => {
    const c = await impactCounter(db);
    const s = await one(sql`
      select sum(weighed_kg - rejected_kg) as verified, count(*) as batches,
        count(*) filter (where weighed_kg is null or rejected_kg is null) as unknown
      from waste_batches where verified`);
    expect(c!.verified.kg!.eq(s.verified!)).toBe(true);
    expect(c!.verified.unknown).toBe(Number(s.unknown));
    expect(c!.batches).toBe(Number(s.batches));
    expect(c!.resultClass).toBe("synthetic");
    expect(Object.keys(c!).sort()).toEqual(["batches", "resultClass", "verified"]);
  });
});
