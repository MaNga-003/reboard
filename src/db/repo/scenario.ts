// Senaryo ekranının karşılaştırma değerleri (D-029). Senaryo girdisi değildir, hesaba girmez; girdiyi doldururken
// yanına konan kaynaklı değerlerdir. Aralık iki satırdır: en düşük ve en yüksek.
import { inArray } from "drizzle-orm";
import type { ScenarioKey } from "../../domain/calc";
import { referenceValues } from "../schema";
import type { Tenant, TenantRow } from "./tenant";

export const SCENARIO_REFERENCES = [
  { id: "ibbSeymen", keys: ["ibb_gate_fee_seymen"], input: "disposalPerT" },
  { id: "ibbKomurcuoda", keys: ["ibb_gate_fee_komurcuoda"], input: "disposalPerT" },
  { id: "particleboard", keys: ["particleboard_18mm_sheet_min", "particleboard_18mm_sheet_max"], input: "equivalentProduct" },
  { id: "mdf", keys: ["mdf_18mm_sheet_min", "mdf_18mm_sheet_max"], input: "equivalentProduct" },
  { id: "electricity", keys: ["electricity_tl_kwh_2026h1"], input: "operations" },
] as const satisfies readonly { id: string; keys: readonly [string] | readonly [string, string]; input: ScenarioKey }[];

export type ScenarioReferenceId = (typeof SCENARIO_REFERENCES)[number]["id"];
export type ScenarioReference = { id: ScenarioReferenceId; input: ScenarioKey; rows: TenantRow<"referenceValues">[] };

/** Satırı eksik değer listede yoktur: yarım aralık gösterilmez. */
export async function scenarioReferences(tenant: Tenant): Promise<ScenarioReference[]> {
  const keys = SCENARIO_REFERENCES.flatMap((r) => r.keys);
  const rows = await tenant.list("referenceValues", { where: inArray(referenceValues.key, keys) });
  const byKey = new Map(rows.map((r) => [r.key, r]));
  return SCENARIO_REFERENCES.flatMap((r) => {
    const found = r.keys.map((k) => byKey.get(k));
    return found.every((x): x is TenantRow<"referenceValues"> => x !== undefined) ? [{ id: r.id, input: r.input, rows: found }] : [];
  });
}
