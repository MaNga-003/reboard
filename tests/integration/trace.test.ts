// İzlenebilirlik (T2.2): teslim alma → tartım → kanıt → kontrol → üretim → soy ağacı, gerçek migrasyonlar ve demo verisiyle.
// Kurallar, kiracı sınırı, zincirin sağlamlığı ve eşzamanlı tahsis burada ölçülür.
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPgliteDb } from "@/db/client";
import { listCustodyEvents } from "@/db/repo/custody";
import { acceptOffer, createListing, listingDetail, placeOffer } from "@/db/repo/market";
import { TenantAccessError } from "@/db/repo/tenant";
import {
  checkEvidence,
  createProduction,
  evidenceFile,
  lotGenealogy,
  receivableDeliveries,
  receiveDelivery,
  stock,
  traceOverview,
  uploadEvidence,
  wasteBatchDetail,
  type NewProduction,
  type NewReceipt,
} from "@/db/repo/trace";
import { deliveries, evidenceRegister, listings, wasteBatches } from "@/db/schema";
import { seedDemo } from "@/db/seed";
import { DEMO_ORGS, orgIdOf, userIdOf } from "@/db/seed/demo";
import { Decimal } from "@/domain/result";
import { verifyChain } from "@/domain/traceability";

const NOW = new Date("2026-10-29T15:00:00Z");
const client = new PGlite();
const db = createPgliteDb(client);
const R = orgIdOf(DEMO_ORGS.reboard);
const G = orgIdOf(DEMO_ORGS.g);
const actor = { orgId: R, userId: userIdOf(DEMO_ORGS.reboard) };
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4, 5]);
const rule = (code: string) => expect.objectContaining({ name: "TraceRuleError", code });

const receipt = (o: Partial<NewReceipt> = {}): NewReceipt => ({
  declaredKg: "500",
  weighedKg: "490",
  moisturePct: "6.5",
  rejectedKg: "12",
  containsSilk: false,
  composition: { cotton: 60, polyester: 40 },
  notes: null,
  ...o,
});
const production = (inputs: NewProduction["inputs"], o: Partial<NewProduction> = {}): NewProduction => {
  const total = inputs.reduce((a, i) => a.plus(i.kg), new Decimal(0));
  return {
    inputs,
    outputKg: total.times(0.9).toFixed(3),
    scrapKg: total.times(0.05).toFixed(3),
    moistureLossKg: total.times(0.05).toFixed(3),
    balanceNote: null,
    sheetCount: 4,
    densityKgM3: "650",
    binder: "pet_copet",
    ...o,
  };
};

beforeAll(async () => {
  await migrate(db as never, { migrationsFolder: "./drizzle" });
  await seedDemo(db, { now: NOW, env: { DEMO_MODE: "true" } });
}, 60_000);
afterAll(() => client.close());

describe("akış: teslim al, tart, kanıtla, üret, soy ağacında gör", () => {
  let batchId = "";
  let code = "";
  let supplier = "";
  let lotId = "";

  it("üretici planlı teslimi teslim alır: parti açılır, teslim kapanır, kabul ve ayıklama zincire girer", async () => {
    const open = await receivableDeliveries(db, R);
    expect(open.length).toBeGreaterThan(0);
    expect(open.every((d) => d.status === "planned")).toBe(true);
    const target = open[0];
    supplier = target.sellerOrgId;
    const before = (await listCustodyEvents(db, R)).length;

    const got = await receiveDelivery(db, actor, target.id, receipt(), NOW);
    batchId = got.id;
    code = got.code;
    expect(code).toMatch(/^WB-2026-\d{4}$/);

    const [b] = await db.select().from(wasteBatches).where(eq(wasteBatches.id, batchId));
    expect(b).toMatchObject({ orgId: R, supplierOrgId: supplier, deliveryId: target.id, weighedKg: "490.000", rejectedKg: "12.000", verified: false, resultClass: "synthetic" });
    const [d] = await db.select().from(deliveries).where(eq(deliveries.id, target.id));
    expect(d).toMatchObject({ status: "delivered", deliveredAt: NOW });

    const events = await listCustodyEvents(db, R);
    expect(events.slice(before).map((e) => e.bizStep)).toEqual(["receiving", "inspecting"]);
    expect(events.at(-1)!.payload.outputs).toEqual([{ ref: code, kg: "478.000" }]);
    expect(verifyChain(events).ok).toBe(true);

    // Aynı teslim ikinci kez alınamaz; sağlayıcı kendi teslimini alamaz.
    await expect(receiveDelivery(db, actor, target.id, receipt(), NOW)).rejects.toEqual(rule("delivery_not_open"));
    const second = open[1];
    await expect(receiveDelivery(db, { orgId: second.sellerOrgId, userId: "x" }, second.id, receipt(), NOW)).rejects.toBeInstanceOf(TenantAccessError);
  });

  it("kabul kuralları depoda da uygulanır", async () => {
    const [next] = await receivableDeliveries(db, R);
    await expect(receiveDelivery(db, actor, next.id, receipt({ rejectedKg: "491" }), NOW)).rejects.toEqual(rule("rejected_exceeds"));
    await expect(receiveDelivery(db, actor, next.id, receipt({ containsSilk: true, rejectedKg: "0" }), NOW)).rejects.toEqual(rule("silk_not_rejected"));
    const [d] = await db.select().from(deliveries).where(eq(deliveries.id, next.id));
    expect(d.status).toBe("planned");
  });

  it("kanıt yüklenir: tür baytlardan, özet zincirde; başka kurum yükleyemez ve indiremez", async () => {
    await expect(uploadEvidence(db, { orgId: G, userId: "x" }, { wasteBatchId: batchId, kind: "weighbridge_ticket", fileName: "a.png", bytes: PNG }, NOW)).rejects.toBeInstanceOf(
      TenantAccessError,
    );
    const html = new TextEncoder().encode("<html><script>alert(1)</script></html>");
    await expect(uploadEvidence(db, actor, { wasteBatchId: batchId, kind: "weighbridge_ticket", fileName: "fis.png", bytes: html }, NOW)).rejects.toEqual(rule("file_type"));

    const id = await uploadEvidence(db, actor, { wasteBatchId: batchId, kind: "weighbridge_ticket", fileName: "C:\\fakepath\\kantar.png", bytes: PNG }, NOW);
    const [ev] = await db.select().from(evidenceRegister).where(eq(evidenceRegister.id, id));
    expect(ev).toMatchObject({ orgId: R, mime: "image/png", fileName: "kantar.png", sizeBytes: PNG.length, sha256: bytesToHex(sha256(PNG)), status: "declared", period: "2026-10" });
    const file = await evidenceFile(db, R, id);
    expect(Array.from(file!.bytes)).toEqual(Array.from(PNG));
    expect(await evidenceFile(db, G, id)).toBeNull();
    expect(await evidenceFile(db, supplier, id)).toBeNull();

    const last = (await listCustodyEvents(db, R)).at(-1)!;
    expect(last.payload.evidenceIds).toEqual([id]);
    expect(last.payload.note).toContain(bytesToHex(sha256(PNG)));
    // Yüklemek doğrulamaz: kontrol edilene kadar beyan.
    const [b] = await db.select().from(wasteBatches).where(eq(wasteBatches.id, batchId));
    expect(b.verified).toBe(false);
  });

  it("kontrol edilen kantar fişi partiyi doğrular (D-013); ikinci kontrol reddedilir", async () => {
    const detail = await wasteBatchDetail(db, R, batchId);
    const ticket = detail!.evidence.find((e) => e.kind === "weighbridge_ticket")!;
    await expect(checkEvidence(db, { orgId: G, userId: "x" }, ticket.id, NOW)).rejects.toBeInstanceOf(TenantAccessError);
    expect(await checkEvidence(db, actor, ticket.id, NOW)).toEqual({ verified: [code] });
    await expect(checkEvidence(db, actor, ticket.id, NOW)).rejects.toEqual(rule("evidence_not_declared"));
    const after = await wasteBatchDetail(db, R, batchId);
    expect(after!.batch.verified).toBe(true);
    expect(after!.evidence.find((e) => e.id === ticket.id)).toMatchObject({ status: "documented", checkedBy: actor.userId });
    expect(after!.timeline.map((e) => e.bizStep)).toEqual(["receiving", "inspecting", "inspecting", "inspecting"]);
    expect(verifyChain(await listCustodyEvents(db, R)).ok).toBe(true);
  });

  it("irsaliye kontrolü tek başına doğrulamaz", async () => {
    const [next] = await receivableDeliveries(db, R);
    const got = await receiveDelivery(db, actor, next.id, receipt(), NOW);
    const id = await uploadEvidence(db, actor, { wasteBatchId: got.id, kind: "waybill", fileName: "irsaliye.png", bytes: PNG }, NOW);
    expect(await checkEvidence(db, actor, id, NOW)).toEqual({ verified: [] });
    const rows = await stock(db, R);
    const row = rows.find((r) => r.batch.id === got.id)!;
    expect(row.batch.verified).toBe(false);
    await expect(createProduction(db, actor, production([{ wasteBatchId: got.id, kg: "10" }]), NOW)).rejects.toEqual(rule("input_unverified"));
  });

  it("üretim kalanın tamamını tahsis eder; lot ve dönüşüm olayı oluşur, fazlası reddedilir", async () => {
    const row = (await stock(db, R)).find((r) => r.batch.id === batchId)!;
    expect(row.remaining?.toString()).toBe("478");
    await expect(createProduction(db, { orgId: G, userId: "x" }, production([{ wasteBatchId: batchId, kg: "1" }]), NOW)).rejects.toEqual(rule("input_unknown"));

    const made = await createProduction(db, actor, production([{ wasteBatchId: batchId, kg: "478" }]), NOW);
    expect(made.code).toMatch(/^PB-2026-\d{2}$/);
    expect(made.lotId).not.toBeNull();
    lotId = made.lotId!;
    expect((await stock(db, R)).find((r) => r.batch.id === batchId)!.remaining?.toString()).toBe("0");
    await expect(createProduction(db, actor, production([{ wasteBatchId: batchId, kg: "0.001" }]), NOW)).rejects.toEqual(rule("allocation_exceeds"));
    // Tanımsız kimlik yok sayılmaz, reddedilir.
    await expect(createProduction(db, actor, production([{ wasteBatchId: "yok", kg: "1" }]), NOW)).rejects.toEqual(rule("input_unknown"));

    const ev = (await listCustodyEvents(db, R)).at(-1)!;
    expect(ev).toMatchObject({ type: "transformation", bizStep: "transforming" });
    expect(ev.payload.inputs).toEqual([{ ref: code, kg: "478.000" }]);
    expect(ev.payload.outputs.map((o) => o.ref)).toEqual([made.code, expect.stringMatching(/^PL-2026-\d{3}$/)]);
  });

  it("soy ağacı lottan atık partisine ve sağlayıcıya iner; zincir sağlam", async () => {
    const v = await lotGenealogy(db, R, lotId);
    expect(v).not.toBeNull();
    expect(v!.wastes.map((w) => w.code)).toEqual([code]);
    expect(v!.genealogy.textileKg?.toString()).toBe("478");
    expect(v!.genealogy.verifiedTextileKg?.toString()).toBe("478");
    expect(v!.genealogy.fibreKg?.cotton.toString()).toBe("286.8");
    expect([...v!.supplierNames.keys()]).toEqual([supplier]);
    expect(v!.genealogy.massBalance.withinTolerance).toBe(true);
    expect(v!.lot).toMatchObject({ sheetCount: 4, testStatus: "not_tested", thicknessMm: "18.0", densityKgM3: "650.0" });
    expect(v!.timeline.map((e) => e.bizStep)).toEqual(expect.arrayContaining(["receiving", "inspecting", "transforming"]));
    expect(v!.chain.ok).toBe(true);
    // Başka kurum ve sağlayıcı lotun soy ağacını uygulama içinde göremez (açık pasaport T2.4).
    expect(await lotGenealogy(db, G, lotId)).toBeNull();
    expect(await lotGenealogy(db, supplier, lotId)).toBeNull();
  });

  it("sağlayıcı teslim ettiği partinin tartımını ve doğrulamasını görür, kanıt dosyasını görmez", async () => {
    const d = await wasteBatchDetail(db, supplier, batchId);
    expect(d).toMatchObject({ own: false, accepted: new Decimal(478), remaining: null, evidence: [] });
    expect(d!.batch.verified).toBe(true);
    expect(await wasteBatchDetail(db, G, batchId)).toBeNull();
    const o = await traceOverview(db, supplier);
    expect(o.supplied.map((r) => r.batch.id)).toContain(batchId);
    expect(o.received).toEqual([]);
  });

  it("genel bakış: teslim alınacaklar, partiler, üretimler ve zincir hükmü", async () => {
    const o = await traceOverview(db, R);
    expect(o.chain.ok).toBe(true);
    expect(o.received[0].batch.receivedAt.getTime()).toBeGreaterThanOrEqual(o.received.at(-1)!.batch.receivedAt.getTime());
    expect(o.received.find((r) => r.batch.id === batchId)?.remaining?.toString()).toBe("0");
    expect(o.productions.some((p) => p.lots.some((l) => l.id === lotId))).toBe(true);
    expect(o.productions.every((p) => p.massBalance.inputKg !== null)).toBe(true);
  });
});

describe("tek seferlik ilan", () => {
  // E2E'nin yakaladığı hata: kabulde kapanan ilan alıcıya görünmüyordu; teslim satırında başlık ve bileşim "bilinmiyor"du.
  it("kabulde kapanan ilanın başlığı ve bileşimi alıcının teslim satırında kalır", async () => {
    const A = orgIdOf(DEMO_ORGS.a);
    const listingId = await createListing(db, A, {
      kind: "waste_offer",
      title: "Tek seferlik kırpıntı",
      quantity: "300",
      unit: "kg",
      composition: { cotton: 80, polyester: 20 },
      containsSilk: false,
      recurrence: "once",
      windowStart: "2026-10-29",
      windowEnd: "2026-11-30",
      unitPrice: null,
      currency: "TRY",
      taxBasis: "excl_vat",
    });
    const offerId = await placeOffer(db, R, listingId, { quantity: "300", unitPrice: null, proposedDate: "2026-11-03", message: null }, NOW);
    await acceptOffer(db, A, offerId, NOW);
    const [l] = await db.select().from(listings).where(eq(listings.id, listingId));
    expect(l.status).toBe("closed");

    const row = (await receivableDeliveries(db, R)).find((d) => d.listingTitle === "Tek seferlik kırpıntı");
    expect(row).toMatchObject({ composition: { cotton: 80, polyester: 20 }, containsSilk: false, plannedKg: "300.000" });
    // Taraf olmayan kurum kapalı ilanı hâlâ görmez.
    expect(await listingDetail(db, G, listingId, NOW)).toBeNull();
    expect(await listingDetail(db, R, listingId, NOW)).not.toBeNull();
  });
});

describe("eşzamanlılık", () => {
  it("aynı kalanı iki üretim aynı anda tahsis edemez", async () => {
    const [next] = await receivableDeliveries(db, R);
    const got = await receiveDelivery(db, actor, next.id, receipt({ weighedKg: "100", rejectedKg: "0" }), NOW);
    const ev = await uploadEvidence(db, actor, { wasteBatchId: got.id, kind: "weighbridge_ticket", fileName: "f.png", bytes: PNG }, NOW);
    await checkEvidence(db, actor, ev, NOW);
    const both = await Promise.allSettled([
      createProduction(db, actor, production([{ wasteBatchId: got.id, kg: "100" }], { sheetCount: null, densityKgM3: null }), NOW),
      createProduction(db, actor, production([{ wasteBatchId: got.id, kg: "100" }], { sheetCount: null, densityKgM3: null }), NOW),
    ]);
    expect(both.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(both.find((r) => r.status === "rejected")).toMatchObject({ reason: rule("allocation_exceeds") });
  });

  it("aynı anda iki teslim alma farklı kodlar alır", async () => {
    const [a, b] = await receivableDeliveries(db, R);
    const got = await Promise.all([receiveDelivery(db, actor, a.id, receipt(), NOW), receiveDelivery(db, actor, b.id, receipt(), NOW)]);
    expect(new Set(got.map((g) => g.code)).size).toBe(2);
    expect(verifyChain(await listCustodyEvents(db, R)).ok).toBe(true);
  });
});
