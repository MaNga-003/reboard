"use server";
// İzlenebilirlik eylemleri (T2.2). Sıra: oturum → rol → Zod (src/lib/action.ts) → depo kuralları (src/domain/traceability).
// Hata kodu arayüzde trace.errors.* metnine çevrilir. Yok ile yetkisiz aynı koddur (not_found): varlık sızdırılmaz.
import { z } from "zod";
import { getDb } from "@/db/client";
import { TenantAccessError } from "@/db/repo/tenant";
import { TraceRuleError, checkEvidence, createProduction, receiveDelivery, uploadEvidence } from "@/db/repo/trace";
import { can } from "@/domain/access";
import { BINDERS } from "@/domain/panel";
import { EVIDENCE_KINDS } from "@/domain/traceability";
import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { authorize } from "@/lib/action";
import { SILK, blank, compositionFields, compositionOf, decimal, locale, optionalDecimal, silkOf } from "@/lib/form";
import { getViewer } from "@/lib/viewer";

export type TraceFormState = { error: string; fields?: string[] } | null;

const note = z.string().trim().max(500).default("");

const receiveSchema = z.object({
  locale,
  deliveryId: z.uuid(),
  declaredKg: optionalDecimal(3),
  weighedKg: optionalDecimal(3),
  moisturePct: optionalDecimal(2),
  rejectedKg: optionalDecimal(3),
  silk: z.enum(SILK),
  notes: note,
  ...compositionFields,
});

const uploadSchema = z.object({ locale, wasteBatchId: z.uuid(), kind: z.enum(EVIDENCE_KINDS), file: z.file() });

const checkSchema = z.object({ locale, batchId: z.uuid(), id: z.uuid() });

const productionSchema = z.object({
  locale,
  binder: z.enum(BINDERS),
  inputs: z.array(z.object({ wasteBatchId: z.uuid(), kg: decimal(3) })).max(50),
  outputKg: decimal(3),
  scrapKg: decimal(3),
  moistureLossKg: decimal(3),
  balanceNote: note,
  sheetCount: z.union([blank, z.coerce.number().int().min(1).max(100_000)]),
  densityKgM3: optionalDecimal(1),
});

function failure(e: unknown): TraceFormState {
  if (e instanceof TraceRuleError) return { error: e.code };
  if (e instanceof TenantAccessError) return { error: "not_found" };
  throw e;
}

const go = (lang: string, pathname: string, query: Record<string, string>) => redirect({ href: { pathname, query }, locale: lang });

export async function receiveAction(_prev: TraceFormState, formData: FormData): Promise<TraceFormState> {
  const viewer = await getViewer();
  const gate = authorize(viewer, { resource: "wasteBatch", action: "receive" }, receiveSchema, Object.fromEntries(formData));
  if (!gate.ok) return { error: gate.error, fields: gate.fields };
  const v = gate.input;
  let got: { id: string };
  try {
    got = await receiveDelivery(getDb(), { orgId: viewer!.orgId, userId: viewer!.userId }, v.deliveryId, {
      declaredKg: v.declaredKg,
      weighedKg: v.weighedKg,
      moisturePct: v.moisturePct,
      rejectedKg: v.rejectedKg,
      containsSilk: silkOf(v.silk),
      composition: compositionOf(v),
      notes: v.notes || null,
    });
  } catch (e) {
    return failure(e);
  }
  return go(v.locale, `/izlenebilirlik/parti/${got.id}`, { durum: "received" });
}

export async function uploadEvidenceAction(_prev: TraceFormState, formData: FormData): Promise<TraceFormState> {
  const viewer = await getViewer();
  const gate = authorize(viewer, { resource: "evidence", action: "upload" }, uploadSchema, Object.fromEntries(formData));
  if (!gate.ok) return { error: gate.error, fields: gate.fields };
  const v = gate.input;
  try {
    await uploadEvidence(getDb(), { orgId: viewer!.orgId, userId: viewer!.userId }, {
      wasteBatchId: v.wasteBatchId,
      kind: v.kind,
      fileName: v.file.name,
      bytes: new Uint8Array(await v.file.arrayBuffer()),
    });
  } catch (e) {
    return failure(e);
  }
  return go(v.locale, `/izlenebilirlik/parti/${v.wasteBatchId}`, { durum: "uploaded" });
}

/** Tek düğme: sonuç ya da hata parti sayfasına sorgu parametresiyle döner; JavaScript gerekmez. */
export async function checkEvidenceAction(formData: FormData): Promise<void> {
  const viewer = await getViewer();
  const raw = Object.fromEntries(formData);
  const lang = locale.safeParse(raw.locale).data ?? routing.defaultLocale;
  if (!viewer) return redirect({ href: "/giris", locale: lang });
  const gate = authorize(viewer, { resource: "evidence", action: "check" }, checkSchema, raw);
  const batchId = z.uuid().safeParse(raw.batchId).data;
  const back = (query: Record<string, string>) => (batchId ? go(lang, `/izlenebilirlik/parti/${batchId}`, query) : go(lang, "/izlenebilirlik", query));
  if (!gate.ok) return back({ hata: gate.error });
  let state: TraceFormState = null;
  try {
    await checkEvidence(getDb(), { orgId: viewer.orgId, userId: viewer.userId }, gate.input.id);
  } catch (e) {
    state = failure(e);
  }
  return back(state ? { hata: state.error } : { durum: "checked" });
}

/** Tahsis alanları a_<partiKimliği> adıyla gelir; boş bırakılan parti tahsise girmez. */
function withInputs(raw: Record<string, FormDataEntryValue>) {
  const inputs = Object.entries(raw)
    .filter(([k, v]) => k.startsWith("a_") && String(v).trim() !== "")
    .map(([k, v]) => ({ wasteBatchId: k.slice(2), kg: String(v) }));
  return { ...raw, inputs };
}

export async function createProductionAction(_prev: TraceFormState, formData: FormData): Promise<TraceFormState> {
  const viewer = await getViewer();
  const raw = withInputs(Object.fromEntries(formData));
  const gate = authorize(viewer, { resource: "production", action: "create" }, productionSchema, raw);
  if (!gate.ok) {
    // Hatalı tahsis satırı formdaki alanına (a_<kimlik>) geri bağlanır.
    const fields = gate.fields?.map((f) => (/^inputs\.(\d+)/.test(f) ? `a_${raw.inputs[Number(f.split(".")[1])]?.wasteBatchId}` : f));
    return { error: gate.error, fields };
  }
  const v = gate.input;
  if (v.sheetCount !== null && !can(viewer!.roles.join(","), "panelLot", "create")) return { error: "forbidden" };
  let made: { lotId: string | null };
  try {
    made = await createProduction(getDb(), { orgId: viewer!.orgId, userId: viewer!.userId }, {
      inputs: v.inputs,
      outputKg: v.outputKg,
      scrapKg: v.scrapKg,
      moistureLossKg: v.moistureLossKg,
      balanceNote: v.balanceNote || null,
      sheetCount: v.sheetCount,
      densityKgM3: v.densityKgM3,
      binder: v.binder,
    });
  } catch (e) {
    return failure(e);
  }
  return made.lotId ? go(v.locale, `/izlenebilirlik/lot/${made.lotId}`, { durum: "produced" }) : go(v.locale, "/izlenebilirlik", { durum: "produced" });
}
