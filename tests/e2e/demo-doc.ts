// DEMO.md §2 akış tablosu: her satır bir demo adımı (T4.3). Demo testi, birim testi ve video kaydı aynı ayrıştırıcıyı kullanır;
// belgede adım ya da süre değişince üçü birlikte değişir.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export type DemoStep = { n: number; start: number; end: number; screen: string; persona: string | null };

export const DEMO_MD = resolve("docs/DEMO.md");

const seconds = (mmss: string) => {
  const [m, s] = mmss.split(":").map(Number);
  return m * 60 + s;
};

/** §4'teki "Hikâye takılıyor" satırı: "Hikâyeyi geç" bağlantısı sayfa açılınca kaçıncı Tab'da belirir. */
export function skipTabs(md = readFileSync(DEMO_MD, "utf8")): number {
  const m = /^\| Hikâye takılıyor \|[^|\n]*?(\d+)\. Tab/m.exec(md);
  if (!m) throw new Error("DEMO.md §4: 'Hikâye takılıyor' satırında Tab sayısı yok");
  return Number(m[1]);
}

/** Satır biçimi: `| 1 | 0:00–0:40 | \`/\` (rol) | ...`. Tablo dışındaki satırlar sayılmaz. */
export function demoSteps(md = readFileSync(DEMO_MD, "utf8")): DemoStep[] {
  const section = md.split(/^## /m).find((s) => s.startsWith("2. Akış"));
  if (!section) throw new Error("DEMO.md: '## 2. Akış' bölümü yok");
  return [...section.matchAll(/^\| (\d+) \| (\d+:\d{2})–(\d+:\d{2}) \| `([^`]+)`(?: \(([^)]+)\))? \|/gm)].map((m) => ({
    n: Number(m[1]),
    start: seconds(m[2]),
    end: seconds(m[3]),
    screen: m[4],
    persona: m[5] ?? null,
  }));
}
