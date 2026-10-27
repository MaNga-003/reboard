// Roller ve yetkiler (D-010). Tek kaynak burası: Better Auth organizasyon eklentisi de bu tabloyla kurulur.
// Okuma yetkisi rolden değil kiracılıktan gelir (D-016, withTenant); burada yalnızca yazma eylemleri var.

export const ROLES = ["owner", "admin", "operator", "viewer"] as const;
export type Role = (typeof ROLES)[number];

export const STATEMENTS = {
  listing: ["create", "update", "close"],
  offer: ["create", "respond"],
  delivery: ["plan", "update"],
  wasteBatch: ["receive", "update"],
  evidence: ["upload", "check"],
  production: ["create"],
  panelLot: ["create"],
  economics: ["write"],
  demo: ["reset"],
} as const;

export type Resource = keyof typeof STATEMENTS;
export type Action<R extends Resource = Resource> = (typeof STATEMENTS)[R][number];
export type Grants = { [R in Resource]?: readonly Action<R>[] };

export const GRANTS: Record<Role, Grants> = {
  owner: STATEMENTS,
  admin: STATEMENTS,
  // Açık liste: yeni bir kaynak operatöre kendiliğinden açılmasın.
  // Görev ayrılığı: kanıtı yükleyen kişi onu mutabık sayamaz; kontrol yönetici işidir.
  operator: {
    listing: STATEMENTS.listing,
    offer: STATEMENTS.offer,
    delivery: STATEMENTS.delivery,
    wasteBatch: STATEMENTS.wasteBatch,
    evidence: ["upload"],
    production: STATEMENTS.production,
    panelLot: STATEMENTS.panelLot,
    economics: STATEMENTS.economics,
  },
  viewer: {},
};

export const isRole = (x: unknown): x is Role => typeof x === "string" && (ROLES as readonly string[]).includes(x);

/** Better Auth bir üyeye virgülle ayrılmış birden çok rol verebilir; herhangi biri yetkiliyse yeter. */
export function rolesOf(value: string | null | undefined): Role[] {
  return (value ?? "")
    .split(",")
    .map((r) => r.trim())
    .filter(isRole);
}

export function can<R extends Resource>(role: string | null | undefined, resource: R, action: Action<R>): boolean {
  return rolesOf(role).some((r) => (GRANTS[r][resource] as readonly string[] | undefined)?.includes(action) ?? false);
}

/** Arayüzde ve testlerde rolün yapabildiklerini sırayla listelemek için. */
export function permissionList(role: string | null | undefined): { resource: Resource; action: Action; allowed: boolean }[] {
  return (Object.keys(STATEMENTS) as Resource[]).flatMap((resource) =>
    (STATEMENTS[resource] as readonly Action[]).map((action) => ({ resource, action, allowed: can(role, resource, action as never) })),
  );
}
