#!/usr/bin/env node
// Claude Code Stop kancası (D-017): çalışma ağacında kod değişmiş ama state.json değişmemişse
// oturumun bitmesini durdurur ve Claude'a belgeleri güncellemesini söyler.
// Döngüyü önlemek için kanca zaten tetiklenmişse (stop_hook_active) geçer.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

let input = {};
try {
  input = JSON.parse(readFileSync(0, "utf8") || "{}");
} catch {
  input = {};
}
if (input.stop_hook_active) process.exit(0);

const CODE_PATHS = ["src/", "story/blender/", "scripts/", "drizzle/", "tests/", "messages/", "next.config.ts", "package.json"];
let status = "";
try {
  status = execFileSync("git", ["status", "--porcelain", "--untracked-files=all"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
} catch {
  process.exit(0); // git yoksa denetleme
}
const changed = status
  .split("\n")
  .filter(Boolean)
  .map((l) => l.slice(3).trim().replace(/^"|"$/g, ""));
const code = changed.filter((f) => CODE_PATHS.some((p) => f === p || f.startsWith(p)));
if (code.length && !changed.includes("state.json")) {
  console.error(
    [
      "Belgeler güncel değil (D-017): kod değişti ama state.json değişmedi.",
      `Değişen kod dosyaları: ${code.slice(0, 8).join(", ")}${code.length > 8 ? " …" : ""}`,
      "Yap: state.json içinde görev durumunu, kanıtı ve updated_at alanını güncelle; karar değiştiyse docs/DECISIONS.md'de eskisini sil ve yenisini yaz; mimari değiştiyse ARCHITECTURE.md'yi güncelle. Sonra `pnpm docs:check` çalıştır.",
    ].join("\n"),
  );
  process.exit(2);
}
process.exit(0);
