#!/usr/bin/env node
// Belge tutarlılığı denetimi (D-017).
//   node scripts/docs-check.mjs           → state.json şeması, çapraz kimlikler, git sırası
//   node scripts/docs-check.mjs --staged  → ek olarak: kod staged ise state.json da staged olmalı (pre-commit)
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import Ajv from "ajv";
import addFormats from "ajv-formats";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const fail = (msg) => errors.push(msg);

// Kod sayılan yollar: bunlar değişirse state.json da güncellenmelidir.
export const CODE_PATHS = ["src/", "story/blender/", "scripts/", "drizzle/", "tests/", "messages/", "next.config.ts", "package.json"];
const isCode = (f) => CODE_PATHS.some((p) => f === p || f.startsWith(p));

function git(args) {
  try {
    return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

// 1) Şema
const state = JSON.parse(readFileSync(path.join(root, "state.json"), "utf8"));
const schema = JSON.parse(readFileSync(path.join(root, "docs/state.schema.json"), "utf8"));
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
if (!ajv.validate(schema, state)) {
  for (const e of ajv.errors) fail(`state.json şema: ${e.instancePath || "/"} ${e.message}`);
}

// 2) Kararlar: yalnız güncel, benzersiz kimlik
const decisionsMd = readFileSync(path.join(root, "docs/DECISIONS.md"), "utf8");
const decisionIds = [...decisionsMd.matchAll(/^### (D-\d{3})\b/gm)].map((m) => m[1]);
const dupDecisions = decisionIds.filter((id, i) => decisionIds.indexOf(id) !== i);
if (dupDecisions.length) fail(`DECISIONS.md içinde tekrar eden kimlik: ${[...new Set(dupDecisions)].join(", ")}`);
const decisionSet = new Set(decisionIds);

// 3) Görevler: benzersiz kimlik, bağımlılıklar, fazlar, kararlar, kanıt
const tasks = state.tasks ?? [];
const taskIds = tasks.map((t) => t.id);
const taskSet = new Set(taskIds);
const phaseSet = new Set((state.phases ?? []).map((p) => p.id));
if (!phaseSet.has(state.current_phase)) fail(`current_phase ${state.current_phase} phases içinde yok`);
taskIds.filter((id, i) => taskIds.indexOf(id) !== i).forEach((id) => fail(`Tekrar eden görev kimliği: ${id}`));
for (const t of tasks) {
  if (!phaseSet.has(t.phase)) fail(`${t.id}: bilinmeyen faz ${t.phase}`);
  for (const d of t.depends_on ?? []) if (!taskSet.has(d)) fail(`${t.id}: bilinmeyen bağımlılık ${d}`);
  for (const d of t.decisions ?? []) if (!decisionSet.has(d)) fail(`${t.id}: ${d} DECISIONS.md içinde yok (silinmiş ya da yazılmamış)`);
  if (t.status === "tamam" && !(t.evidence && t.evidence.trim())) fail(`${t.id}: 'tamam' ama kanıt (evidence) boş`);
  if (t.status === "tamam") {
    const openDeps = (t.depends_on ?? []).filter((d) => tasks.find((x) => x.id === d)?.status !== "tamam");
    if (openDeps.length) fail(`${t.id}: 'tamam' ama bağımlılıkları bitmemiş: ${openDeps.join(", ")}`);
  }
}
for (const q of state.open_questions ?? []) {
  for (const b of q.blocks) if (!taskSet.has(b)) fail(`${q.id}: bilinmeyen görev ${b}`);
}

// 3b) Metrikler: VERIFICATION.md kataloğu ile state.json metrics aynı kimlikleri taşır
const verificationMd = existsSync(path.join(root, "docs/VERIFICATION.md")) ? readFileSync(path.join(root, "docs/VERIFICATION.md"), "utf8") : "";
const docMetricIds = new Set([...verificationMd.matchAll(/^\| (M-\d+) \|/gm)].map((m) => m[1]));
const stateMetricIds = new Set((state.metrics ?? []).map((m) => m.id));
for (const id of docMetricIds) if (!stateMetricIds.has(id)) fail(`${id} VERIFICATION.md içinde var, state.json metrics içinde yok`);
for (const id of stateMetricIds) if (!docMetricIds.has(id)) fail(`${id} state.json metrics içinde var, VERIFICATION.md içinde yok`);

// 4) Git sırası: kodun son commit'inden sonra state.json da commit edilmiş olmalı
if (git(["rev-parse", "--is-inside-work-tree"]) === "true" && git(["rev-parse", "--verify", "HEAD"])) {
  const codeCommit = git(["log", "-1", "--format=%H", "--", ...CODE_PATHS]);
  const stateCommit = git(["log", "-1", "--format=%H", "--", "state.json"]);
  if (codeCommit && !stateCommit) fail("Kod commit edilmiş ama state.json hiç commit edilmemiş");
  if (codeCommit && stateCommit && codeCommit !== stateCommit) {
    const ok = git(["merge-base", "--is-ancestor", codeCommit, stateCommit]) !== null;
    if (!ok) fail(`Son kod commit'i (${codeCommit.slice(0, 7)}) state.json'ın son commit'inden (${stateCommit.slice(0, 7)}) yeni: state.json güncellenmeli`);
  }
}

// 5) --staged: kod staged ise state.json da staged olmalı
if (process.argv.includes("--staged")) {
  const staged = (git(["diff", "--cached", "--name-only"]) ?? "").split("\n").filter(Boolean);
  if (staged.some(isCode) && !staged.includes("state.json")) {
    fail("Commit kod içeriyor ama state.json içermiyor. Görev durumunu, kanıtı ve updated_at alanını güncelleyip ekleyin.");
  }
}

// 6) Belge seti eksiksiz
for (const f of ["CLAUDE.md", "ARCHITECTURE.md", "README.md", "docs/DECISIONS.md", "docs/PRODUCT.md", "docs/DATA_DICTIONARY.md", "docs/DESIGN_SYSTEM.md", "docs/STORY.md", "docs/RESEARCH.md", "docs/VERIFICATION.md", "docs/DEMO.md"]) {
  if (!existsSync(path.join(root, f))) fail(`Eksik belge: ${f}`);
}

if (errors.length) {
  console.error(`docs:check BAŞARISIZ (${errors.length})`);
  for (const e of errors) console.error(`  ✗ ${e}`);
  process.exit(1);
}
console.log(`docs:check tamam · ${tasks.length} görev · ${decisionIds.length} karar · ${(state.open_questions ?? []).length} açık soru`);
