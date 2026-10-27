// Better Auth rolleri alan tablosundan (src/domain/access.ts) kurulur; iki taraf aynı kararı vermeli.
import { describe, expect, it } from "vitest";
import { can, ROLES, STATEMENTS, type Resource } from "@/domain/access";
import { roles } from "@/lib/auth";

const pairs = (Object.keys(STATEMENTS) as Resource[]).flatMap((r) => STATEMENTS[r].map((a) => [r, a] as const));
type Req = Parameters<(typeof roles)["owner"]["authorize"]>[0];
const allows = (role: keyof typeof roles, req: Record<string, string[]>) => roles[role].authorize(req as Req).success;

describe("Better Auth rolleri", () => {
  it("her rol ve her eylemde alan tablosuyla aynı kararı verir", () => {
    expect(Object.keys(roles).sort()).toEqual([...ROLES].sort());
    const diff: string[] = [];
    for (const role of ROLES) {
      for (const [r, a] of pairs) if (allows(role, { [r]: [a] }) !== can(role, r, a as never)) diff.push(`${role} ${r}.${a}`);
    }
    expect(diff).toEqual([]);
  });

  it("kurum yönetimi: yalnızca sahip siler; operatör ve izleyici üye ya da davet yönetemez", () => {
    expect(allows("owner", { organization: ["delete"] })).toBe(true);
    expect(allows("admin", { organization: ["delete"] })).toBe(false);
    expect(allows("admin", { member: ["update"] })).toBe(true);
    for (const role of ["operator", "viewer"] as const) {
      expect(allows(role, { organization: ["update"] }), role).toBe(false);
      expect(allows(role, { member: ["create"] }), role).toBe(false);
      expect(allows(role, { invitation: ["create"] }), role).toBe(false);
    }
  });
});
