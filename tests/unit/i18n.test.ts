// M-14: TR ve EN çevirileri aynı anahtarları taşır, boş metin yok.
import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import tr from "../../messages/tr.json";

function flatten(obj: unknown, prefix = ""): Record<string, unknown> {
  if (obj === null || typeof obj !== "object") return { [prefix]: obj };
  return Object.entries(obj).reduce<Record<string, unknown>>(
    (acc, [k, v]) => ({ ...acc, ...flatten(v, prefix ? `${prefix}.${k}` : k) }),
    {},
  );
}

describe("çeviri anahtarları", () => {
  const trKeys = flatten(tr);
  const enKeys = flatten(en);

  it("EN'de eksik anahtar yok", () => expect(Object.keys(trKeys).filter((k) => !(k in enKeys))).toEqual([]));
  it("TR'de eksik anahtar yok", () => expect(Object.keys(enKeys).filter((k) => !(k in trKeys))).toEqual([]));
  it("boş ya da metin olmayan değer yok", () => {
    const bad = [...Object.entries(trKeys), ...Object.entries(enKeys)].filter(([, v]) => typeof v !== "string" || !v.trim());
    expect(bad).toEqual([]);
  });
});
