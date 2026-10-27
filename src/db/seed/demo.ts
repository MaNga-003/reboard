// Sentetik demo verisi (T1.4, D-011): Antalya OSB bağlamında 3 kaynak, 2 taşıyıcı, 2 alıcı ve ReBoard.
// Demo kayıtlarının tamamı "synthetic". Yalnızca resmî kaynaktan okunup doğrulanan referans değerler ve
// platform giderleri "sourced_estimate" (docs/DATA_DICTIONARY.md §7). Bilinmeyen değer null kalır.
// Aynı `now` ile her çalıştırma aynı kayıtları, aynı kimlikleri ve aynı hash zincirini üretir.
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import type { Role } from "../../domain/access";
import { REPORT_NEGATIVE_SCENARIO, REPORT_SCENARIO, SCENARIO_FIELDS, runScenario, type ScenarioParams } from "../../domain/calc";
import type { Composition } from "../../domain/fibre";
import { crowFliesKm } from "../../domain/geo";
import { SHEET_AREA_M2, TARGET_THICKNESS_MM, sheetMassKg } from "../../domain/panel";
import { Decimal, type Result } from "../../domain/result";
import { canonicalJson, kgText, nextEvent, type EventBody } from "../../domain/traceability";
import type * as schema from "../schema";

type Tables = typeof schema;
type New<K extends keyof Tables> = Tables[K] extends { $inferInsert: infer R } ? R : never;

export type DemoData = {
  organization: New<"organization">[];
  user: New<"user">[];
  member: New<"member">[];
  orgProfiles: New<"orgProfiles">[];
  referenceValues: New<"referenceValues">[];
  saasCosts: New<"saasCosts">[];
  modelInputs: New<"modelInputs">[];
  listings: New<"listings">[];
  offers: New<"offers">[];
  deals: New<"deals">[];
  deliveries: New<"deliveries">[];
  evidenceRegister: New<"evidenceRegister">[];
  wasteBatches: New<"wasteBatches">[];
  productionBatches: New<"productionBatches">[];
  batchInputs: New<"batchInputs">[];
  panelLots: New<"panelLots">[];
  evidenceLinks: New<"evidenceLinks">[];
  custodyEvents: New<"custodyEvents">[];
  supplierBaseline: New<"supplierBaseline">[];
  transportQuotes: New<"transportQuotes">[];
  costLines: New<"costLines">[];
  buyerTrials: New<"buyerTrials">[];
  transactions: New<"transactions">[];
  calcRuns: New<"calcRuns">[];
};

type OrgKind = New<"orgProfiles">["kind"];
export type DemoOrg = { key: string; name: string; kind: OrgKind; district: string; lat: number; lon: number };

// Adlar kurgusaldır. Konumlar ilçe düzeyinde, 2 ondalığa yuvarlanmış (≈1 km).
export const DEMO_ORGS = {
  reboard: { key: "reboard", name: "ReBoard Pilot Tesisi", kind: "producer", district: "Döşemealtı", lat: 37.02, lon: 30.6 },
  a: { key: "kaynak-a", name: "Konfeksiyon A", kind: "textile_factory", district: "Döşemealtı", lat: 36.99, lon: 30.63 },
  b: { key: "kaynak-b", name: "Örme Fabrikası B", kind: "textile_factory", district: "Kepez", lat: 36.95, lon: 30.72 },
  c: { key: "kaynak-c", name: "Belediye Toplama C", kind: "municipality", district: "Muratpaşa", lat: 36.89, lon: 30.75 },
  d: { key: "tasiyici-d", name: "Taşıyıcı D", kind: "carrier", district: "Kepez", lat: 36.93, lon: 30.68 },
  e: { key: "tasiyici-e", name: "Taşıyıcı E", kind: "carrier", district: "Aksu", lat: 36.95, lon: 30.84 },
  f: { key: "alici-f", name: "Mobilya Atölyesi F", kind: "panel_buyer", district: "Konyaaltı", lat: 36.87, lon: 30.63 },
  g: { key: "alici-g", name: "Mağaza Dekor G", kind: "panel_buyer", district: "Manavgat", lat: 36.79, lon: 31.44 },
} as const satisfies Record<string, DemoOrg>;

export const DEMO_EMAIL_DOMAIN = "demo.reboard.example";
export const orgIdOf = (o: DemoOrg) => `demo-${o.key}`;
export const userIdOf = (o: DemoOrg) => `demo-user-${o.key}`;

export type DemoUser = { id: string; key: string; org: DemoOrg; role: Role; name: string };
// Her kurumun sahibi ve rol farkını göstermek için ReBoard'da bir izleyici (yalnızca okur).
export const DEMO_USERS: readonly DemoUser[] = [
  ...Object.values(DEMO_ORGS).map((o): DemoUser => ({ id: userIdOf(o), key: o.key, org: o, role: "owner", name: `Demo · ${o.name}` })),
  { id: "demo-user-reboard-izleyici", key: "reboard-izleyici", org: DEMO_ORGS.reboard, role: "viewer", name: "Demo · ReBoard izleyici" },
];
export const demoEmail = (u: Pick<DemoUser, "key">) => `${u.key}@${DEMO_EMAIL_DOMAIN}`;

/** Rol değiştiricideki seçenekler (D-010). */
export const DEMO_PERSONAS = { supplier: "kaynak-a", producer: "reboard", buyer: "alici-f", viewer: "reboard-izleyici" } as const;
export type DemoPersona = keyof typeof DEMO_PERSONAS;
export const PERSONA_KEYS = Object.keys(DEMO_PERSONAS) as [DemoPersona, ...DemoPersona[]];
export const personaUser = (p: DemoPersona): DemoUser => DEMO_USERS.find((u) => u.key === DEMO_PERSONAS[p])!;

// Kaynakların resmî sayfadan okunup doğrulandığı gün.
const SOURCED_AT = new Date("2026-10-27T00:00:00Z");
const DAY = 86_400_000;
const S = "synthetic" as const;
const SE = "sourced_estimate" as const;

/** Ad → sabit UUID (RFC 9562 sürüm 8). Günlük sıfırlamada pasaport bağlantıları değişmesin. */
export function demoId(name: string): string {
  const h = bytesToHex(sha256(utf8ToBytes(`reboard-demo:${name}`)));
  const variant = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-8${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/** mulberry32: tohumlu, platformdan bağımsız sözde rastgele sayı. */
function prng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const n3 = (v: Decimal.Value) => new Decimal(v).toFixed(3);
const n2 = (v: Decimal.Value) => new Decimal(v).toFixed(2);
const roundTo = (v: Decimal.Value, step: number) => new Decimal(v).div(step).round().times(step);
const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const ym = (d: Date) => d.toISOString().slice(0, 7);

function demoFile(kind: string, code: string, lines: string[]) {
  const bytes = Buffer.from(["SENTETİK DEMO BELGESİ: gerçek bir belge değildir", kind, code, ...lines].join("\n"), "utf8");
  return { content: bytes, sizeBytes: bytes.length, sha256: bytesToHex(sha256(bytes)), mime: "text/plain; charset=utf-8" };
}

/** Hesap sonucu jsonb'ye: Decimal metin olur, null bilinmeyen olarak kalır. */
const resultJson = (r: Result) => ({
  value: r.value === null ? null : r.value.toString(),
  unit: r.unit,
  period: r.period,
  currency: r.currency ?? null,
  taxBasis: r.taxBasis ?? null,
  resultClass: r.resultClass,
  inputRefs: r.inputRefs,
  formulaVersion: r.formulaVersion,
  conditions: r.conditions,
});
/** Kanonik JSON kesirli sayı almaz; parametreler ondalık metne çevrilir. */
const paramsJson = (p: ScenarioParams) =>
  JSON.parse(JSON.stringify(p, (_k, v: unknown) => (typeof v === "number" ? new Decimal(v).toString() : v))) as Record<string, unknown>;

type SourceCfg = {
  org: DemoOrg;
  carrier: DemoOrg;
  title: string;
  baseKg: number;
  everyDays: number;
  firstAgo: number;
  count: number;
  future: number[];
  hour: number;
  /** TL/t; negatif: sağlayıcı ReBoard'a kabul bedeli öder. null: bedel konuşulmadı. */
  pricePerT: number | null;
  reject: [number, number];
  composition: (k: number) => Composition | null;
  silk: (k: number) => boolean | null;
};

const SOURCES: SourceCfg[] = [
  {
    org: DEMO_ORGS.a,
    carrier: DEMO_ORGS.d,
    title: "Pamuk-polyester kesim artığı, haftalık",
    baseKg: 1200,
    everyDays: 7,
    firstAgo: 3,
    count: 8,
    future: [4, 11, 18],
    hour: 9,
    pricePerT: -500,
    reject: [0, 0.02],
    composition: () => ({ cotton: 60, polyester: 35, elastane: 5 }),
    silk: () => false,
  },
  {
    org: DEMO_ORGS.b,
    carrier: DEMO_ORGS.e,
    title: "Polyester ağırlıklı örme kırpıntısı, haftalık",
    baseKg: 900,
    everyDays: 7,
    firstAgo: 5,
    count: 8,
    future: [2, 9, 16],
    hour: 10,
    pricePerT: -500,
    reject: [0.01, 0.03],
    composition: () => ({ polyester: 55, cotton: 30, viscose: 10 }),
    silk: () => false,
  },
  {
    org: DEMO_ORGS.c,
    carrier: DEMO_ORGS.d,
    title: "Karışık kullanılmış tekstil, ayda iki kez",
    baseKg: 600,
    everyDays: 14,
    firstAgo: 6,
    count: 4,
    future: [8, 22],
    hour: 11,
    pricePerT: null,
    reject: [0.05, 0.12],
    composition: (k) => (k % 2 === 0 ? { cotton: 40, polycotton: 30, other: 10 } : null),
    silk: (k) => (k % 2 === 0 ? true : null),
  },
];

type Binder = NonNullable<New<"productionBatches">["binder"]>;
const PRODUCTION: { ago: number; binder: Binder; density: number; diff: number; lots: number; note?: string }[] = [
  { ago: 50, binder: "unknown", density: 640, diff: 0.002, lots: 1 },
  { ago: 40, binder: "pet_copet", density: 610, diff: -0.003, lots: 1 },
  {
    ago: 30,
    binder: "pmdi",
    density: 680,
    diff: 0.031,
    lots: 1,
    note: "Pres tozu ve kenar kesim kaybı ayrı tartılmadı (sentetik örnek: tolerans aşımı açıklaması)",
  },
  { ago: 20, binder: "pet_copet", density: 650, diff: 0.001, lots: 1 },
  { ago: 10, binder: "pmdi", density: 700, diff: -0.004, lots: 2 },
];
const TARGET_INPUT_KG = 2400;
// Sentetik birim giderler (TL, KDV hariç). Bağlayıcı seçilmediyse fiyatı bilinmiyor.
const BINDER_TL_PER_KG: Record<Binder, number | null> = { pet_copet: 62, pmdi: 95, none: 0, unknown: null };
const PANEL_PRICE_TL_M2 = 240;

export function buildDemo(now: Date): DemoData {
  const d0 = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const at = (days: number, hour: number, minute = 0) => new Date(d0 + days * DAY + (hour * 60 + minute) * 60_000);
  const rnd = prng(20261030);
  const between = (lo: number, hi: number) => lo + (hi - lo) * rnd();

  const O = DEMO_ORGS;
  const R = orgIdOf(O.reboard);
  const RU = userIdOf(O.reboard);
  const orgs: DemoOrg[] = Object.values(O);
  const thisMonth = ym(at(0, 0));
  const lastMonth = ym(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)));

  const data: DemoData = {
    organization: orgs.map((o) => ({ id: orgIdOf(o), name: o.name, slug: o.key, metadata: JSON.stringify({ demo: true }) })),
    user: DEMO_USERS.map((u) => ({ id: u.id, name: u.name, email: demoEmail(u), emailVerified: true })),
    member: DEMO_USERS.map((u) => ({ id: `demo-member-${u.key}`, organizationId: orgIdOf(u.org), userId: u.id, role: u.role })),
    orgProfiles: orgs.map((o) => ({
      orgId: orgIdOf(o),
      kind: o.kind,
      district: o.district,
      province: "Antalya",
      lat: o.lat,
      lon: o.lon,
      isPublic: true,
      resultClass: S,
    })),
    referenceValues: [
      {
        key: "eurostat_tr_textile_waste_2022",
        value: "361500",
        unit: "t",
        period: "2022",
        sourceName: "Eurostat env_wasgen (TR, W076, TOTAL_HH, HAZ_NHAZ)",
        sourceUrl: "https://ec.europa.eu/eurostat/databrowser/view/env_wasgen/default/table?lang=en",
        retrievedAt: SOURCED_AT,
        license: "Eurostat: kaynak gösterilerek yeniden kullanılabilir",
        scopeNote: "Ülke düzeyinde, bütün faaliyetler ve haneler. Yerel fabrika tonajı değildir; sunumdaki 1,5 milyon ton farklı kapsamdadır.",
        resultClass: SE,
      },
      {
        key: "electricity_tl_kwh_2026h1",
        value: "3.975",
        unit: "TL/kWh",
        currency: "TRY",
        period: "2026-S1",
        sourceName: "Eurostat nrg_pc_205 (TR, MWH20-499, X_VAT, NAC)",
        sourceUrl: "https://ec.europa.eu/eurostat/databrowser/view/nrg_pc_205/default/table?lang=en",
        retrievedAt: SOURCED_AT,
        license: "Eurostat: kaynak gösterilerek yeniden kullanılabilir",
        scopeNote: "Yıllık 20–499 MWh bandı, KDV ve geri alınabilir vergiler hariç ulusal fiyat. Pilotun sözleşme fiyatı değildir.",
        resultClass: SE,
      },
      {
        key: "ibb_gate_fee_seymen",
        value: "700",
        unit: "TL/t",
        currency: "TRY",
        period: "2026",
        sourceName: "İBB ücret tarifesi EK-2, kalem 1.1",
        sourceUrl: "https://cevre.ibb.istanbul/wp-content/uploads/2025/12/EK2-Ucret-Tarifesi.pdf",
        retrievedAt: SOURCED_AT,
        scopeNote: "İstanbul tesis kabul bedeli; Antalya için karşılaştırma referansı. Tesis adı maliyet raporundan; KDV durumu doğrulanmadı.",
        resultClass: SE,
      },
      {
        key: "ibb_gate_fee_komurcuoda",
        value: "785",
        unit: "TL/t",
        currency: "TRY",
        period: "2026",
        sourceName: "İBB ücret tarifesi EK-2, kalem 1.2",
        sourceUrl: "https://cevre.ibb.istanbul/wp-content/uploads/2025/12/EK2-Ucret-Tarifesi.pdf",
        retrievedAt: SOURCED_AT,
        scopeNote: "İstanbul tesis kabul bedeli; Antalya için karşılaştırma referansı. Tesis adı maliyet raporundan; KDV durumu doğrulanmadı.",
        resultClass: SE,
      },
      {
        key: "usd_try",
        value: "49.5523",
        unit: "TL/USD",
        currency: "TRY",
        period: "2026-10-19",
        sourceName: "TCMB gösterge niteliğindeki kurlar, döviz satış",
        sourceUrl: "https://www.tcmb.gov.tr/kurlar/202610/19102026.xml",
        retrievedAt: SOURCED_AT,
        scopeNote: "Maliyet raporu 16.10.2026 dosyasını gösteriyor; bu değer 19.10.2026 döviz satış kurudur.",
        resultClass: SE,
      },
      {
        key: "sheet_area_m2",
        value: SHEET_AREA_M2.toString(),
        unit: "m2",
        sourceName: "Ekip planı: standart levha 1830×3660 mm",
        sourceUrl: "https://github.com/MaNga-003/reboard/blob/main/docs/DATA_DICTIONARY.md",
        retrievedAt: SOURCED_AT,
        scopeNote: "Hesap: 1,830 m × 3,660 m. Hedef ölçüdür, üretilmiş levha ölçümü değildir.",
        resultClass: SE,
      },
    ],
    // Resmî fiyat sayfaları 27 Ekim 2026'da okundu (D-027). Satırın açıklaması messages/*.json → saasCosts.notes.<key>.
    // null: bilinmiyor ya da kullanıma bağlı; 0: ücretsiz ya da müşteri sayısıyla değişmez.
    saasCosts: [
      {
        key: "vercel_hobby",
        stage: "demo",
        item: "hosting",
        vendor: "Vercel",
        plan: "Hobby",
        monthlyCost: "0",
        perCustomerCost: "0",
        sourceUrl: "https://vercel.com/pricing",
        currency: "USD",
        retrievedAt: SOURCED_AT,
        resultClass: SE,
      },
      {
        key: "neon_free",
        stage: "demo",
        item: "database",
        vendor: "Neon",
        plan: "Free",
        monthlyCost: "0",
        perCustomerCost: "0",
        sourceUrl: "https://neon.com/pricing",
        currency: "USD",
        retrievedAt: SOURCED_AT,
        resultClass: SE,
      },
      {
        key: "openfreemap",
        stage: "both",
        item: "map_tiles",
        vendor: "OpenFreeMap",
        plan: null,
        monthlyCost: "0",
        perCustomerCost: "0",
        sourceUrl: "https://openfreemap.org",
        currency: "USD",
        retrievedAt: SOURCED_AT,
        resultClass: SE,
      },
      {
        key: "github_actions",
        stage: "both",
        item: "ci",
        vendor: "GitHub",
        plan: null,
        monthlyCost: "0",
        perCustomerCost: "0",
        sourceUrl: "https://docs.github.com/en/billing/concepts/product-billing/github-actions",
        currency: "USD",
        retrievedAt: SOURCED_AT,
        resultClass: SE,
      },
      {
        key: "vercel_pro",
        stage: "commercial",
        item: "hosting",
        vendor: "Vercel",
        plan: "Pro",
        monthlyCost: "20",
        perCustomerCost: null,
        sourceUrl: "https://vercel.com/pricing",
        currency: "USD",
        retrievedAt: SOURCED_AT,
        resultClass: SE,
      },
      {
        key: "neon_launch_compute",
        stage: "commercial",
        item: "database_compute",
        vendor: "Neon",
        plan: "Launch",
        monthlyCost: "0",
        perCustomerCost: null,
        unitPrice: "0.106",
        usageUnit: "cu_hour",
        sourceUrl: "https://neon.com/pricing",
        currency: "USD",
        retrievedAt: SOURCED_AT,
        resultClass: SE,
      },
      {
        key: "neon_launch_storage",
        stage: "commercial",
        item: "database_storage",
        vendor: "Neon",
        plan: "Launch",
        monthlyCost: "0",
        perCustomerCost: null,
        unitPrice: "0.35",
        usageUnit: "gb_month",
        sourceUrl: "https://neon.com/pricing",
        currency: "USD",
        retrievedAt: SOURCED_AT,
        resultClass: SE,
      },
      {
        key: "domain",
        stage: "commercial",
        item: "domain",
        vendor: null,
        plan: null,
        monthlyCost: null,
        perCustomerCost: "0",
        sourceUrl: "https://github.com/MaNga-003/reboard/blob/main/state.json",
        currency: "USD",
        retrievedAt: SOURCED_AT,
        resultClass: SE,
      },
    ],
    modelInputs: [],
    listings: [],
    offers: [],
    deals: [],
    deliveries: [],
    evidenceRegister: [],
    wasteBatches: [],
    productionBatches: [],
    batchInputs: [],
    panelLots: [],
    evidenceLinks: [],
    custodyEvents: [],
    supplierBaseline: [],
    transportQuotes: [],
    costLines: [],
    buyerTrials: [],
    transactions: [],
    calcRuns: [],
  };

  const chains = new Map<string, Omit<EventBody, "seq">[]>();
  const event = (e: Omit<EventBody, "seq">) => chains.set(e.orgId, [...(chains.get(e.orgId) ?? []), e]);
  const evidence = (id: string, orgId: string, kind: New<"evidenceRegister">["kind"], code: string, status: New<"evidenceRegister">["status"], uploadedBy: string, lines: string[], period: string) => {
    const f = demoFile(kind, code, lines);
    data.evidenceRegister.push({
      id,
      orgId,
      kind,
      fileName: `${code}-${kind}.txt`,
      ...f,
      period,
      status,
      uploadedBy,
      checkedBy: status === "declared" ? null : RU,
      resultClass: S,
    });
    return id;
  };
  const link = (evidenceId: string, entityType: string, entityId: string) => data.evidenceLinks.push({ evidenceId, entityType, entityId });

  // Pazar yeri: ReBoard'un atık talebi ve sağlayıcıların teklifleri.
  const window = { windowStart: isoDay(at(-60, 0)), windowEnd: isoDay(at(60, 0)) };
  const requestId = demoId("listing:reboard-waste-request");
  data.listings.push({
    id: requestId,
    orgId: R,
    kind: "waste_request",
    title: "Pamuk ve polyester ağırlıklı kırpıntı, ipeksiz",
    composition: { cotton: 50, polyester: 40 },
    containsSilk: false,
    quantity: n3(3000),
    unit: "kg",
    recurrence: "weekly",
    ...window,
    unitPrice: n2(-500),
    priceUnit: "t",
    district: O.reboard.district,
    lat: O.reboard.lat,
    lon: O.reboard.lon,
    resultClass: S,
  });
  // İpek kapsam dışı: bu ilan üretici talebiyle eşleşmemeli.
  data.listings.push({
    id: demoId("listing:kaynak-a-silk"),
    orgId: orgIdOf(O.a),
    kind: "waste_offer",
    title: "İpek karışımlı kırpıntı, tek seferlik",
    composition: { cotton: 50, other: 30 },
    containsSilk: true,
    quantity: n3(300),
    unit: "kg",
    recurrence: "once",
    ...window,
    district: O.a.district,
    lat: O.a.lat,
    lon: O.a.lon,
    resultClass: S,
  });
  data.offers.push({
    id: demoId("offer:kaynak-b-request"),
    listingId: requestId,
    orgId: orgIdOf(O.b),
    quantity: n3(500),
    unit: "kg",
    unitPrice: n2(-500),
    proposedDate: isoDay(at(-20, 0)),
    status: "rejected",
    message: "Tek seferlik akrilik ağırlıklı parti; bileşim talebe uymadı",
    resultClass: S,
  });

  // Teslimler ve atık partileri.
  type Delivered = { src: SourceCfg; k: number; deliveryId: string; dealId: string; deliveredAt: Date; declared: Decimal };
  const delivered: Delivered[] = [];
  for (const src of SOURCES) {
    const key = src.org.key;
    const listingId = demoId(`listing:${key}`);
    const offerId = demoId(`offer:${key}`);
    const dealId = demoId(`deal:${key}`);
    const price = src.pricePerT === null ? null : n2(src.pricePerT);
    data.listings.push({
      id: listingId,
      orgId: orgIdOf(src.org),
      kind: "waste_offer",
      title: src.title,
      composition: src.composition(0),
      containsSilk: src.silk(0),
      quantity: n3(src.baseKg),
      unit: "kg",
      recurrence: src.everyDays === 7 ? "weekly" : "monthly",
      ...window,
      unitPrice: price,
      priceUnit: price === null ? null : "t",
      district: src.org.district,
      lat: src.org.lat,
      lon: src.org.lon,
      resultClass: S,
    });
    data.offers.push({
      id: offerId,
      listingId,
      orgId: R,
      quantity: n3(src.baseKg),
      unit: "kg",
      unitPrice: price,
      proposedDate: isoDay(at(-(src.firstAgo + src.everyDays * src.count), 0)),
      status: "accepted",
      resultClass: S,
    });
    data.deals.push({ id: dealId, offerId, listingId, sellerOrgId: orgIdOf(src.org), buyerOrgId: R, quantity: n3(src.baseKg), unit: "kg", unitPrice: price, resultClass: S });

    for (let k = src.count - 1; k >= 0; k--) {
      const days = -(src.firstAgo + src.everyDays * k);
      const deliveryId = demoId(`delivery:${key}:${k}`);
      const declared = roundTo(src.baseKg * between(0.9, 1.1), 5);
      const base = { id: deliveryId, dealId, plannedAt: at(days, src.hour), plannedKg: n3(declared), carrierName: src.carrier.name, resultClass: S };
      if (src.org === O.b && k === 4) {
        data.deliveries.push({ ...base, status: "cancelled" });
        continue;
      }
      // Sentetik güvenilirlik farkı: teslimlerin yaklaşık üçte biri 1 ya da 2 gün gecikir.
      const r = rnd();
      const late = r < 0.15 ? 2 : r < 0.35 ? 1 : 0;
      const deliveredAt = at(days + late, src.hour + 1, Math.floor(between(0, 50)));
      data.deliveries.push({ ...base, deliveredAt, status: "delivered" });
      delivered.push({ src, k, deliveryId, dealId, deliveredAt, declared });
    }
    for (const f of src.future) {
      data.deliveries.push({
        id: demoId(`delivery:${key}:+${f}`),
        dealId,
        plannedAt: at(f, src.hour),
        plannedKg: n3(src.baseKg),
        carrierName: src.carrier.name,
        status: "planned",
        resultClass: S,
      });
    }
  }
  delivered.sort((a, b) => a.deliveredAt.getTime() - b.deliveredAt.getTime());

  type Waste = { id: string; code: string; receivedAt: Date; accepted: Decimal | null; verified: boolean; supplier: DemoOrg; weighed: Decimal | null };
  const wastes: Waste[] = [];
  for (const [i, d] of delivered.entries()) {
    const code = `WB-${d.deliveredAt.getUTCFullYear()}-${String(i + 1).padStart(4, "0")}`;
    const id = demoId(`waste:${code}`);
    const unweighed = d.src.org === O.c && d.k === 0;
    const ticketPending = d.src.org === O.b && d.k === 0;
    const weighed = unweighed ? null : roundTo(d.declared.times(between(0.95, 1.02)), 5);
    const moisture = unweighed ? null : new Decimal(between(4, 11)).toDecimalPlaces(1);
    const rejected = weighed === null ? null : roundTo(weighed.times(between(...d.src.reject)), 0.5);
    const accepted = weighed === null || rejected === null ? null : weighed.minus(rejected);
    const silk = d.src.silk(d.k);
    const period = ym(d.deliveredAt);
    const srcUser = userIdOf(d.src.org);

    const waybill = evidence(demoId(`evidence:waybill:${code}`), R, "waybill", code, "documented", srcUser, [`Beyan: ${n3(d.declared)} kg`], period);
    link(waybill, "delivery", d.deliveryId);
    link(waybill, "waste_batch", id);
    const evidenceIds = [waybill];
    let ticketDocumented = false;
    if (weighed !== null) {
      const ticket = evidence(demoId(`evidence:ticket:${code}`), R, "weighbridge_ticket", code, ticketPending ? "declared" : "documented", RU, [`Net: ${n3(weighed)} kg`], period);
      link(ticket, "waste_batch", id);
      evidenceIds.push(ticket);
      ticketDocumented = !ticketPending;
    }
    // D-013: tartım ve kontrol edilmiş kanıt varsa doğrulanmış.
    const verified = weighed !== null && ticketDocumented;
    const notes = unweighed
      ? "Kantar tartımı bekleniyor; yalnızca beyan var"
      : ticketPending
        ? "Kantar fişi yüklendi, ReBoard kontrolü bekleniyor"
        : silk
          ? "İpek ayıklandı, ayıklanan kg'a eklendi"
          : null;
    data.wasteBatches.push({
      id,
      code,
      orgId: R,
      supplierOrgId: orgIdOf(d.src.org),
      deliveryId: d.deliveryId,
      receivedAt: d.deliveredAt,
      declaredKg: n3(d.declared),
      weighedKg: weighed === null ? null : n3(weighed),
      moisturePct: moisture === null ? null : moisture.toFixed(2),
      rejectedKg: rejected === null ? null : n3(rejected),
      composition: d.src.composition(d.k),
      containsSilk: silk,
      verified,
      notes,
      resultClass: S,
    });
    wastes.push({ id, code, receivedAt: d.deliveredAt, accepted, verified, supplier: d.src.org, weighed });

    event({
      orgId: orgIdOf(d.src.org),
      type: "object",
      bizStep: "shipping",
      eventTime: new Date(d.deliveredAt.getTime() - 2 * 3600_000),
      payload: { inputs: [], outputs: [{ ref: code, kg: kgText(d.declared) }], evidenceIds: [waybill], note: "Sevk; beyan edilen kg" },
    });
    event({
      orgId: R,
      type: "object",
      bizStep: "receiving",
      eventTime: d.deliveredAt,
      payload: {
        inputs: [],
        outputs: [{ ref: code, kg: kgText(weighed ?? d.declared) }],
        evidenceIds,
        note: weighed === null ? "Tartım bekleniyor; beyan edilen kg" : "Kantar tartımı",
      },
    });
    if (weighed !== null && accepted !== null && rejected !== null) {
      event({
        orgId: R,
        type: "object",
        bizStep: "inspecting",
        eventTime: new Date(d.deliveredAt.getTime() + 2 * 3600_000),
        payload: {
          inputs: [{ ref: code, kg: kgText(weighed) }],
          outputs: [{ ref: code, kg: kgText(accepted) }],
          evidenceIds: [],
          note: `Ayıklanan ${n3(rejected)} kg${silk ? " (ipek dahil)" : ""}`,
        },
      });
    }
    // Kabul bedeli: sağlayıcı ReBoard'a öder. Tutar kaydın sahibi (ReBoard) açısından gelirdir.
    if (verified && accepted !== null && d.src.pricePerT !== null) {
      data.transactions.push({
        id: demoId(`tx:gate-fee:${code}`),
        orgId: R,
        counterpartyOrgId: orgIdOf(d.src.org),
        dealId: d.dealId,
        kind: "gate_fee",
        amount: n2(accepted.div(1000).times(-d.src.pricePerT)),
        occurredAt: new Date(d.deliveredAt.getTime() + 3 * 3600_000),
        resultClass: S,
      });
    }
  }

  // Üretim: doğrulanmış partilerden ilk giren ilk çıkar. Kalan kabul edilmiş kg stoktur.
  const remaining = new Map(wastes.filter((w) => w.verified && w.accepted !== null).map((w) => [w.id, w.accepted!]));
  type Lot = { id: string; code: string; sheets: number; kg: Decimal; areaM2: Decimal };
  const lots: Lot[] = [];
  const months = new Set<string>();
  for (const [i, p] of PRODUCTION.entries()) {
    const startedAt = at(-p.ago, 13);
    const code = `PB-${startedAt.getUTCFullYear()}-${String(i + 1).padStart(2, "0")}`;
    const id = demoId(`production:${code}`);
    let input = new Decimal(0);
    const allocs: { w: Waste; kg: Decimal }[] = [];
    for (const w of wastes) {
      if (input.gte(TARGET_INPUT_KG)) break;
      const rem = remaining.get(w.id);
      if (!rem || rem.lte(0) || w.receivedAt >= startedAt) continue;
      const take = Decimal.min(rem, new Decimal(TARGET_INPUT_KG).minus(input));
      remaining.set(w.id, rem.minus(take));
      input = input.plus(take);
      allocs.push({ w, kg: take });
    }
    if (input.isZero()) throw new Error(`${code}: tahsis edilecek doğrulanmış parti yok`);

    // Kütle dengesi: girdi = çıktı + fire + nem kaybı + fark; fark girdinin p.diff kadarı.
    const moisture = input.times(between(0.04, 0.07)).toDecimalPlaces(1);
    const mass = sheetMassKg(p.density);
    const sheets = input
      .minus(moisture)
      .minus(input.times(0.03 + Math.max(0, p.diff)))
      .div(mass)
      .floor()
      .toNumber();
    const output = mass.times(sheets).toDecimalPlaces(3);
    const scrap = input.minus(moisture).minus(output).minus(input.times(p.diff)).toDecimalPlaces(3);
    data.productionBatches.push({
      id,
      code,
      orgId: R,
      startedAt,
      binder: p.binder,
      outputKg: n3(output),
      scrapKg: n3(scrap),
      moistureLossKg: n3(moisture),
      balanceNote: p.note ?? null,
      resultClass: S,
    });
    for (const a of allocs) data.batchInputs.push({ productionBatchId: id, wasteBatchId: a.w.id, allocatedKg: n3(a.kg), resultClass: S });

    const split = p.lots === 1 ? [sheets] : [Math.ceil(sheets / 2), Math.floor(sheets / 2)];
    const madeLots: Lot[] = [];
    for (const [j, count] of split.entries()) {
      const lotCode = `PL-${startedAt.getUTCFullYear()}-${String(lots.length + 1).padStart(3, "0")}`;
      const lot: Lot = { id: demoId(`lot:${lotCode}`), code: lotCode, sheets: count, kg: mass.times(count), areaM2: SHEET_AREA_M2.times(count) };
      lots.push(lot);
      madeLots.push(lot);
      data.panelLots.push({
        id: lot.id,
        code: lotCode,
        orgId: R,
        productionBatchId: id,
        areaM2: n2(lot.areaM2),
        sheetCount: count,
        thicknessMm: TARGET_THICKNESS_MM.toFixed(1),
        densityKgM3: p.density.toFixed(1),
        // Reçete test edilmedi; yalnızca son partinin ilk lotunda test sürüyor (sentetik).
        testStatus: i === PRODUCTION.length - 1 && j === 0 ? "in_progress" : "not_tested",
        isPublic: true,
        resultClass: S,
      });
    }
    event({
      orgId: R,
      type: "transformation",
      bizStep: "transforming",
      eventTime: startedAt,
      payload: {
        inputs: allocs.map((a) => ({ ref: a.w.code, kg: kgText(a.kg) })),
        outputs: [{ ref: code, kg: kgText(output) }, ...madeLots.map((l) => ({ ref: l.code, kg: kgText(l.kg) }))],
        evidenceIds: [],
        note: `Bağlayıcı: ${p.binder} (reçete seçilmedi)`,
      },
    });

    // Gider kalemleri: miktar sentetik; elektrik birim fiyatı kaynaklı değerden alınır, satırın sınıfı yine sentetik.
    const period = ym(startedAt);
    months.add(period);
    const binderKg = input.times(0.1).toDecimalPlaces(3);
    const binderPrice = BINDER_TL_PER_KG[p.binder];
    const kwh = input.times(0.45).toDecimalPlaces(3);
    const line = (key: string, l: Omit<New<"costLines">, "id" | "orgId" | "period" | "resultClass">) =>
      data.costLines.push({ id: demoId(`cost:${code}:${key}`), orgId: R, period, productionBatchId: id, resultClass: S, ...l });
    line("binder", {
      category: "binder",
      description: `Bağlayıcı: ${p.binder} (reçete seçilmedi)`,
      quantity: n3(binderKg),
      unit: "kg",
      unitCost: binderPrice === null ? null : n2(binderPrice),
      amount: binderPrice === null ? null : n2(binderKg.times(binderPrice)),
      source: "Sentetik",
    });
    line("energy", {
      category: "energy",
      description: "Kırıcı ve pres elektriği",
      quantity: n3(kwh),
      unit: "kwh",
      unitCost: "3.98",
      amount: n2(kwh.times("3.975")),
      source: "Birim fiyat: Eurostat nrg_pc_205 2026-S1, 3,975 TL/kWh; tüketim sentetik",
    });
    line("labor", { category: "labor", description: "Pres hattı işçiliği", quantity: n3(16), unit: "h", unitCost: n2(220), amount: n2(16 * 220), source: "Sentetik" });
  }
  for (const period of [...months].sort()) {
    const monthly = (key: string, category: New<"costLines">["category"], description: string, amount: number) =>
      data.costLines.push({ id: demoId(`cost:${period}:${key}`), orgId: R, period, category, description, quantity: n3(1), unit: "month", unitCost: n2(amount), amount: n2(amount), source: "Sentetik; maliyet raporundaki örnekle aynı büyüklük", resultClass: S });
    monthly("fixed", "fixed", "Kira ve genel gider", 30_000);
    monthly("depreciation", "depreciation", "Pres ve kırıcı amortismanı", 15_000);
  }

  // Panel satışı: ilk lottan Mobilya Atölyesi F'ye.
  const sold = lots[0];
  const soldSheets = Math.min(18, sold.sheets);
  const soldArea = SHEET_AREA_M2.times(soldSheets);
  const soldKg = sold.kg.div(sold.sheets).times(soldSheets);
  const panelOfferId = demoId("listing:reboard-panel-offer");
  const totalArea = lots.reduce((a, l) => a.plus(l.areaM2), new Decimal(0));
  data.listings.push({
    id: panelOfferId,
    orgId: R,
    kind: "panel_offer",
    title: "18 mm ReBoard iç mekân paneli (test edilmedi)",
    containsSilk: false,
    quantity: n3(totalArea.minus(soldArea)),
    unit: "m2",
    recurrence: "once",
    ...window,
    unitPrice: n2(PANEL_PRICE_TL_M2),
    priceUnit: "m2",
    district: O.reboard.district,
    lat: O.reboard.lat,
    lon: O.reboard.lon,
    resultClass: S,
  });
  const fRequestId = demoId("listing:alici-f-request");
  const gRequestId = demoId("listing:alici-g-request");
  data.listings.push(
    {
      id: fRequestId,
      orgId: orgIdOf(O.f),
      kind: "panel_request",
      status: "closed",
      title: "Dolap gövdesi için panel",
      quantity: n3(120),
      unit: "m2",
      recurrence: "once",
      ...window,
      district: O.f.district,
      lat: O.f.lat,
      lon: O.f.lon,
      resultClass: S,
    },
    {
      id: gRequestId,
      orgId: orgIdOf(O.g),
      kind: "panel_request",
      title: "Mağaza raf ve dekor paneli, aylık",
      quantity: n3(300),
      unit: "m2",
      recurrence: "monthly",
      ...window,
      district: O.g.district,
      lat: O.g.lat,
      lon: O.g.lon,
      resultClass: S,
    },
  );
  const fOfferId = demoId("offer:alici-f-panel");
  data.offers.push(
    {
      id: fOfferId,
      listingId: panelOfferId,
      orgId: orgIdOf(O.f),
      quantity: n3(soldArea),
      unit: "m2",
      unitPrice: n2(PANEL_PRICE_TL_M2),
      proposedDate: isoDay(at(-12, 0)),
      status: "accepted",
      resultClass: S,
    },
    {
      id: demoId("offer:reboard-to-g"),
      listingId: gRequestId,
      orgId: R,
      quantity: n3(300),
      unit: "m2",
      unitPrice: n2(PANEL_PRICE_TL_M2),
      proposedDate: isoDay(at(7, 0)),
      status: "open",
      message: "Panel test edilmedi; dayanım iddiası yok",
      resultClass: S,
    },
  );
  const panelDealId = demoId("deal:panel-f");
  data.deals.push({ id: panelDealId, offerId: fOfferId, listingId: panelOfferId, sellerOrgId: R, buyerOrgId: orgIdOf(O.f), quantity: n3(soldArea), unit: "m2", unitPrice: n2(PANEL_PRICE_TL_M2), resultClass: S });
  const panelDeliveryId = demoId("delivery:panel-f");
  const panelDeliveredAt = at(-8, 10);
  data.deliveries.push({ id: panelDeliveryId, dealId: panelDealId, plannedAt: at(-9, 9), deliveredAt: panelDeliveredAt, plannedKg: n3(soldKg), carrierName: O.d.name, status: "delivered", resultClass: S });
  const saleId = demoId("tx:panel-sale-f");
  const invoice = evidence(demoId("evidence:invoice:panel-f"), R, "invoice", sold.code, "documented", RU, [`${soldSheets} levha, ${n2(soldArea)} m²`], ym(panelDeliveredAt));
  link(invoice, "transaction", saleId);
  link(invoice, "delivery", panelDeliveryId);
  data.transactions.push({
    id: saleId,
    orgId: R,
    counterpartyOrgId: orgIdOf(O.f),
    dealId: panelDealId,
    kind: "panel_sale",
    amount: n2(soldArea.times(PANEL_PRICE_TL_M2)),
    occurredAt: panelDeliveredAt,
    evidenceId: invoice,
    resultClass: S,
  });
  event({
    orgId: R,
    type: "transaction",
    bizStep: "shipping",
    eventTime: new Date(panelDeliveredAt.getTime() - 3 * 3600_000),
    payload: { inputs: [{ ref: sold.code, kg: kgText(soldKg) }], outputs: [], evidenceIds: [invoice], note: `${soldSheets} levha` },
  });
  event({
    orgId: orgIdOf(O.f),
    type: "object",
    bizStep: "receiving",
    eventTime: panelDeliveredAt,
    payload: { inputs: [], outputs: [{ ref: sold.code, kg: kgText(soldKg) }], evidenceIds: [invoice], note: `${soldSheets} levha teslim alındı` },
  });

  // Gözetim zincirleri: her organizasyonda olaylar zaman sırasıyla zincirlenir.
  for (const [, bodies] of [...chains.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    let tip = null as ReturnType<typeof nextEvent> | null;
    for (const body of [...bodies].sort((a, b) => new Date(a.eventTime).getTime() - new Date(b.eventTime).getTime())) {
      tip = nextEvent(tip, body);
      data.custodyEvents.push({
        orgId: tip.orgId,
        seq: tip.seq,
        type: tip.type,
        bizStep: tip.bizStep,
        eventTime: new Date(tip.eventTime),
        payload: tip.payload,
        prevHash: tip.prevHash,
        hash: tip.hash,
      });
    }
  }

  // Sağlayıcıların bugünkü atık gideri (önceki ay).
  for (const [o, kg, collectable] of [
    [O.a, 5000, true],
    [O.b, 3800, true],
    [O.c, 2600, false],
  ] as const) {
    const t = new Decimal(kg).div(1000);
    data.supplierBaseline.push({
      id: demoId(`baseline:${o.key}`),
      orgId: orgIdOf(o),
      period: lastMonth,
      disposalKg: n3(kg),
      // Belediye toplama gideri bilinmiyor: null.
      disposalCost: collectable ? n2(t.times(615)) : null,
      transportCost: n2(t.times(600)),
      gateFee: n2(t.times(785)),
      source: "Sentetik; kabul bedeli İBB 785 TL/t referansıyla kuruldu",
      resultClass: S,
    });
  }

  // Taşıyıcı teklifleri: mesafe kuş uçuşu.
  for (const [carrier, from, to, capacity] of [
    [O.d, O.a, O.reboard, 3500],
    [O.d, O.c, O.reboard, 3500],
    [O.d, O.reboard, O.f, 3500],
    [O.e, O.b, O.reboard, 7000],
    [O.e, O.reboard, O.g, 7000],
  ] as const) {
    const km = crowFliesKm(from, to);
    data.transportQuotes.push({
      id: demoId(`quote:${carrier.key}:${from.key}:${to.key}`),
      orgId: orgIdOf(carrier),
      carrierName: carrier.name,
      originDistrict: from.district,
      destinationDistrict: to.district,
      distanceKm: km.toFixed(1),
      distanceKind: "crow_flies",
      pricePerTrip: n2(roundTo(km.times(capacity > 5000 ? 32 : 24).plus(900), 50)),
      capacityKg: n3(capacity),
      period: thisMonth,
      source: "Sentetik teklif",
      resultClass: S,
    });
  }

  // Alıcıların eşdeğer ürün gideri.
  data.buyerTrials.push(
    {
      id: demoId("trial:alici-f"),
      orgId: orgIdOf(O.f),
      period: thisMonth,
      product: "particleboard",
      areaM2: n2(soldArea),
      totalCost: n2(soldArea.times("263.11")),
      notes: "Eşdeğer sunta; teslim, kesim ve kaplama hariç",
      resultClass: S,
    },
    {
      id: demoId("trial:alici-g"),
      orgId: orgIdOf(O.g),
      period: thisMonth,
      product: "mdf",
      areaM2: n2(300),
      totalCost: n2(300 * 295),
      notes: "Eşdeğer MDF; teslim hariç",
      resultClass: S,
    },
  );

  // Model girdileri: tedarik planı (ReBoard) ve rapordaki senaryo (platform geneli).
  const input = (key: string, value: Decimal.Value | null, unit: New<"modelInputs">["unit"], orgId: string | null, period: string, source: string) =>
    data.modelInputs.push({ id: demoId(`input:${orgId ?? "platform"}:${key}`), orgId, key, value: value === null ? null : new Decimal(value).toString(), unit, period, source, resultClass: S });
  input("planned_daily_need_kg", 400, "kg", R, thisMonth, "Sentetik üretim planı");
  input("days_of_cover_green_min", 14, null, R, thisMonth, "Varsayılan eşik (gün)");
  input("days_of_cover_yellow_min", 7, null, R, thisMonth, "Varsayılan eşik (gün)");
  const p = REPORT_SCENARIO;
  const sc = "Maliyet raporunun sentetik model örneği";
  // Senaryonun bütün girdileri (D-026); anahtar alan adının yılan biçimi: wasteT → waste_t.
  for (const f of SCENARIO_FIELDS) {
    const note = p[f.key] === null ? `${sc}; belirlenmedi` : sc;
    input(f.key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`), p[f.key], f.unit === "t" || f.unit === "m2" ? f.unit : null, null, "sentetik-donem", note);
  }

  // Hesap kayıtları: formül sürümü, girdi hash'i ve çıktılar.
  const run = (formula: string, params: ScenarioParams, outputs: Record<string, unknown>, r: Result) => {
    const inputs = paramsJson(params);
    data.calcRuns.push({
      id: demoId(`calc:${formula}:${params === p ? "base" : "negative"}`),
      orgId: null,
      formula,
      formulaVersion: r.formulaVersion,
      inputHash: bytesToHex(sha256(utf8ToBytes(canonicalJson({ formula, inputs })))),
      inputs,
      outputs,
      resultClass: r.resultClass,
    });
  };
  const base = runScenario(p);
  run("factory_gain", p, resultJson(base.factory), base.factory);
  run("panel_customer_gain", p, resultJson(base.customer), base.customer);
  run("reboard_operating_result", p, resultJson(base.reboard), base.reboard);
  run("price_corridor", p, { lower: resultJson(base.corridor.lower), upper: resultJson(base.corridor.upper), exists: base.corridor.exists }, base.corridor.lower);
  run("saas_contribution", p, resultJson(base.saas), base.saas);
  const negative = runScenario(REPORT_NEGATIVE_SCENARIO);
  run("factory_gain", REPORT_NEGATIVE_SCENARIO, resultJson(negative.factory), negative.factory);

  return data;
}
