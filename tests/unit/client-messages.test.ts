// M-37 (R-7): istemciye giden çeviri ad alanları her rota kapsamında kaynak grafiğinden çıkan kümeye eşittir.
// Eksik ad alanı istemcide MISSING_MESSAGE ve ekranda ham anahtar demektir; fazlası her sayfanın HTML'ine boşuna gömülür.
// Grafik: kapsamdaki sayfa ve layout'lardan içe aktarmalar izlenir; "use client" dosyasından sonra erişilen her dosya istemcidir.
// Sunucuda kalan bileşenin useTranslations'ı bütün katalogu istek yapılandırmasından okur, bu yüzden sayılmaz.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CLIENT_NAMESPACES, type ClientScope } from "@/i18n/client-scopes";
import tr from "../../messages/tr.json";

const SRC = resolve("src");
const APP = join(SRC, "app", "[locale]");
const CATALOG = new Set(Object.keys(tr));
const read = (p: string) => readFileSync(p, "utf8");
const rel = (p: string) => relative(SRC, p).replaceAll("\\", "/");
const walk = (d: string): string[] =>
  readdirSync(d).flatMap((f) => {
    const p = join(d, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

function resolveImport(from: string, spec: string): string | null {
  const base = spec.startsWith("@/") ? join(SRC, spec.slice(2)) : spec.startsWith(".") ? resolve(dirname(from), spec) : null;
  if (!base) return null;
  for (const ext of ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]) {
    const p = base + ext;
    if (existsSync(p) && statSync(p).isFile()) return p;
  }
  return null;
}

// Tür içe aktarması çalışma zamanına girmez; dinamik içe aktarma (next/dynamic) girer.
const IMPORT = /^\s*(?:import|export)\s+(?!type\b)(?:[^"';]*?\s+from\s+)?["']([^"']+)["']|\bimport\(\s*["']([^"']+)["']\s*\)/gm;
const importsOf = (p: string) =>
  [...read(p).matchAll(IMPORT)].map((m) => resolveImport(p, m[1] ?? m[2])).filter((q): q is string => q !== null);
const isClient = (p: string) => /^(['"])use client\1/.test(read(p).replace(/^(?:\s|\/\/[^\n]*|\/\*[\s\S]*?\*\/)*/, ""));

function clientFiles(entries: string[]): string[] {
  const client = new Map<string, boolean>();
  const stack: [string, boolean][] = entries.map((p) => [p, false]);
  while (stack.length) {
    const [p, parent] = stack.pop()!;
    const c = parent || isClient(p);
    // Aynı dosya hem sunucudan hem istemciden aktarılabilir; istemci yolu bir kez gezilir.
    if (client.get(p) === true || (client.has(p) && !c)) continue;
    client.set(p, c);
    for (const q of importsOf(p)) stack.push([q, c]);
  }
  return [...client].filter(([, c]) => c).map(([p]) => p);
}

/** Dosyanın istemcide çözdüğü ad alanları ve anahtarı derleme anında bilinemeyen çağrılar. */
function scanTranslations(code: string) {
  const namespaces = new Set<string>();
  for (const m of code.matchAll(/useTranslations\(\s*["'`]([^"'`]+)["'`]\s*\)/g)) namespaces.add(m[1].split(".")[0]);
  const roots = [...code.matchAll(/\b(?:const|let)\s+(\w+)\s*=\s*useTranslations\(\s*\)/g)].map((m) => m[1]);
  // Kök çevirmen anahtarı tam yoluyla alır: yol dosyada yazılı durmalı (üçlü ifadenin dalları ve şablonun sabit başı da sayılır).
  if (roots.length) for (const m of code.matchAll(/["'`]([A-Za-z]\w*)\.[A-Za-z$]/g)) if (CATALOG.has(m[1])) namespaces.add(m[1]);
  const unknowable = roots.flatMap((n) =>
    [...code.matchAll(new RegExp(`\\b${n}(?:\\.\\w+)?\\(\\s*(?:\`\\$\\{|[A-Za-z_$][\\w$.]*\\s*[,)])`, "g"))].map((m) => m[0]),
  );
  if (/\buseMessages\(/.test(code)) unknowable.push("useMessages(");
  return { namespaces, unknowable };
}

const routeFiles = walk(APP).filter((p) => /[\\/](page|layout)\.tsx$/.test(p));
const scopeDirs = new Map<string, string>();
for (const p of routeFiles.filter((f) => f.endsWith("layout.tsx"))) {
  const m = read(p).match(/clientMessages\(\s*["'](\w+)["']\s*\)/);
  if (m) scopeDirs.set(dirname(p), m[1]);
}
/** En yakın kapsam layout'u; layout'un kendi çıktısı da sağlayıcının içindedir. */
function scopeOf(file: string): string | null {
  for (let d = dirname(file); d.startsWith(APP); d = dirname(d)) {
    const s = scopeDirs.get(d);
    if (s) return s;
  }
  return null;
}
const entries = new Map<string, string[]>();
for (const f of routeFiles) {
  const s = scopeOf(f) ?? "(kapsamsız)";
  entries.set(s, [...(entries.get(s) ?? []), f]);
}

describe("istemci çeviri kapsamları (R-7)", () => {
  it("her sayfa ve layout bir kapsamın altında; kapsam adları listeyle aynı ve her kapsamda sayfa var", () => {
    expect(entries.get("(kapsamsız)")?.map(rel) ?? []).toEqual([]);
    expect([...entries.keys()].sort()).toEqual(Object.keys(CLIENT_NAMESPACES).sort());
    for (const [s, files] of entries) expect(files.some((f) => f.endsWith("page.tsx")), s).toBe(true);
  });

  it("listedeki her ad alanı katalogda var", () => {
    expect(Object.values(CLIENT_NAMESPACES).flat().filter((ns) => !CATALOG.has(ns))).toEqual([]);
  });

  it("sağlayıcı yalnızca layout'ta ve her zaman kapsamlı iletiyle kurulur (bütün katalog gömülmez)", () => {
    const bad = walk(SRC)
      .filter((p) => /\.tsx?$/.test(p) && !p.endsWith("client-messages.ts"))
      .flatMap((p) => {
        const code = read(p);
        const out: string[] = [];
        if (/<NextIntlClientProvider(?![^>]*messages=\{await clientMessages\()/.test(code)) out.push(`${rel(p)}: kapsamsız sağlayıcı`);
        if (/\bclientMessages\(\s*["']\w+["']\s*\)/.test(code) && !p.endsWith("layout.tsx")) out.push(`${rel(p)}: kapsam layout dışında seçilmiş`);
        return out;
      });
    expect(bad).toEqual([]);
  });

  it.each(Object.keys(CLIENT_NAMESPACES) as ClientScope[])("%s: istemci ad alanları kaynak grafiğiyle aynı", (scope) => {
    const used = new Map<string, Set<string>>();
    const unknowable: string[] = [];
    for (const f of clientFiles(entries.get(scope) ?? [])) {
      const r = scanTranslations(read(f));
      for (const ns of r.namespaces) used.set(ns, (used.get(ns) ?? new Set()).add(rel(f)));
      unknowable.push(...r.unknowable.map((u) => `${rel(f)}: ${u}`));
    }
    expect(unknowable, 'anahtarı derleme anında bilinmiyor: ad alanlı useTranslations("ns") kullanın').toEqual([]);
    const declared = new Set<string>(CLIENT_NAMESPACES[scope]);
    const missing = [...used].filter(([ns]) => !declared.has(ns)).map(([ns, files]) => `${ns} ← ${[...files].join(", ")}`);
    const extra = [...declared].filter((ns) => !used.has(ns));
    expect({ eksik: missing, fazla: extra }, `src/i18n/client-scopes.ts → ${scope}`).toEqual({ eksik: [], fazla: [] });
  });
});

describe("tarayıcının kendisi", () => {
  it("ad alanlı çevirmen: yolun başı", () => {
    expect([...scanTranslations('const t = useTranslations("market.map");').namespaces]).toEqual(["market"]);
  });

  it("kök çevirmen: yazılı yolların katalogdaki başları; katalog dışı dizgi sayılmaz", () => {
    const code = 'const t = useTranslations(); t(a ? "panel.kg" : "scenario.loss"); const css = "style.css"; t(`trace.status.${s}`); f("1.5");';
    expect([...scanTranslations(code).namespaces].sort()).toEqual(["panel", "scenario", "trace"]);
  });

  it("anahtarı bilinmeyen çağrı yakalanır; üçlü ifade ve sabit başlı şablon geçer", () => {
    const code = 'const t = useTranslations(); t(`${p}.label`); t(key); t.rich(item.k, {}); t(a ? "panel.a" : "panel.b"); t(`trace.${x}`);';
    expect(scanTranslations(code).unknowable).toHaveLength(3);
    expect(scanTranslations('const t = useTranslations("trace"); t(key);').unknowable).toEqual([]);
  });

  it("istemci sınırı: sayfa sunucuda kalır, oynatıcı ve istemciden aktardığı ortak bileşen istemcidir", () => {
    const files = clientFiles(entries.get("root") ?? []).map(rel);
    expect(files).toContain("components/story/StoryPlayer.tsx");
    expect(files).toContain("components/ResultClassBadge.tsx");
    expect(files).not.toContain("app/[locale]/page.tsx");
  });
});
