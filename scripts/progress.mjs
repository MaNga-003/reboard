// Mesai sonu raporu için ilerleme: state.json görevleri faz faz sayılır.
// Oran görev sayısına göre; görevlerin büyüklüğü eşit değildir, rapor bunu söyler.
import { readFileSync } from "node:fs";

const s = JSON.parse(readFileSync(new URL("../state.json", import.meta.url), "utf8"));
const DEMO_PHASES = ["F0", "F1", "F2", "F3", "F4"]; // F5 yarışmadan sonra
const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0);
const done = (ts) => ts.filter((t) => t.status === "tamam");

for (const p of s.phases) {
  const ts = s.tasks.filter((t) => t.phase === p.id);
  const open = ts.filter((t) => t.status !== "tamam").map((t) => `${t.id} (${t.status}, ${t.mode})`);
  console.log(`${p.id} ${p.title}: ${done(ts).length}/${ts.length}${open.length ? ` · kalan: ${open.join(", ")}` : ""}`);
}
const demo = s.tasks.filter((t) => DEMO_PHASES.includes(t.phase));
console.log(`Demo kapsamı (F0–F4): ${done(demo).length}/${demo.length} görev, %${pct(done(demo).length, demo.length)}`);
console.log(`Bütün plan: ${done(s.tasks).length}/${s.tasks.length} görev, %${pct(done(s.tasks).length, s.tasks.length)}`);
const waiting = s.tasks.filter((t) => t.status !== "tamam" && t.mode !== "otonom");
if (waiting.length) console.log(`Kullanıcı adımı gereken: ${waiting.map((t) => `${t.id} ${t.title}`).join("; ")}`);
if (s.open_questions?.length) console.log(`Açık sorular: ${s.open_questions.map((q) => q.id).join(", ")}`);
