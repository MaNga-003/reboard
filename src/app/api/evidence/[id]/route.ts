// Kanıt dosyası indirme (D-018). Yalnızca kanıtın sahibi kurum; yok ile yetkisiz aynı yanıt (404), varlık sızdırılmaz.
// Dosya kullanıcıdan geldi: tarayıcı içinde çalıştırılmasın diye ek olarak indirilir, tür tahmini ve betik kapalıdır.
import type { NextRequest } from "next/server";
import { getDb } from "@/db/client";
import { evidenceFile } from "@/db/repo/trace";
import { getViewer } from "@/lib/viewer";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/evidence/[id]">) {
  const viewer = await getViewer();
  if (!viewer) return new Response(null, { status: 401, headers: { "Cache-Control": "no-store" } });
  const { id } = await ctx.params;
  const file = await evidenceFile(getDb(), viewer.orgId, id);
  if (!file) return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  const { meta, bytes } = file;
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": meta.mime,
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(meta.fileName)}`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox; default-src 'none'",
      "Cache-Control": "private, no-store",
    },
  });
}
