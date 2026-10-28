// Hikâye sahnesi denetimi (STORY.md §5, VERIFICATION M-30). Ölçümü Blender yapar (pnpm story:check →
// story/checks.json); CI'da Blender yok, bu test ölçümün güncel olduğunu ve eşikleri denetler. Her ölçüm,
// bilerek bozulmuş bir kontrolle birlikte gelir: kontrol eşiği aşmıyorsa ölçü sorunu göremiyor demektir.
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CHECKS_FILE, sceneHash } from "../../scripts/story-check.mjs";

type Share = { mean: number; max: number };
type Intrusion = {
  view: Record<string, { rays: number; hits: number }>;
  shadow: Record<string, { points: number; lights: Record<string, Share> }>;
  reach: Record<string, { points: number; lights: Record<string, Share> }>;
  control: { view_hits: number; key_shadow: Share; pool_reach: number; pool_reach_s4: number };
};
type Checks = {
  scene: string;
  intrusion: Record<"d" | "m", Intrusion>;
  heap: { pieces: number; steep: number; groove: number; crest_mm: number; cover: number; control_groove: number };
  belt: { pieces: number; denim_share: number; silk: number };
};

const SECTIONS = ["s1", "s2", "s3", "s4"];
// Sonraki bölümlerin ışıkları (4.: PoolMachine, PoolRim, PoolSort; 5.: PoolBoard, PoolForm, PoolPress,
// PoolPressRim); bölüm ekledikçe bu liste büyür.
const S5_LIGHTS = ["PoolBoard", "PoolForm", "PoolPress", "PoolPressRim"];
const S4_ON = [...S5_LIGHTS, "PoolMachine", "PoolRim", "PoolSort"].sort();
const LATER_LIGHTS: Record<string, string[]> = { s1: S4_ON, s2: S4_ON, s3: S4_ON, s4: S5_LIGHTS };
// Işık yüzeyi 5×5 örnekle taranır; tek örneğin kesilmesi 0,04 eder. Eşik bunun altında: hiçbir görünen nokta
// hiçbir ışığın tek örneğinde bile sonraki bölüm eşyasının gölgesinde kalmaz ve sonraki bölüm ışığının tek
// örneğini bile görmez. Kötü örnekler: top eski yerinde anahtar ışığın ortalama %9'unu (masaüstü) ve %26'sını
// (mobil) kesiyordu; havuz ışıkları eğilmeden her yöne yayılınca 3. bölüme ulaşır (kontrol).
const SHADOW_MAX = 0.02;
const REACH_MAX = 0.02;
// Bant: önceki yükte parçaların sayıca 13/32'si (0,41) denimdi ve yük alaca bir mozaik gibi okunuyordu.
const BELT_DENIM_MIN = 0.5;
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
      it.each(SECTIONS)("%s: sonraki bölüm eşyaları hiçbir karede görünmez", (s) => {
        // 30 kare × 48 ışınlı ızgara; ölçüm boşa düşmesin diye ışın sayısı da denetlenir.
        expect(r().view[s].rays).toBeGreaterThanOrEqual(30 * 1000);
        expect(r().view[s].hits, `${aspect} ${s}: eşyaya çarpan kamera ışını`).toBe(0);
      });
      it.each(SECTIONS)("%s: sonraki bölüm eşyaları görünen yüzeye gölge düşürmez", (s) => {
        const sh = r().shadow[s];
        expect(sh.points).toBeGreaterThanOrEqual(500);
        expect(Object.keys(sh.lights).sort()).toEqual(["Fill", "Key", "Rim"]);
        for (const [light, v] of Object.entries(sh.lights))
          expect(v.max, `${aspect} ${s} ${light}: en kötü noktada kesilen pay (ort. ${v.mean})`).toBeLessThanOrEqual(SHADOW_MAX);
      });
      it.each(SECTIONS)("%s: sonraki bölüm ışıkları görünen yüzeye ulaşmaz", (s) => {
        const re = r().reach[s];
        expect(re.points).toBeGreaterThanOrEqual(500);
        expect(Object.keys(re.lights).sort()).toEqual(LATER_LIGHTS[s]);
        for (const [light, v] of Object.entries(re.lights))
          expect(v.max, `${aspect} ${s} ${light}: en kötü noktada ulaşan pay (ort. ${v.mean})`).toBeLessThanOrEqual(REACH_MAX);
      });
      it("kontrol: top kesim alanına konunca görünür, eski yerindeyken anahtar ışığı keser", () => {
        expect(r().control.view_hits).toBeGreaterThan(0);
        expect(r().control.key_shadow.mean).toBeGreaterThan(SHADOW_MAX);
      });
      it("kontrol: sonraki bölümlerin havuz ışıkları her yöne yayılınca 3. ve 4. bölüme ulaşır", () => {
        expect(r().control.pool_reach).toBeGreaterThan(REACH_MAX);
        expect(r().control.pool_reach_s4).toBeGreaterThan(REACH_MAX);
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

  it("banttaki yük çoğu denim bir kumaş yığınıdır, ayıklanacak ipek iki parça", () => {
    const b = checks!.belt;
    expect(b.pieces).toBeGreaterThanOrEqual(30);
    expect(b.denim_share, "kumaş üst yüzünde denimin alan payı").toBeGreaterThanOrEqual(BELT_DENIM_MIN);
    expect(b.silk).toBe(2);
  });
});
