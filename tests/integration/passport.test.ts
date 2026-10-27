// Açık pasaport ve doğrulama ucu (T2.4, D-025) demo verisi üzerinde: sayılar iç lot sayfasıyla aynı, iç bilgi sızmaz,
// tetikleyiciyi atlayıp olay değiştiren saldırgan doğrulamada yakalanır; geçmişi baştan yazan ise etiket çapasında.
import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/pglite/migrator";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GET } from "@/app/api/verify/[lot]/route";
import { createPgliteDb, type Db } from "@/db/client";
import { listCustodyEvents } from "@/db/repo/custody";
import { publicPassport } from "@/db/repo/passport";
import { lotGenealogy } from "@/db/repo/trace";
import { seedDemo } from "@/db/seed";
import { DEMO_ORGS, orgIdOf } from "@/db/seed/demo";
import { formatAnchor, nextEvent, touches, verifyChain, type ChainedEvent } from "@/domain/traceability";

const NOW = new Date("2026-10-29T15:00:00Z");
const client = new PGlite();
const db = createPgliteDb(client);
const R = orgIdOf(DEMO_ORGS.reboard);
const F = orgIdOf(DEMO_ORGS.f);

const rows = async <T,>(q: ReturnType<typeof sql>) => ((await db.execute(q)) as unknown as { rows: T[] }).rows;

/** Tetikleyiciyi kapatıp satırları doğrudan değiştirir: veritabanına tam erişimi olan saldırgan. */
async function bypass(fn: () => Promise<unknown>) {
  await client.query("alter table custody_events disable trigger custody_events_no_update_delete");
  try {
    await fn();
  } finally {
    await client.query("alter table custody_events enable trigger custody_events_no_update_delete");
  }
}

const writeEvent = (e: ChainedEvent) =>
  client.query(`update custody_events set payload = $1, prev_hash = $2, hash = $3 where org_id = $4 and seq = $5`, [
    JSON.stringify(e.payload),
    e.prevHash,
    e.hash,
    e.orgId,
    e.seq,
  ]);

const verify = async (code: string, a?: string) => {
  const url = `http://localhost/api/verify/${code}${a === undefined ? "" : `?a=${encodeURIComponent(a)}`}`;
  const res = await GET(new NextRequest(url), { params: Promise.resolve({ lot: code }) });
  return { status: res.status, headers: res.headers, body: await res.json() };
};

let sold: { id: string; code: string };
let other: { id: string; code: string };

beforeAll(async () => {
  await migrate(db as never, { migrationsFolder: "./drizzle" });
  await seedDemo(db, { now: NOW, env: { DEMO_MODE: "true" } });
  // Route Handler getDb() ile okur; bu testin veritabanını kullansın.
  (globalThis as unknown as { __reboardDb?: Db }).__reboardDb = db;
  const lots = await rows<{ id: string; code: string }>(sql`select id, code from panel_lots order by code`);
  const fEvents = await listCustodyEvents(db, F);
  sold = lots.find((l) => fEvents.some((e) => touches(e, new Set([l.code]))))!;
  other = lots.find((l) => l.code !== sold.code)!;
}, 60_000);
afterAll(() => client.close());

describe("açık pasaport", () => {
  it("satılan lot: üretici, sağlayıcılar ve alıcı zincirleri baştan doğrulanır", async () => {
    const v = (await publicPassport(db, sold.code))!;
    expect(v.ok).toBe(true);
    expect(v.chains[0]).toMatchObject({ role: "producer", name: DEMO_ORGS.reboard.name });
    expect(v.chains.filter((c) => c.role === "supplier").length).toBeGreaterThan(0);
    // Alıcının adı da, zincirinin uzunluğu ve ucu da yazılmaz; yalnızca hüküm.
    expect(v.chains.filter((c) => c.role === "buyer")).toEqual([{ role: "buyer", name: null, verdict: { ok: true } }]);
    // Adı yazılan her zincirin olay sayısı veritabanındaki satır sayısı: kısmi değil, baştan sona.
    for (const c of v.chains.filter((x) => x.name !== null)) {
      if (!("head" in c.verdict)) throw new Error(`${c.name}: hüküm sayısız`);
      const [{ n }] = await rows<{ n: string }>(sql`select count(*) as n from custody_events e join organization o on o.id = e.org_id where o.name = ${c.name}`);
      expect(c.verdict.count).toBe(Number(n));
    }
  });

  it("adı paylaşılmayan zincir başka pasaportlara bağlanamaz: alıcının hash'leri ve sıra numaraları yayımlanmaz", async () => {
    const v = (await publicPassport(db, sold.code))!;
    const out = JSON.stringify(v);
    const fEvents = await listCustodyEvents(db, F);
    expect(fEvents.filter((e) => out.includes(e.hash)).map((e) => e.seq)).toEqual([]);
    const buyer = v.timeline.filter((e) => e.role === "buyer");
    expect(buyer.length).toBeGreaterThan(0);
    expect(buyer.every((e) => e.seq === null && e.hash === null)).toBe(true);
    // Adı yazılan zincirin olayları hash'iyle yayımlanır: dışarıdan çapalanabilir.
    expect(v.timeline.filter((e) => e.role !== "buyer").every((e) => e.hash !== null && e.seq !== null)).toBe(true);
  });

  it("sayılar iç lot sayfasıyla aynı (aynı grafik)", async () => {
    const v = (await publicPassport(db, sold.code))!;
    const inner = (await lotGenealogy(db, R, sold.id))!;
    expect(v.textileKg!.eq(inner.genealogy.textileKg!)).toBe(true);
    expect(v.verifiedTextileKg!.eq(inner.genealogy.verifiedTextileKg!)).toBe(true);
    expect(v.sources.map((s) => s.code)).toEqual(inner.genealogy.sources.map((s) => s.waste.code));
    expect(v.massBalance.withinTolerance).toBe(inner.genealogy.massBalance.withinTolerance);
    const share = v.fibres!.reduce((a, f) => a.plus(f.share!), v.fibres![0].share!.minus(v.fibres![0].share!));
    expect(share.minus(1).abs().lt("1e-20")).toBe(true);
    expect(v.resultClass).toBe("synthetic");
    expect(v.lot.testStatus).toMatch(/^(not_tested|in_progress)$/);
  });

  it("iç bilgi sızmaz: not, kanıt kimliği, kanıt dosya adı, fiyat, alıcının adı yok; olaylar yalnızca soy ağacı nesneleri taşır", async () => {
    const v = (await publicPassport(db, sold.code))!;
    const out = JSON.stringify(v);
    const notes = await rows<{ note: string }>(sql`select distinct payload->>'note' as note from custody_events where payload->>'note' is not null`);
    const evidence = await rows<{ id: string; file_name: string }>(sql`select id, file_name from evidence_register`);
    const prices = await rows<{ p: string }>(sql`select distinct unit_price::text as p from deals where unit_price is not null`);
    const batchNotes = await rows<{ n: string }>(sql`select distinct notes as n from waste_batches where notes is not null`);
    expect(notes.length).toBeGreaterThan(0);
    expect(evidence.length).toBeGreaterThan(0);
    const leaks = [
      ...notes.map((r) => r.note),
      ...evidence.flatMap((r) => [r.id, r.file_name]),
      ...prices.map((r) => r.p),
      ...batchNotes.map((r) => r.n),
      DEMO_ORGS.f.name,
    ].filter((s) => s && out.includes(JSON.stringify(s).slice(1, -1)));
    expect(leaks).toEqual([]);
    const refs = new Set([sold.code, ...v.sources.map((s) => s.code)]);
    const production = v.production.code;
    for (const e of v.timeline) for (const q of [...e.inputs, ...e.outputs]) expect(refs.has(q.ref) || q.ref === production, q.ref).toBe(true);
    expect(v.timeline.length).toBeGreaterThan(0);
  });

  it("profili gizli kurumun (sağlayıcı ya da üretici) adı yazılmaz; açık olmayan lot ve biçimsiz kod yok sayılır", async () => {
    // Lotta gerçekten bulunan bir sağlayıcı: önce adı görünür, profili gizlenince hiçbir alanda görünmez.
    const name = (await publicPassport(db, sold.code))!.chains.find((c) => c.role === "supplier")!.name!;
    const [{ id }] = await rows<{ id: string }>(sql`select id from organization where name = ${name}`);
    await client.query("update org_profiles set is_public = false where org_id = $1", [id]);
    try {
      const v = (await publicPassport(db, sold.code))!;
      expect(JSON.stringify(v).includes(name)).toBe(false);
      expect(v.chains.filter((c) => c.role === "supplier" && c.name === null)).toHaveLength(1);
      expect(v.sources.some((s) => s.supplierName === null)).toBe(true);
      expect(v.chains[0].name).toBe(DEMO_ORGS.reboard.name);
    } finally {
      await client.query("update org_profiles set is_public = true where org_id = $1", [id]);
    }
    // Üretici kendi kurumunu her zaman görür (withTenant); açık pasaportta adı yine yalnızca profili açıksa yazılır.
    await client.query("update org_profiles set is_public = false where org_id = $1", [R]);
    try {
      const v = (await publicPassport(db, sold.code))!;
      expect(v.producerName).toBeNull();
      expect(v.chains[0]).toMatchObject({ role: "producer", name: null });
      expect(JSON.stringify(v).includes(DEMO_ORGS.reboard.name)).toBe(false);
    } finally {
      await client.query("update org_profiles set is_public = true where org_id = $1", [R]);
    }
    await client.query("update panel_lots set is_public = false where id = $1", [other.id]);
    try {
      expect(await publicPassport(db, other.code)).toBeNull();
      expect((await verify(other.code)).status).toBe(404);
    } finally {
      await client.query("update panel_lots set is_public = true where id = $1", [other.id]);
    }
    expect(await publicPassport(db, "PL-1999-999")).toBeNull();
    expect(await publicPassport(db, "'; drop table panel_lots; --")).toBeNull();
  });
});

describe("doğrulama ucu", () => {
  it("sağlam zincirde 200, ok=true; yanıt önbelleğe alınmaz ve her kaynaktan okunur", async () => {
    const r = await verify(sold.code);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ lot: sold.code, ok: true, resultClass: "synthetic", anchorChecked: false });
    expect(r.body.chains.find((c: { role: string }) => c.role === "buyer")).toEqual({ role: "buyer", name: null, ok: true });
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(r.headers.get("access-control-allow-origin")).toBe("*");
    expect(r.body.anchor).toMatch(/^\d+-[0-9a-f]{64}$/);
    expect((await verify(sold.code, r.body.anchor)).body).toMatchObject({ ok: true, anchorChecked: true });
  });

  it("bozuk çapa 400, bilinmeyen lot 404", async () => {
    expect(await verify(sold.code, "zzz")).toMatchObject({ status: 400, body: { error: "anchor_invalid" } });
    expect(await verify(sold.code, "")).toMatchObject({ status: 400 });
    expect(await verify("PL-1999-999")).toMatchObject({ status: 404, body: { error: "not_found" } });
  });

  it("tetikleyiciyi atlayıp sağlayıcının sevk kg'ını değiştiren saldırgan: o zincir brokenAt ile düşer", async () => {
    const supplier = (await publicPassport(db, sold.code))!.chains.find((c) => c.role === "supplier")!;
    const orgId = (await rows<{ id: string }>(sql`select id from organization where name = ${supplier.name}`))[0].id;
    const events = await listCustodyEvents(db, orgId);
    const v0 = (await publicPassport(db, sold.code))!;
    const refs = new Set(v0.sources.map((s) => s.code));
    const target = events.find((e) => touches(e, refs))!;
    const forged = { ...target, payload: { ...target.payload, outputs: target.payload.outputs.map((q) => ({ ...q, kg: "9999.000" })) } };
    await bypass(() => writeEvent(forged));
    try {
      const r = await verify(sold.code);
      expect(r.body.ok).toBe(false);
      expect(r.body.chains.find((c: { name: string }) => c.name === supplier.name)).toEqual({
        role: "supplier",
        name: supplier.name,
        ok: false,
        brokenAt: target.seq,
        reason: "hash_mismatch",
      });
      expect(r.body.chains.filter((c: { ok: boolean }) => !c.ok)).toHaveLength(1);
    } finally {
      await bypass(() => writeEvent(target));
    }
    expect((await verify(sold.code)).body.ok).toBe(true);
  });

  it("üreticinin geçmişini baştan yeniden yazan saldırgan: zincir tutarlı görünür, etiket çapası yakalar", async () => {
    const label = (await verify(sold.code)).body.anchor as string;
    const original = await listCustodyEvents(db, R);
    // İlk olayın kg'ı değişir, sonraki bütün hash'ler yeniden hesaplanır: iç tutarlılık bozulmaz.
    const rewritten: ChainedEvent[] = [];
    for (const [i, e] of original.entries()) {
      const payload = i === 0 ? { ...e.payload, outputs: e.payload.outputs.map((q) => ({ ...q, kg: "1.000" })) } : e.payload;
      rewritten.push(nextEvent(rewritten.at(-1) ?? null, { orgId: e.orgId, type: e.type, bizStep: e.bizStep, eventTime: e.eventTime, payload }));
    }
    expect(verifyChain(rewritten).ok).toBe(true);
    await bypass(async () => {
      for (const e of rewritten) await writeEvent(e);
    });
    try {
      expect((await verify(sold.code)).body.ok).toBe(true);
      const r = await verify(sold.code, label);
      expect(r.body.ok).toBe(false);
      expect(r.body.chains[0]).toMatchObject({ role: "producer", ok: false, reason: "anchor_mismatch", brokenAt: Number(label.split("-")[0]) });
      // Yeniden yazılmış zincirin çapası etikettekinden farklı.
      expect(r.body.anchor).not.toBe(label);
    } finally {
      await bypass(async () => {
        for (const e of original) await writeEvent(e);
      });
    }
    const back = await verify(sold.code, label);
    expect(back.body).toMatchObject({ ok: true, anchor: label });
    expect(formatAnchor({ count: Number(label.split("-")[0]), head: label.split("-")[1] })).toBe(label);
  });
});
