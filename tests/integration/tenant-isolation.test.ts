// M-4: kiracılar ayrılır (T1.5). Demo verisi gerçek migrasyonlarla yüklenir; her kurum hem repository katmanından
// hem Better Auth HTTP uç noktalarından başka kurumların özel kayıtlarını dener. Beklenen başarılı erişim: 0.
import { PGlite } from "@electric-sql/pglite";
import { getTableName, sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/pglite/migrator";
import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPgliteDb } from "@/db/client";
import { calcRuns } from "@/db/schema";
import { resolveMembership } from "@/db/repo/membership";
import {
  AUTH_INTERNAL_TABLES,
  TENANT_TABLES,
  TenantAccessError,
  withTenant,
  type KeyedTable,
  type OwnedTable,
  type TenantTable,
} from "@/db/repo/tenant";
import { appTables, seedDemo } from "@/db/seed";
import { DEMO_ORGS, DEMO_USERS, demoEmail, orgIdOf } from "@/db/seed/demo";
import { createAuth } from "@/lib/auth";

const NOW = new Date("2026-10-29T15:00:00Z");
const BASE = "http://localhost:3100";
// Gizli değerler her çalıştırmada üretilir; depoda parola ya da secret durmaz.
const PASSWORD = randomBytes(12).toString("hex");
const client = new PGlite();
const db = createPgliteDb(client);
const auth = createAuth(db, { secret: randomBytes(32).toString("hex"), baseURL: BASE });

const ORGS = Object.values(DEMO_ORGS).map(orgIdOf);
const NAMES = Object.keys(TENANT_TABLES) as TenantTable[];
type AnyRow = Record<string, unknown>;
let all: Record<TenantTable, AnyRow[]>;

// Sözleşme: "X kurumu bu satırı görebilir mi?" Kural repository'den bağımsız olarak burada yeniden yazılır.
function oracle(): Record<TenantTable, (row: AnyRow, x: string) => boolean> {
  const by = (name: TenantTable, key: string) => new Map(all[name].map((r) => [r[key] as string, r]));
  const listing = by("listings", "id");
  const deal = by("deals", "id");
  const production = by("productionBatches", "id");
  const evidence = by("evidenceRegister", "id");
  const profile = by("orgProfiles", "orgId");
  const own = (r: AnyRow, x: string) => r.orgId === x;
  const ownOrGlobal = (r: AnyRow, x: string) => r.orgId === null || r.orgId === x;
  const party = (d: AnyRow | undefined, x: string) => !!d && (d.sellerOrgId === x || d.buyerOrgId === x);
  return {
    organizations: (r, x) => r.id === x || profile.get(r.id as string)?.isPublic === true,
    orgProfiles: (r, x) => r.orgId === x || r.isPublic === true,
    listings: (r, x) => r.orgId === x || r.status === "open",
    offers: (r, x) => r.orgId === x || listing.get(r.listingId as string)?.orgId === x,
    deals: (r, x) => party(r, x),
    deliveries: (r, x) => party(deal.get(r.dealId as string), x),
    wasteBatches: (r, x) => r.orgId === x || r.supplierOrgId === x,
    productionBatches: own,
    batchInputs: (r, x) => production.get(r.productionBatchId as string)?.orgId === x,
    panelLots: (r, x) => r.orgId === x || r.isPublic === true,
    custodyEvents: own,
    evidenceRegister: own,
    evidenceLinks: (r, x) => evidence.get(r.evidenceId as string)?.orgId === x,
    supplierBaseline: own,
    transportQuotes: own,
    costLines: own,
    buyerTrials: own,
    transactions: own,
    saasCosts: () => true,
    referenceValues: () => true,
    modelInputs: ownOrGlobal,
    calcRuns: ownOrGlobal,
  };
}

const KEY_PROP: Record<KeyedTable, string> = {
  organizations: "id",
  orgProfiles: "orgId",
  referenceValues: "key",
  ...Object.fromEntries(
    NAMES.filter((n) => !["organizations", "orgProfiles", "referenceValues", "batchInputs", "evidenceLinks"].includes(n)).map((n) => [n, "id"]),
  ),
} as Record<KeyedTable, string>;
const isKeyed = (n: TenantTable): n is KeyedTable => n in KEY_PROP;
const keyOf = (n: TenantTable, r: AnyRow) =>
  n === "batchInputs"
    ? `${r.productionBatchId}|${r.wasteBatchId}`
    : n === "evidenceLinks"
      ? `${r.evidenceId}|${r.entityType}|${r.entityId}`
      : String(r[KEY_PROP[n as KeyedTable]]);
const OWNED: OwnedTable[] = [
  "organizations", "orgProfiles", "listings", "offers", "wasteBatches", "productionBatches", "panelLots", "custodyEvents",
  "evidenceRegister", "supplierBaseline", "transportQuotes", "costLines", "buyerTrials", "transactions", "modelInputs", "calcRuns",
];
const ownerOf = (n: OwnedTable, r: AnyRow) => (n === "organizations" ? r.id : r.orgId);

// HTTP üzerinden, tarayıcının yapacağı gibi: çerez ve Origin başlığıyla.
async function call(method: "GET" | "POST", path: string, opts: { cookie?: string; body?: unknown; query?: Record<string, string> } = {}) {
  const url = new URL(`/api/auth${path}`, BASE);
  for (const [k, v] of Object.entries(opts.query ?? {})) url.searchParams.set(k, v);
  const res = await auth.handler(
    new Request(url, {
      method,
      headers: { "content-type": "application/json", origin: BASE, ...(opts.cookie ? { cookie: opts.cookie } : {}) },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    }),
  );
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: res.status, json: json as AnyRow | null, setCookie: res.headers.getSetCookie() };
}

async function signIn(key: string): Promise<string> {
  const res = await call("POST", "/sign-in/email", { body: { email: demoEmail({ key }), password: PASSWORD } });
  expect(res.status, `${key} girişi`).toBe(200);
  return res.setCookie.map((c) => c.split(";")[0]).join("; ");
}

beforeAll(async () => {
  await migrate(db as never, { migrationsFolder: "./drizzle" });
  await seedDemo(db, { now: NOW, password: PASSWORD, env: { DEMO_MODE: "true" } });
  // Seed'de her şey paylaşılıyorsa paylaşım kuralı sınanmış olmaz: gizli bir profil ve gizli bir lot ekle.
  await db.execute(sql`update org_profiles set is_public = false where org_id = ${orgIdOf(DEMO_ORGS.e)}`);
  await db.execute(sql`update panel_lots set is_public = false where id = (select id from panel_lots order by code limit 1)`);
  // Seed'deki hesap koşuları platform geneli; kuruma özel bir koşu da olsun.
  await db.insert(calcRuns).values({
    orgId: orgIdOf(DEMO_ORGS.a),
    formula: "factory_gain",
    formulaVersion: "test",
    inputHash: "0".repeat(64),
    inputs: {},
    outputs: {},
    resultClass: "synthetic",
  });
  all = Object.fromEntries(
    await Promise.all(NAMES.map(async (n) => [n, (await db.select().from(TENANT_TABLES[n] as never)) as AnyRow[]] as const)),
  ) as Record<TenantTable, AnyRow[]>;
}, 60_000);
afterAll(() => client.close());

describe("kiracı katmanı (withTenant)", () => {
  it("şemadaki her tablo ya kiracı kataloğunda ya kimlik iç tablosu; ikisinde birden değil", () => {
    const catalog: string[] = Object.values(TENANT_TABLES).map((t) => getTableName(t));
    const internal = [...AUTH_INTERNAL_TABLES] as string[];
    expect(catalog.filter((t) => internal.includes(t))).toEqual([]);
    expect(appTables().filter((t) => !catalog.includes(t) && !internal.includes(t))).toEqual([]);
  });

  it("her kurum her tabloda tam olarak sözleşmedeki satırları görür (8 kurum × 22 tablo)", async () => {
    const rule = oracle();
    const leaks: string[] = [];
    const missing: string[] = [];
    for (const x of ORGS) {
      const t = withTenant(db, x);
      for (const n of NAMES) {
        const got = new Set((await t.list(n)).map((r) => keyOf(n, r as AnyRow)));
        const want = new Set(all[n].filter((r) => rule[n](r, x)).map((r) => keyOf(n, r)));
        for (const k of got) if (!want.has(k)) leaks.push(`${x} → ${n}/${k}`);
        for (const k of want) if (!got.has(k)) missing.push(`${x} ↛ ${n}/${k}`);
      }
    }
    expect(leaks).toEqual([]);
    expect(missing).toEqual([]);
  });

  it("sınama boş değil: paylaşılmayan her tabloda gizli kalması gereken satır var", () => {
    const rule = oracle();
    const vacuous = NAMES.filter((n) => !["saasCosts", "referenceValues"].includes(n)).filter(
      (n) => !ORGS.some((x) => all[n].some((r) => !rule[n](r, x))),
    );
    expect(vacuous).toEqual([]);
  });

  it("başka kurumun gizli satırı kimlikle istenince null döner; sahiplik denetimi geçmez", async () => {
    const rule = oracle();
    let attempts = 0;
    let successes = 0;
    for (const x of ORGS) {
      const t = withTenant(db, x);
      for (const n of NAMES.filter(isKeyed)) {
        for (const r of all[n].filter((r) => !rule[n](r, x))) {
          attempts++;
          if ((await t.get(n, keyOf(n, r))) !== null) successes++;
        }
      }
      for (const n of OWNED) {
        for (const r of all[n].filter((r) => ownerOf(n, r) !== x)) {
          attempts++;
          if (await t.owns(n, keyOf(n, r))) successes++;
        }
      }
    }
    console.info(`M-4 repository: ${attempts} deneme, ${successes} başarılı`);
    expect(attempts).toBeGreaterThan(1000);
    expect(successes).toBe(0);
  });

  it("görünür ama başkasının olan satır yazılamaz; kendi satırı yazılabilir", async () => {
    const a = withTenant(db, orgIdOf(DEMO_ORGS.a));
    const foreignOpen = all.listings.find((r) => r.orgId !== orgIdOf(DEMO_ORGS.a) && r.status === "open")!;
    expect(await a.get("listings", foreignOpen.id as string)).not.toBeNull();
    await expect(a.assertOwns("listings", foreignOpen.id as string)).rejects.toBeInstanceOf(TenantAccessError);
    const mine = all.listings.find((r) => r.orgId === orgIdOf(DEMO_ORGS.a))!;
    await expect(a.assertOwns("listings", mine.id as string)).resolves.toBeUndefined();
  });

  it("kanıt dosyasının içeriği listelerde taşınmaz; bozuk kimlik hata değil null", async () => {
    const r = withTenant(db, orgIdOf(DEMO_ORGS.reboard));
    const ev = await r.list("evidenceRegister");
    expect(ev.length).toBeGreaterThan(0);
    expect(ev.every((e) => !("content" in e))).toBe(true);
    expect(await r.get("listings", "değil-bir-uuid")).toBeNull();
    expect(await r.owns("listings", "' or 1=1 --")).toBe(false);
    expect(() => withTenant(db, "")).toThrow();
  });

  it("çağıranın koşulu görünürlük kuralını gevşetemez", async () => {
    const a = withTenant(db, orgIdOf(DEMO_ORGS.a));
    const rows = await a.list("costLines", { where: sql`true` });
    expect(rows.every((r) => r.orgId === orgIdOf(DEMO_ORGS.a))).toBe(true);
    const other = await a.list("productionBatches", { where: sql`org_id = ${orgIdOf(DEMO_ORGS.reboard)}` });
    expect(other).toEqual([]);
  });
});

describe("üyelik çözümü", () => {
  it("rol her istekte üyelik tablosundan okunur; üye olunmayan kurum etkin olamaz", async () => {
    const viewer = DEMO_USERS.find((u) => u.role === "viewer")!;
    const m = await resolveMembership(db, viewer.id, orgIdOf(DEMO_ORGS.a));
    expect(m).toMatchObject({ orgId: orgIdOf(DEMO_ORGS.reboard), roles: ["viewer"], orgKind: "producer" });
    expect(await resolveMembership(db, "olmayan-kullanici", null)).toBeNull();
    expect(await resolveMembership(db, "olmayan-kullanici", orgIdOf(DEMO_ORGS.a))).toBeNull();
  });
});

describe("Better Auth uç noktaları (HTTP)", () => {
  const supplier = DEMO_USERS.find((u) => u.key === "kaynak-a")!;
  const A = orgIdOf(DEMO_ORGS.a);
  let cookie: string;

  beforeAll(async () => {
    cookie = await signIn(supplier.key);
  });

  it("girişte etkin kurum kullanıcının kendi kurumu olur", async () => {
    const res = await call("GET", "/get-session", { cookie });
    expect((res.json?.session as AnyRow).activeOrganizationId).toBe(A);
  });

  it("A sahibi, diğer 7 kurumun kurum uç noktalarını dener: 0 başarı ve 0 yan etki", async () => {
    const before = await client.query(`select o.id, o.name, m.id as mid, m.role from organization o join member m on m.organization_id = o.id order by m.id`);
    const probes: [string, (b: string, ownerMember: AnyRow) => ReturnType<typeof call>][] = [
      ["set-active", (b) => call("POST", "/organization/set-active", { cookie, body: { organizationId: b } })],
      ["get-full-organization", (b) => call("GET", "/organization/get-full-organization", { cookie, query: { organizationId: b } })],
      ["get-organization", (b) => call("GET", "/organization/get-organization", { cookie, query: { organizationId: b } })],
      ["list-members", (b) => call("GET", "/organization/list-members", { cookie, query: { organizationId: b } })],
      ["list-invitations", (b) => call("GET", "/organization/list-invitations", { cookie, query: { organizationId: b } })],
      ["get-active-member-role", (b) => call("GET", "/organization/get-active-member-role", { cookie, query: { organizationId: b } })],
      ["update", (b) => call("POST", "/organization/update", { cookie, body: { organizationId: b, data: { name: "ele geçirildi" } } })],
      ["delete", (b) => call("POST", "/organization/delete", { cookie, body: { organizationId: b } })],
      ["invite-member", (b) => call("POST", "/organization/invite-member", { cookie, body: { organizationId: b, email: "saldirgan@demo.reboard.example", role: "owner" } })],
      ["remove-member", (b, m) => call("POST", "/organization/remove-member", { cookie, body: { organizationId: b, memberIdOrEmail: m.mid } })],
      ["update-member-role", (b, m) => call("POST", "/organization/update-member-role", { cookie, body: { organizationId: b, memberId: m.mid, role: "viewer" } })],
      ["leave", (b) => call("POST", "/organization/leave", { cookie, body: { organizationId: b } })],
      ["has-permission", (b) => call("POST", "/organization/has-permission", { cookie, body: { organizationId: b, permissions: { listing: ["create"] } } })],
      ["list-roles", (b) => call("GET", "/organization/list-roles", { cookie, query: { organizationId: b } })],
    ];
    const wins: string[] = [];
    let attempts = 0;
    for (const b of ORGS.filter((o) => o !== A)) {
      const ownerMember = before.rows.find((r) => (r as AnyRow).id === b) as AnyRow;
      for (const [name, probe] of probes) {
        attempts++;
        const res = await probe(b, ownerMember);
        const granted = name === "has-permission" ? res.json?.success === true : res.status === 200 && res.json !== null;
        if (granted) wins.push(`${name} → ${b} (${res.status})`);
      }
    }
    console.info(`M-4 HTTP: ${attempts} deneme, ${wins.length} başarılı`);
    expect(wins).toEqual([]);
    const after = await client.query(`select o.id, o.name, m.id as mid, m.role from organization o join member m on m.organization_id = o.id order by m.id`);
    expect(after.rows).toEqual(before.rows);
    expect((await client.query(`select count(*)::int as n from invitation`)).rows).toEqual([{ n: 0 }]);
  });

  it("aynı kullanıcı kendi kurumunda başarılı (pozitif kontrol)", async () => {
    expect((await call("POST", "/organization/set-active", { cookie, body: { organizationId: A } })).status).toBe(200);
    const full = await call("GET", "/organization/get-full-organization", { cookie, query: { organizationId: A } });
    expect(full.status).toBe(200);
    expect(full.json?.name).toBe(DEMO_ORGS.a.name);
    const perm = await call("POST", "/organization/has-permission", { cookie, body: { organizationId: A, permissions: { listing: ["create"] } } });
    expect(perm.json?.success).toBe(true);
  });

  it("izleyici kendi kurumunda da yazamaz", async () => {
    const viewerCookie = await signIn("reboard-izleyici");
    const R = orgIdOf(DEMO_ORGS.reboard);
    const perm = await call("POST", "/organization/has-permission", { cookie: viewerCookie, body: { organizationId: R, permissions: { listing: ["create"] } } });
    expect(perm.json?.success).toBe(false);
    const upd = await call("POST", "/organization/update", { cookie: viewerCookie, body: { organizationId: R, data: { name: "x" } } });
    expect(upd.status).toBe(403);
    const inv = await call("POST", "/organization/invite-member", { cookie: viewerCookie, body: { organizationId: R, email: "x@demo.reboard.example", role: "viewer" } });
    expect(inv.status).toBe(403);
  });

  it("kayıt ve kurum açma kapalı; oturumsuz istek reddedilir", async () => {
    const signUp = await call("POST", "/sign-up/email", { body: { email: "yeni@demo.reboard.example", password: PASSWORD, name: "Yeni" } });
    expect(signUp.status).not.toBe(200);
    const create = await call("POST", "/organization/create", { cookie, body: { name: "Sahte", slug: "sahte" } });
    expect(create.status).toBe(403);
    const anon = await call("GET", "/organization/get-full-organization", { query: { organizationId: A } });
    expect(anon.status).toBe(401);
    expect((await client.query(`select count(*)::int as n from "user"`)).rows).toEqual([{ n: DEMO_USERS.length }]);
  });
});
