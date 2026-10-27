import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { can, GRANTS, isRole, permissionList, ROLES, rolesOf, STATEMENTS, type Resource } from "@/domain/access";

const pairs = (Object.keys(STATEMENTS) as Resource[]).flatMap((r) => STATEMENTS[r].map((a) => [r, a] as const));

describe("roller ve yetkiler", () => {
  it("sahip ve yönetici her eylemi yapar", () => {
    for (const [r, a] of pairs) {
      expect(can("owner", r, a as never), `${r}.${a}`).toBe(true);
      expect(can("admin", r, a as never), `${r}.${a}`).toBe(true);
    }
  });

  it("izleyici hiçbir yazma eylemi yapamaz", () => {
    expect(permissionList("viewer").filter((p) => p.allowed)).toEqual([]);
  });

  it("operatör kayıt girer; kanıtı mutabık sayamaz, demoyu sıfırlayamaz", () => {
    expect(can("operator", "listing", "create")).toBe(true);
    expect(can("operator", "wasteBatch", "receive")).toBe(true);
    expect(can("operator", "evidence", "upload")).toBe(true);
    expect(can("operator", "evidence", "check")).toBe(false);
    expect(can("operator", "demo", "reset")).toBe(false);
  });

  it("yetkiler rol sırasıyla iç içe: izleyici ⊆ operatör ⊆ yönetici = sahip", () => {
    const allowed = (role: string) => new Set(permissionList(role).filter((p) => p.allowed).map((p) => `${p.resource}.${p.action}`));
    const [viewer, operator, admin, owner] = ["viewer", "operator", "admin", "owner"].map(allowed);
    expect([...viewer].every((x) => operator.has(x))).toBe(true);
    expect([...operator].every((x) => admin.has(x))).toBe(true);
    expect([...admin]).toEqual([...owner]);
    expect(operator.size).toBeLessThan(admin.size);
  });

  it("bilinmeyen, boş ya da sahte rol hiçbir şey yapamaz", () => {
    for (const role of [null, undefined, "", "member", "OWNER", " ", "root"]) {
      expect(permissionList(role).some((p) => p.allowed), String(role)).toBe(false);
    }
    fc.assert(
      fc.property(fc.string(), (s) => {
        if (rolesOf(s).length) return true;
        return pairs.every(([r, a]) => !can(s, r, a as never));
      }),
    );
  });

  it("virgülle ayrılmış roller birleşir", () => {
    expect(rolesOf("viewer, operator")).toEqual(["viewer", "operator"]);
    expect(can("viewer,operator", "listing", "create")).toBe(true);
    expect(can("viewer,member", "listing", "create")).toBe(false);
  });

  it("her rolün izni tanımlı kaynak ve eylemlerden oluşur", () => {
    for (const role of ROLES) {
      for (const [resource, actions] of Object.entries(GRANTS[role])) {
        expect(Object.keys(STATEMENTS), `${role}: ${resource}`).toContain(resource);
        for (const a of actions ?? []) expect(STATEMENTS[resource as Resource] as readonly string[]).toContain(a);
      }
    }
    expect(isRole("viewer")).toBe(true);
    expect(isRole(42)).toBe(false);
  });
});
