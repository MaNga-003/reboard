import { describe, expect, it } from "vitest";
import { z } from "zod";
import { authorize } from "@/lib/action";

const schema = z.object({ kg: z.coerce.number().positive(), note: z.string().max(10) });
const create = { resource: "listing", action: "create" } as const;

describe("eylem kapısı", () => {
  it("oturum yoksa girdiye bakmadan reddeder", () => {
    expect(authorize(null, create, schema, { kg: "x" })).toEqual({ ok: false, error: "unauthenticated" });
  });

  it("yetkisiz rol girdi hatasını değil yetki hatasını görür", () => {
    expect(authorize({ roles: ["viewer"] }, create, schema, { kg: "x" })).toEqual({ ok: false, error: "forbidden" });
    expect(authorize({ roles: [] }, create, schema, { kg: 1, note: "" })).toEqual({ ok: false, error: "forbidden" });
  });

  it("yetkili rolde girdi doğrulanır; hatalı alanlar adlarıyla döner", () => {
    expect(authorize({ roles: ["operator"] }, create, schema, { kg: "-2", note: "çok uzun bir not" })).toEqual({
      ok: false,
      error: "invalid",
      fields: ["kg", "note"],
    });
    expect(authorize({ roles: ["viewer", "operator"] }, create, schema, { kg: "12.5", note: "ok" })).toEqual({
      ok: true,
      input: { kg: 12.5, note: "ok" },
    });
  });

  it("izin gerektirmeyen eylemde yalnızca oturum ve girdi denetlenir", () => {
    expect(authorize({ roles: ["viewer"] }, null, schema, { kg: 1, note: "" }).ok).toBe(true);
  });
});
