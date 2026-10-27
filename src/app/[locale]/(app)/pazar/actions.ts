"use server";
// Pazar yeri eylemleri (T2.1). Sıra: oturum → rol → Zod (src/lib/action.ts) → depo kuralları (src/domain/market.ts).
// Hata kodu arayüzde market.errors.* metnine çevrilir. Yok ile yetkisiz aynı koddur (not_found): varlık sızdırılmaz.
import { z } from "zod";
import { getDb } from "@/db/client";
import { MarketRuleError, acceptOffer, closeListing, createListing, placeOffer, rejectOffer, withdrawOffer } from "@/db/repo/market";
import { TenantAccessError } from "@/db/repo/tenant";
import { FIBRES, type Composition } from "@/domain/fibre";
import { LISTING_KINDS, MARKET_UNITS, RECURRENCES, isWaste } from "@/domain/market";
import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { authorize, type Permission } from "@/lib/action";
import { getViewer } from "@/lib/viewer";

export type MarketFormState = { error: string; fields?: string[] } | null;

const locale = z.enum(routing.locales);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const optionalDay = z.union([z.literal("").transform(() => null), day]);
// Virgüllü ondalık da kabul edilir (Türkçe klavye).
const decimal = (scale: number) =>
  z
    .string()
    .trim()
    .transform((s) => s.replace(",", "."))
    .pipe(z.string().regex(new RegExp(`^\\d{1,9}(\\.\\d{1,${scale}})?$`)));
const PAYERS = ["buyer", "seller", "none", "unknown"] as const;

/** "Kim öder" ve tutar işaretli birim fiyata çevrilir: alıcı öderse +, satıcı kabul bedeli öderse −. */
const price = {
  payer: z.enum(PAYERS),
  amount: z.union([z.literal("").transform(() => null), decimal(2)]),
};
function signedPrice(payer: (typeof PAYERS)[number], amount: string | null): string | null {
  if (payer === "unknown") return null;
  if (payer === "none") return "0";
  return payer === "seller" ? `-${amount}` : amount;
}
const priceNeedsAmount = (v: { payer: string; amount: string | null }) => !["buyer", "seller"].includes(v.payer) || (v.amount !== null && Number(v.amount) > 0);

const FIBRE_FIELDS = FIBRES.filter((f) => f !== "unknown");
const share = z.union([z.literal("").transform(() => null), z.coerce.number().int().min(0).max(100)]);

const listingSchema = z
  .object({
    locale,
    kind: z.enum(LISTING_KINDS),
    title: z.string().trim().min(3).max(120),
    quantity: decimal(3),
    unit: z.enum(MARKET_UNITS),
    recurrence: z.enum(RECURRENCES),
    windowStart: optionalDay,
    windowEnd: optionalDay,
    silk: z.enum(["no", "yes", "unknown"]).default("unknown"),
    ...Object.fromEntries(FIBRE_FIELDS.map((f) => [`c_${f}`, share.optional()])),
    ...price,
  })
  .refine(priceNeedsAmount, { path: ["amount"] });

const offerSchema = z
  .object({ locale, listingId: z.uuid(), quantity: decimal(3), proposedDate: day, message: z.string().trim().max(300).default(""), ...price })
  .refine(priceNeedsAmount, { path: ["amount"] });

const refSchema = z.object({ locale, listingId: z.uuid(), id: z.uuid() });

function failure(e: unknown): MarketFormState {
  if (e instanceof MarketRuleError) return { error: e.code };
  if (e instanceof TenantAccessError) return { error: "not_found" };
  throw e;
}

const detail = (lang: string, listingId: string, query: Record<string, string>) =>
  redirect({ href: { pathname: `/pazar/${listingId}`, query }, locale: lang });

export async function createListingAction(_prev: MarketFormState, formData: FormData): Promise<MarketFormState> {
  const viewer = await getViewer();
  const gate = authorize(viewer, { resource: "listing", action: "create" }, listingSchema, Object.fromEntries(formData));
  if (!gate.ok) return { error: gate.error, fields: gate.fields };
  const v = gate.input as z.output<typeof listingSchema> & Record<string, number | null | undefined>;
  const waste = isWaste(v.kind);
  const composition = Object.fromEntries(FIBRE_FIELDS.flatMap((f) => (typeof v[`c_${f}`] === "number" ? [[f, v[`c_${f}`]]] : []))) as Composition;
  let id: string;
  try {
    id = await createListing(getDb(), viewer!.orgId, {
      kind: v.kind,
      title: v.title,
      quantity: v.quantity,
      unit: v.unit,
      recurrence: v.recurrence,
      windowStart: v.windowStart,
      windowEnd: v.windowEnd,
      composition: waste && Object.keys(composition).length ? composition : null,
      containsSilk: waste ? (v.silk === "unknown" ? null : v.silk === "yes") : null,
      unitPrice: signedPrice(v.payer, v.amount),
      currency: "TRY",
      taxBasis: "excl_vat",
    });
  } catch (e) {
    return failure(e);
  }
  return detail(v.locale, id, { durum: "created" });
}

export async function placeOfferAction(_prev: MarketFormState, formData: FormData): Promise<MarketFormState> {
  const viewer = await getViewer();
  const gate = authorize(viewer, { resource: "offer", action: "create" }, offerSchema, Object.fromEntries(formData));
  if (!gate.ok) return { error: gate.error, fields: gate.fields };
  const v = gate.input;
  try {
    await placeOffer(getDb(), viewer!.orgId, v.listingId, {
      quantity: v.quantity,
      unitPrice: signedPrice(v.payer, v.amount),
      proposedDate: v.proposedDate,
      message: v.message || null,
    });
  } catch (e) {
    return failure(e);
  }
  return detail(v.locale, v.listingId, { durum: "offered" });
}

/** Tek düğmeli eylemler: sonuç ya da hata ilan sayfasına sorgu parametresiyle döner; JavaScript gerekmez. */
async function run(formData: FormData, permission: Permission, op: (orgId: string, id: string) => Promise<unknown>, notice: string) {
  const viewer = await getViewer();
  const raw = Object.fromEntries(formData);
  const lang = locale.safeParse(raw.locale).data ?? routing.defaultLocale;
  if (!viewer) return redirect({ href: "/giris", locale: lang });
  const gate = authorize(viewer, permission, refSchema, raw);
  if (!gate.ok) {
    const listingId = z.uuid().safeParse(raw.listingId).data;
    return listingId ? detail(lang, listingId, { hata: gate.error }) : redirect({ href: { pathname: "/pazar", query: { hata: gate.error } }, locale: lang });
  }
  let state: MarketFormState = null;
  try {
    await op(viewer.orgId, gate.input.id);
  } catch (e) {
    state = failure(e);
  }
  return detail(lang, gate.input.listingId, state ? { hata: state.error } : { durum: notice });
}

export async function acceptOfferAction(formData: FormData): Promise<void> {
  await run(formData, { resource: "offer", action: "respond" }, (org, id) => acceptOffer(getDb(), org, id), "accepted");
}

export async function rejectOfferAction(formData: FormData): Promise<void> {
  await run(formData, { resource: "offer", action: "respond" }, (org, id) => rejectOffer(getDb(), org, id), "rejected");
}

export async function withdrawOfferAction(formData: FormData): Promise<void> {
  await run(formData, { resource: "offer", action: "create" }, (org, id) => withdrawOffer(getDb(), org, id), "withdrawn");
}

export async function closeListingAction(formData: FormData): Promise<void> {
  await run(formData, { resource: "listing", action: "close" }, (org, id) => closeListing(getDb(), org, id), "closed");
}
