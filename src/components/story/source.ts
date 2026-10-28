// Hikâye karelerinin listesi: story-encode'un yazdığı manifest derlemede okunur, oynatıcıya yalnızca kare numaraları gider.
// Manifest yoksa (kareler henüz kodlanmadı) hikâye çizilmez ve ana sayfa düz girişle açılır.
import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Aspect, Manifest } from "./sequence";

export type StoryVariant = { width: number; height: number; indices: number[]; stills: number[] };
export type StorySource = { framesPerSection: number; sections: number; variants: Partial<Record<Aspect, StoryVariant>> };

export async function storySource(dir = join(process.cwd(), "public", "story")): Promise<StorySource | null> {
  let manifest: Manifest;
  try {
    manifest = JSON.parse(await readFile(join(dir, "manifest.json"), "utf8"));
  } catch {
    return null;
  }
  const variants: StorySource["variants"] = {};
  for (const [aspect, v] of Object.entries(manifest.variants) as [Aspect, NonNullable<Manifest["variants"][Aspect]>][]) {
    if (v.frames.length) variants[aspect] = { width: v.width, height: v.height, indices: v.frames.map((f) => f.index), stills: v.stills };
  }
  return Object.keys(variants).length ? { framesPerSection: manifest.framesPerSection, sections: manifest.sections, variants } : null;
}
