// M-34 (T4.7, D-028): arayüz metinlerindeki her olgu adayı docs/RESEARCH.md §8'de bir dayanakla listelenir. Aday: yer
// tutucular dışında rakam ya da kurum, yasa, standart adı. Yeni bir sayı ya da kurum adı listeye girmeden derlenmez gibi
// davranır: test düşer. Kaynak satırı bağlantı ve okunma tarihi, kural ve ekip satırı var olan bir karar ya da dosya gösterir.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import tr from "../../messages/tr.json";

function flatten(obj: unknown, prefix = ""): Record<string, string> {
  if (obj === null || typeof obj !== "object") return { [prefix]: String(obj) };
  return Object.entries(obj).reduce<Record<string, string>>(
    (acc, [k, v]) => ({ ...acc, ...flatten(v, prefix ? `${prefix}.${k}` : k) }),
    {},
  );
}

// Kurum, veri seti, yasa ve standart adları: rakamsız da olgu bildirir ("Kaynak: TCMB").
const NAMES =
  /(?<![\p{L}\p{N}])(AB|EU|ISO|KVKK|GDPR|yasa|kanun|yönetmelik|regulation|directive|direktif|Eurostat|TCMB|CBRT|İBB|EPCIS|GS1|UNTP|DPP|Sentinel|Copernicus|CO₂e?|CO2e?)(?![\p{L}\p{N}])/iu;

// Yer tutucu ({count}, {value, number}) ve çoğul seçicisi (=0) sayılmaz; çoğul dallarının metni sayılır.
const withoutPlaceholders = (text: string) => text.replace(/=\d+(?=\s*\{)/g, "").replace(/\{\s*\w+\s*(?:,[^{}]*)?\}/g, "");
const isFactCandidate = (text: string) => /\d/.test(withoutPlaceholders(text)) || NAMES.test(text);

type Row = { keys: string[]; kind: "kaynak" | "kural" | "ekip"; basis: string };

const ROOT = resolve(".");
const RESEARCH = readFileSync(resolve("docs/RESEARCH.md"), "utf8");
const DECISIONS = readFileSync(resolve("docs/DECISIONS.md"), "utf8");
const section = RESEARCH.split(/^## /m).find((s) => s.startsWith("8. Arayüzdeki olgular")) ?? "";
const bodyLines = section.split("\n").filter((l) => l.startsWith("| `"));
const rows: Row[] = bodyLines.flatMap((line) => {
  const m = /^\| ((?:`[^`]+`(?:, )?)+) \| (kaynak|kural|ekip) \| (.+) \|$/.exec(line);
  return m ? [{ keys: [...m[1].matchAll(/`([^`]+)`/g)].map((k) => k[1]), kind: m[2] as Row["kind"], basis: m[3] }] : [];
});
const listed = rows.flatMap((r) => r.keys);

const trText = flatten(tr);
const enText = flatten(en);
const candidates = Object.keys(trText).filter((k) => isFactCandidate(trText[k]) || isFactCandidate(enText[k] ?? ""));

/** Kural ve ekip satırının dayanakları: karar kimlikleri ve ters tırnaklı dosya yolları. */
function refs(basis: string) {
  const decisions = [...basis.matchAll(/D-\d{3}/g)].map((m) => m[0]);
  const files = [...basis.matchAll(/`([^`]+\.(?:md|ts|mjs))`/g)].map((m) => m[1]);
  return { decisions, files };
}

describe("arayüzdeki olgular (RESEARCH.md §8)", () => {
  it("tablonun her satırı okunur", () => {
    expect(section, "RESEARCH.md: '## 8. Arayüzdeki olgular' bölümü yok").not.toBe("");
    expect(rows.length).toBe(bodyLines.length);
    expect(rows.length).toBeGreaterThan(0);
  });

  it("her olgu adayı listede", () => {
    expect(candidates.filter((k) => !listed.includes(k))).toEqual([]);
  });

  it("listede metinlerde olmayan ya da aday olmayan anahtar yok", () => {
    expect(listed.filter((k) => !candidates.includes(k))).toEqual([]);
  });

  it("her anahtar bir kez", () => {
    expect(listed.filter((k, i) => listed.indexOf(k) !== i)).toEqual([]);
  });

  it("kaynak satırı birincil kaynak bağlantısı ve okunma tarihi taşır", () => {
    const bad = rows
      .filter((r) => r.kind === "kaynak")
      .filter((r) => !/\]\(https:\/\/[^)\s]+\)/.test(r.basis) || !/Okunma 20\d\d-\d\d-\d\d/.test(r.basis))
      .map((r) => r.keys.join(", "));
    expect(bad).toEqual([]);
  });

  it("kural ve ekip satırı var olan bir karar ya da dosya gösterir", () => {
    const bad = rows
      .filter((r) => r.kind !== "kaynak")
      .flatMap((r) => {
        const { decisions, files } = refs(r.basis);
        if (decisions.length + files.length === 0) return [`${r.keys[0]}: dayanak yok`];
        return [
          ...decisions.filter((d) => !DECISIONS.includes(`### ${d} `)).map((d) => `${r.keys[0]}: ${d} DECISIONS.md'de yok`),
          ...files
            .filter((f) => !existsSync(resolve(ROOT, f)) && !existsSync(resolve(ROOT, "docs", f)))
            .map((f) => `${r.keys[0]}: ${f} yok`),
        ];
      });
    expect(bad).toEqual([]);
  });

  it("aday ölçüsü olguyu yakalar, yer tutucuyu ve düz metni geçirir", () => {
    expect(isFactCandidate("1.800 üstü yüksek yoğunlaşma sayılır.")).toBe(true);
    expect(isFactCandidate("Kaynak: TCMB")).toBe(true);
    expect(isFactCandidate("CO₂e gösterilmiyor")).toBe(true);
    expect(isFactCandidate("{count} kayıt, {share} pay")).toBe(false);
    expect(isFactCandidate("{count, plural, =0 {Kayıt yok} other {# kayıt}}")).toBe(false);
    expect(isFactCandidate("{count, plural, other {# levha, 18 mm}}")).toBe(true);
    expect(isFactCandidate("Abone ol")).toBe(false);
    expect(isFactCandidate("Rol değiştir")).toBe(false);
  });
});
