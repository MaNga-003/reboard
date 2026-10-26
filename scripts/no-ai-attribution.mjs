#!/usr/bin/env node
// D-020: Claude commit ve PR'larda ortak yazar ya da katkıcı olarak görünmez.
//   node scripts/no-ai-attribution.mjs <mesaj-dosyası>  → tek mesaj (commit-msg kancası)
//   node scripts/no-ai-attribution.mjs --history        → HEAD'den ulaşılan bütün commit'ler: mesaj, yazar, işleyen
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Yalnızca atıf satırlarını yakalar; "CLAUDE.md'yi güncelle" gibi sıradan anmalar geçer.
export const ATTRIBUTION_PATTERNS = [
  /^\s*co-authored-by:.*(claude|anthropic)/im,
  /^\s*claude-session:/im,
  /generated (with|by) \[?claude/i,
  /noreply@anthropic\.com/i,
  /claude\.ai\/code\/session_/i,
];

/** Mesajda atıf içeren satırları döndürür; temizse boş dizi. */
export function findAttribution(message) {
  return message.split(/\r?\n/).filter((line) => ATTRIBUTION_PATTERNS.some((p) => p.test(line)));
}

/** Yazar ya da işleyen bir yapay zekâ kimliğiyse true. */
export function isAiIdentity(name, email) {
  return /@anthropic\.com$/i.test(email) || /^claude\b/i.test(name.trim());
}

function main(argv) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const problems = [];
  if (argv.includes("--history")) {
    const SEP = "\u001e";
    const log = execFileSync("git", ["log", `--format=%H%x1f%an%x1f%ae%x1f%cn%x1f%ce%x1f%B${SEP}`], { cwd: root, encoding: "utf8" });
    let count = 0;
    for (const rec of log.split(SEP).map((r) => r.trim()).filter(Boolean)) {
      count++;
      const [sha, an, ae, cn, ce, body] = rec.split("\u001f");
      const id = sha.slice(0, 7);
      if (isAiIdentity(an, ae)) problems.push(`${id}: yazar ${an} <${ae}>`);
      if (isAiIdentity(cn, ce)) problems.push(`${id}: işleyen ${cn} <${ce}>`);
      for (const line of findAttribution(body ?? "")) problems.push(`${id}: ${line.trim()}`);
    }
    if (!problems.length) console.log(`atıf denetimi tamam · ${count} commit · 0 bulgu`);
  } else {
    const file = argv.find((a) => !a.startsWith("--"));
    if (!file) {
      console.error("Kullanım: no-ai-attribution.mjs <mesaj-dosyası> | --history");
      process.exit(2);
    }
    // Kancada git'in yorum satırları (#) da gelir; onlar commit'e girmez.
    const msg = readFileSync(file, "utf8").split(/\r?\n/).filter((l) => !l.startsWith("#")).join("\n");
    for (const line of findAttribution(msg)) problems.push(line.trim());
  }
  if (problems.length) {
    console.error(`Atıf denetimi BAŞARISIZ (${problems.length}) · D-020: Claude ortak yazar ya da katkıcı olarak görünmez`);
    for (const p of problems) console.error(`  ✗ ${p}`);
    process.exit(1);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
