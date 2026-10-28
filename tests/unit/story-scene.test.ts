// Hikâye sahnesi denetimi (STORY.md §5, VERIFICATION M-30). Ölçümü Blender yapar (pnpm story:check →
// story/checks.json); CI'da Blender yok, bu test ölçümün güncel olduğunu ve eşikleri denetler. Her ölçüm,
// bilerek bozulmuş bir kontrolle birlikte gelir: kontrol eşiği aşmıyorsa ölçü sorunu göremiyor demektir.
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CHECKS_FILE, sceneHash } from "../../scripts/story-check.mjs";

type Shadow = { mean: number; max: number };
type Intrusion = {
  view: Record<string, { rays: number; hits: number }>;
  shadow: Record<string, { points: number; lights: Record<string, Shadow> }>;
  control: { view_hits: number; key_shadow: Shadow };
};
type Checks = {
  scene: string;
  intrusion: Record<"d" | "m", Intrusion>;
  heap: { pieces: number; steep: number; groove: number; crest_mm: number; cover: number; control_groove: number };
};

// Işık yüzeyi 5×5 örnekle taranır; tek örneğin kesilmesi 0,04 eder. Eşik bunun altında: hiçbir görünen nokta
// hiçbir ışığın tek örneğinde bile 3. bölüm eşyasının gölgesinde kalmaz. Kötü örnek: top eski yerinde anahtar
// ışığın ortalama %9'unu (masaüstü) ve %26'sını (mobil) kesiyordu.
const SHADOW_MAX = 0.02;
// Yığın: iyi sette (onaylanan son yığın) dik 0,0096, oluk 0,124, tepe 70 mm, örtü 0,889. Kötü örnekler: kısa
// dalgası sınırsız büyüyen yığında oluk 0,214 (folyo gibi paralel sırtlar); ilk yığında dik 0,230 ve tepe 141 mm.
const HEAP = { steep: 0.02, groove: 0.15, crest_mm: 90, cover: 0.85 };

const checks: Checks | null = existsSync(CHECKS_FILE) ? JSON.parse(readFileSync(CHECKS_FILE, "utf8")) : null;

describe("hikâye sahnesi denetimi (story/checks.json)", () => {
  it("ölçüm var ve sahne kodunun bugünkü hâline ait", () => {
    expect(checks, "story/checks.json yok: pnpm story:check").not.toBeNull();
    expect(checks!.scene, "story/blender değişmiş, ölçüm eski: pnpm story:check").toBe(sceneHash());
  });

  for (const aspect of ["d", "m"] as const) {
    describe(`en-boy ${aspect}`, () => {
      const r = () => checks!.intrusion[aspect];
      it.each(["s1", "s2"])("%s: 3. bölüm eşyaları hiçbir karede görünmez", (s) => {
        // 30 kare × 48 ışınlı ızgara; ölçüm boşa düşmesin diye ışın sayısı da denetlenir.
        expect(r().view[s].rays).toBeGreaterThanOrEqual(30 * 1000);
        expect(r().view[s].hits, `${aspect} ${s}: eşyaya çarpan kamera ışını`).toBe(0);
      });
      it.each(["s1", "s2"])("%s: 3. bölüm eşyaları görünen yüzeye gölge düşürmez", (s) => {
        const sh = r().shadow[s];
        expect(sh.points).toBeGreaterThanOrEqual(500);
        expect(Object.keys(sh.lights).sort()).toEqual(["Fill", "Key", "Rim"]);
        for (const [light, v] of Object.entries(sh.lights))
          expect(v.max, `${aspect} ${s} ${light}: en kötü noktada kesilen pay (ort. ${v.mean})`).toBeLessThanOrEqual(SHADOW_MAX);
      });
      it("kontrol: top kesim alanına konunca görünür, eski yerindeyken anahtar ışığı keser", () => {
        expect(r().control.view_hits).toBeGreaterThan(0);
        expect(r().control.key_shadow.mean).toBeGreaterThan(SHADOW_MAX);
      });
    });
  }

  it("çuvaldaki yığın folyo gibi parlamaz, taşmaz ve ağzı örter", () => {
    const h = checks!.heap;
    expect(h.pieces).toBeGreaterThan(40);
    expect(h.steep, "60°'den dik kırpıntı yüzü payı").toBeLessThanOrEqual(HEAP.steep);
    expect(h.groove, "tümseğe göre 30°'den eğik yüz payı (oluk)").toBeLessThanOrEqual(HEAP.groove);
    expect(h.crest_mm, "dudak üstü tepe (mm)").toBeLessThanOrEqual(HEAP.crest_mm);
    expect(h.cover, "ağzın örtülü payı").toBeGreaterThanOrEqual(HEAP.cover);
  });

  it("kontrol: kısa dalga sınırı kalkınca oluk ölçüsü eşiği aşar", () => {
    expect(checks!.heap.control_groove).toBeGreaterThan(HEAP.groove);
  });
});
