// Server Action kapısı: kimlik → yetki → girdi. Sıra bilinçli: yetkisiz kişi girdi doğrulama ayrıntısı bile görmez.
// Saf tutuldu; oturum ve veritabanı çağıran eylemde okunur, burada yalnızca karar verilir.
import type { z } from "zod";
import { can, type Action, type Resource } from "@/domain/access";
import type { Membership } from "@/db/repo/membership";

export type ActionError = "unauthenticated" | "forbidden" | "invalid";
export type ActionFailure = { ok: false; error: ActionError; fields?: string[] };
export type ActionResult<T> = { ok: true; data: T } | ActionFailure;

export type Permission = { [R in Resource]: { resource: R; action: Action<R> } }[Resource];

export function authorize<S extends z.ZodType>(
  viewer: Pick<Membership, "roles"> | null,
  permission: Permission | null,
  schema: S,
  input: unknown,
): { ok: true; input: z.output<S> } | ActionFailure {
  if (!viewer) return { ok: false, error: "unauthenticated" };
  if (permission && !can(viewer.roles.join(","), permission.resource, permission.action as never)) return { ok: false, error: "forbidden" };
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid", fields: [...new Set(parsed.error.issues.map((i) => i.path.join(".")))] };
  return { ok: true, input: parsed.data };
}
