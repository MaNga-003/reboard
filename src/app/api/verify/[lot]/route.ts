// Açık doğrulama ucu (T2.4, D-025). Girişsiz: lotun soy ağacına dokunan her olay zinciri ilk olaydan yeniden hesaplanır.
// `a` etiket çapasıdır (QR'daki adresle aynı); verilirse üretici zinciri ona göre de denetlenir.
// Yanıtta yalnızca hüküm, sayı ve hash bulunur; olayların içeriği pasaport sayfasındaki süzülmüş haliyle kalır.
import type { NextRequest } from "next/server";
import { getDb } from "@/db/client";
import { publicPassport } from "@/db/repo/passport";
import { formatAnchor, parseAnchor } from "@/domain/traceability";

const HEADERS = {
  "Cache-Control": "no-store",
  // Herkes kendi sayfasından ya da betiğinden doğrulayabilsin; uç çerez okumaz, yalnızca okur.
  "Access-Control-Allow-Origin": "*",
};

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: HEADERS });

export async function GET(req: NextRequest, ctx: RouteContext<"/api/verify/[lot]">) {
  const { lot } = await ctx.params;
  const raw = req.nextUrl.searchParams.get("a");
  const label = raw === null ? null : parseAnchor(raw);
  if (raw !== null && !label) return json({ error: "anchor_invalid" }, 400);
  const v = await publicPassport(getDb(), lot, label);
  if (!v) return json({ error: "not_found" }, 404);
  return json({
    lot: v.lot.code,
    ok: v.ok,
    checkedAt: new Date().toISOString(),
    resultClass: v.resultClass,
    anchor: v.anchor && formatAnchor(v.anchor),
    anchorChecked: v.anchorChecked,
    chains: v.chains.map((c) => ({ role: c.role, name: c.name, ...c.verdict })),
  });
}
