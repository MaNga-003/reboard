// M-20: sentetik demo verisi (T1.4). Seed gerçek migrasyonlarla PGlite'a yüklenir, sonra veritabanından okunup ölçülür.
import { PGlite } from "@electric-sql/pglite";
import { asc } from "drizzle-orm";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPgliteDb } from "@/db/client";
import * as schema from "@/db/schema";
import { panelData, type PanelData } from "@/db/repo/panel";
import { publicPassport } from "@/db/repo/passport";
import { saasCostData } from "@/db/repo/saas";
import { withTenant } from "@/db/repo/tenant";
import { appTables, buildDemo, seedDemo, seedPrices } from "@/db/seed";
import { DEMO_ORGS, DEMO_USERS, demoId, orgIdOf } from "@/db/seed/demo";
import { istanbulDay } from "@/domain/market";
import { Decimal } from "@/domain/result";
import { balanceNoteMissing, genealogy, massBalance, verifyChain, type ChainedEvent } from "@/domain/traceability";

const NOW = new Date("2026-10-29T15:00:00Z");
const ENV = { DEMO_MODE: "true" };
const client = new PGlite();
const db = createPgliteDb(client);
let counts: Record<string, number>;

const count = async (table: string) => (await client.query<{ n: number }>(`select count(*)::int as n from "${table}"`)).rows[0].n;

beforeAll(async () => {
  await migrate(db as never, { migrationsFolder: "./drizzle" });
  counts = await seedDemo(db, { now: NOW, password: "seed-test-parolasi", env: ENV });
}, 60_000);
afterAll(() => client.close());

describe("demo seed", () => {
  it("DEMO_MODE kapalıyken çalışmaz ve hiçbir şeye dokunmaz", async () => {
    const before = await count("waste_batches");
    await expect(seedDemo(db, { now: NOW, env: {} })).rejects.toThrow(/DEMO_MODE/);
    expect(await count("waste_batches")).toBe(before);
  });

  it("oturum, doğrulama ve davet dışında her tablo dolu", async () => {
    const empty: string[] = [];
    for (const t of appTables()) if ((await count(t)) === 0) empty.push(t);
    expect(empty.sort()).toEqual(["invitation", "session", "verification"]);
  });

  it("hedef sayılar: 3 kaynak, 2 taşıyıcı, 2 alıcı, 1 üretici", async () => {
    const rows = await db.select({ kind: schema.orgProfiles.kind }).from(schema.orgProfiles);
    const by = (k: string) => rows.filter((r) => r.kind === k).length;
    expect(by("textile_factory") + by("municipality") + by("recycler")).toBe(3);
    expect(by("carrier")).toBe(2);
    expect(by("panel_buyer")).toBe(2);
    expect(by("producer")).toBe(1);
  });

  it("demo kayıtları synthetic; yalnızca doğrulanmış kaynaklı değerler sourced_estimate", async () => {
    const wrong: string[] = [];
    for (const t of appTables()) {
      const has = await client.query(`select 1 from information_schema.columns where table_name = $1 and column_name = 'result_class'`, [t]);
      if (!has.rows.length) continue;
      const expected = t === "reference_values" || t === "saas_costs" ? "sourced_estimate" : "synthetic";
      const { rows } = await client.query<{ c: string; n: number }>(`select result_class as c, count(*)::int as n from "${t}" group by 1`);
      for (const r of rows) if (r.c !== expected) wrong.push(`${t}: ${r.n} satır ${r.c}`);
    }
    expect(wrong).toEqual([]);
  });

  it("kaynaklı değerlerin hepsi https kaynak bağlantısı ve okunma tarihi taşır", async () => {
    const refs = await db.select().from(schema.referenceValues);
    const costs = await db.select().from(schema.saasCosts);
    for (const r of [...refs, ...costs]) {
      expect(r.sourceUrl, JSON.stringify(r)).toMatch(/^https:\/\//);
      expect(r.retrievedAt).toBeInstanceOf(Date);
    }
    expect(refs.map((r) => r.key).sort()).toEqual([
      "electricity_tl_kwh_2026h1",
      "eurostat_tr_textile_waste_2022",
      "ibb_gate_fee_komurcuoda",
      "ibb_gate_fee_seymen",
      "mdf_18mm_sheet_max",
      "mdf_18mm_sheet_min",
      "particleboard_18mm_sheet_max",
      "particleboard_18mm_sheet_min",
      "sheet_area_m2",
      "usd_try",
    ]);
  });

  it("her organizasyonun gözetim zinciri veritabanından okununca doğrulanır", async () => {
    const rows = await db.select().from(schema.custodyEvents).orderBy(asc(schema.custodyEvents.orgId), asc(schema.custodyEvents.seq));
    const byOrg = Map.groupBy(rows, (r) => r.orgId);
    expect(byOrg.size).toBeGreaterThanOrEqual(5);
    for (const [org, events] of byOrg) {
      const verdict = verifyChain(events as unknown as ChainedEvent[]);
      expect(verdict, org).toMatchObject({ ok: true, count: events.length });
    }
  });

  it("her üretim partisi kütle dengesinde; tolerans aşılırsa açıklama var", async () => {
    const productions = await db.select().from(schema.productionBatches);
    const inputs = await db.select().from(schema.batchInputs);
    let exceeded = 0;
    for (const p of productions) {
      const mb = massBalance({
        inputsKg: inputs.filter((i) => i.productionBatchId === p.id).map((i) => i.allocatedKg),
        outputKg: p.outputKg,
        scrapKg: p.scrapKg,
        moistureLossKg: p.moistureLossKg,
      });
      expect(mb.withinTolerance, p.code).not.toBeNull();
      expect(balanceNoteMissing(mb, p.balanceNote), p.code).toBe(false);
      if (mb.noteRequired) exceeded++;
    }
    // Arayüzün açıklama yolunu göstermek için bir örnek bilerek toleransı aşar.
    expect(exceeded).toBe(1);
  });

  it("tahsis yalnızca doğrulanmış partilerden ve kabul edilen kg'ı aşmadan yapılır", async () => {
    const wastes = await db.select().from(schema.wasteBatches);
    const inputs = await db.select().from(schema.batchInputs);
    const productions = await db.select().from(schema.productionBatches);
    // Üretimden sonra gelen parti o üretime girmiş olamaz.
    for (const i of inputs) {
      const w = wastes.find((x) => x.id === i.wasteBatchId)!;
      const p = productions.find((x) => x.id === i.productionBatchId)!;
      expect(w.receivedAt < p.startedAt, `${w.code} → ${p.code}`).toBe(true);
    }
    for (const w of wastes) {
      const allocated = inputs.filter((i) => i.wasteBatchId === w.id).reduce((a, i) => a.plus(i.allocatedKg), new Decimal(0));
      if (!w.verified) {
        expect(allocated.isZero(), w.code).toBe(true);
        continue;
      }
      const accepted = new Decimal(w.weighedKg!).minus(w.rejectedKg!);
      expect(allocated.lte(accepted), `${w.code}: ${allocated} > ${accepted}`).toBe(true);
    }
  });

  it("panel lotundan atık partilerine soy ağacı kurulur", async () => {
    const [lots, productions, allocations, wastes] = await Promise.all([
      db.select().from(schema.panelLots),
      db.select().from(schema.productionBatches),
      db.select().from(schema.batchInputs),
      db.select().from(schema.wasteBatches),
    ]);
    for (const lot of lots) {
      const g = genealogy(lot.id, { lots, productions, allocations, wastes });
      expect(g.sources.length, lot.code).toBeGreaterThan(0);
      expect(g.verifiedTextileKg?.gt(0), lot.code).toBe(true);
    }
  });

  it("bilinmeyen değer null kalır, 0 yazılmaz", async () => {
    const unweighed = await db.select().from(schema.wasteBatches);
    expect(unweighed.some((w) => w.weighedKg === null && !w.verified)).toBe(true);
    const costs = await db.select().from(schema.costLines);
    expect(costs.some((c) => c.category === "binder" && c.amount === null && c.unitCost === null)).toBe(true);
    const baseline = await db.select().from(schema.supplierBaseline);
    expect(baseline.some((b) => b.disposalCost === null)).toBe(true);
  });

  it("mesafeler yalnızca kuş uçuşu", async () => {
    const quotes = await db.select().from(schema.transportQuotes);
    expect(quotes.length).toBeGreaterThan(0);
    for (const q of quotes) expect(q.distanceKind).toBe("crow_flies");
  });

  it("ileriye dönük planlı teslimler var (tedarik projeksiyonu için)", async () => {
    const planned = await db.select().from(schema.deliveries);
    expect(planned.filter((d) => d.status === "planned" && d.plannedAt > NOW).length).toBeGreaterThanOrEqual(6);
  });

  it("demo hesaplarının parolası düz metin tutulmaz", async () => {
    const accounts = await db.select().from(schema.account);
    expect(accounts).toHaveLength(DEMO_USERS.length);
    for (const a of accounts) {
      expect(a.providerId).toBe("credential");
      expect(a.password).not.toContain("seed-test-parolasi");
    }
  });

  it("aynı now ile belirlenimci; kimlikler günden güne sabit", () => {
    expect(JSON.stringify(buildDemo(NOW))).toBe(JSON.stringify(buildDemo(NOW)));
    const tomorrow = buildDemo(new Date(NOW.getTime() + 86_400_000));
    expect(tomorrow.panelLots.map((l) => l.id)).toEqual(buildDemo(NOW).panelLots.map((l) => l.id));
    expect(demoId("lot:x")).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("ikinci yükleme önce sıfırlar: satır sayıları ve zincir başı aynı kalır", async () => {
    const head = async () => (await client.query<{ h: string }>(`select string_agg(hash, ',' order by org_id, seq) as h from custody_events`)).rows[0].h;
    const before = await head();
    const again = await seedDemo(db, { now: NOW, env: ENV });
    // Parolasız yüklemede hesap satırı olmaz; diğer sayılar aynı kalır.
    expect(again).toEqual(Object.fromEntries(Object.entries(counts).filter(([k]) => k !== "account")));
    expect(await count("account")).toBe(0);
    expect(await head()).toBe(before);
  });

  it("SaaS gider tablosu depodan okunur: her kurum iki kurulumu, satırların kaynağını ve kuru görür (T2.6)", async () => {
    const orgs = await db.select({ id: schema.organization.id }).from(schema.organization);
    for (const { id } of orgs) {
      const d = await saasCostData(withTenant(db, id));
      expect(d.stages.map((s) => s.stage)).toEqual(["demo", "commercial"]);
      expect(d.usdTry?.value).toBe("49.552300");
      expect(d.rows.size).toBe(buildDemo(NOW).saasCosts.length);
      const commercial = d.stages[1];
      expect(commercial.monthly.atLeast?.toString()).toBe("991.046");
      expect(commercial.monthly.unknown).toEqual(["domain"]);
      expect(d.rows.get("neon_launch_compute")?.unitPrice).toBe("0.106000");
    }
  });

  it("fiyat yenileme yalnızca saas_costs satırlarını değiştirir; zincir ve öbür tablolar aynı kalır", async () => {
    const head = async () => (await client.query<{ h: string }>(`select string_agg(hash, ',' order by org_id, seq) as h from custody_events`)).rows[0].h;
    const others = appTables().filter((t) => t !== "saas_costs");
    const snapshot = async () => Object.fromEntries(await Promise.all(others.map(async (t) => [t, await count(t)] as const)));
    const [h0, c0] = [await head(), await snapshot()];
    const ids0 = (await db.select({ id: schema.saasCosts.id }).from(schema.saasCosts)).map((r) => r.id);
    expect(await seedPrices(db, NOW)).toBe(buildDemo(NOW).saasCosts.length);
    expect(await head()).toBe(h0);
    expect(await snapshot()).toEqual(c0);
    const ids1 = (await db.select({ id: schema.saasCosts.id }).from(schema.saasCosts)).map((r) => r.id);
    expect(ids1).toHaveLength(ids0.length);
    expect(ids1.filter((i) => ids0.includes(i))).toEqual([]);
  });

  it("sıfırlama dışında TRUNCATE hâlâ reddedilir", async () => {
    await expect(client.query("truncate custody_events")).rejects.toThrow(/yalnızca eklenir/);
  });

  // D-030: basılı QR'daki çapa, aynı UTC günüyle yapılan yeniden yüklemeden sonra da tutar; başka gün tutmaz.
  // Sonda NOW ile yeniden yüklenir: dosyadaki öbür testlerin verisi değişmez.
  it("aynı seed günüyle sıfırlama etiket çapasını korur, ertesi gün korumaz", async () => {
    const code = buildDemo(NOW).panelLots[0].code;
    const before = (await publicPassport(db, code))!;
    expect(before.ok).toBe(true);
    const label = before.anchor!;
    const sameDay = new Date(NOW.getTime() + 5 * 3600_000);
    expect(sameDay.toISOString().slice(0, 10)).toBe(NOW.toISOString().slice(0, 10));
    await seedDemo(db, { now: sameDay, env: ENV });
    const kept = (await publicPassport(db, code, label))!;
    expect(kept).toMatchObject({ ok: true, anchorChecked: true });
    await seedDemo(db, { now: new Date(NOW.getTime() + 24 * 3600_000), env: ENV });
    const next = (await publicPassport(db, code, label))!;
    expect(next.ok).toBe(false);
    expect(next.chains.find((c) => c.role === "producer")!.verdict).toMatchObject({ ok: false, reason: "anchor_mismatch" });
    await seedDemo(db, { now: NOW, password: "seed-test-parolasi", env: ENV });
    expect((await publicPassport(db, code, label))!.ok).toBe(true);
  });

  // D-030: seed sunumdan bir gün önce yüklenir, panel ise gerçek saatle hesaplar. Ertesi İstanbul günü boyunca düzey,
  // uyarılar ve teslimler seed anındakiyle aynı kalmalı. En yakın planlı teslim +2 günde, gecikme toleransı 24 saat;
  // biri öne çekilirse ya da stok zamanla azalmaya başlarsa burada düşer.
  it("seed gününden sonraki İstanbul günü boyunca üreticinin paneli değişmez (sunum günü)", async () => {
    const org = orgIdOf(DEMO_ORGS.reboard);
    const print = ({ supply, impact }: PanelData) => ({
      level: supply?.level,
      days: supply?.days?.toFixed(2),
      upcoming: supply?.upcoming.map((d) => d.plannedAt.toISOString()),
      alerts: supply?.alerts.map((a) => `${a.kind}:${a.level}${"day" in a ? `@${a.day}` : ""}`),
      onTime: supply?.suppliers.map((s) => `${s.orgId}:${s.onTime.rate?.toFixed(3)}`),
      hhi: supply?.hhi?.toFixed(0),
      monthly: JSON.stringify(impact?.monthly),
    });
    const base = print(await panelData(db, org, NOW));
    expect(base.alerts?.length).toBeGreaterThan(0);
    const nextDay = new Date(`${istanbulDay(NOW)}T00:00:00+03:00`).getTime() + 24 * 3600_000;
    for (const h of [0, 9, 18, 23.99]) {
      const at = new Date(nextDay + h * 3600_000);
      expect(print(await panelData(db, org, at)), at.toISOString()).toEqual(base);
    }
  });
});
