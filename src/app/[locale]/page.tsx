import { ArrowRight, Boxes, ScanSearch, ShieldCheck } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { sectionOf } from "@/components/story/sequence";
import { storySource } from "@/components/story/source";
import { StoryCounter } from "@/components/story/StoryCounter";
import { StoryPlayer } from "@/components/story/StoryPlayer";
import { btnPrimary } from "@/components/ui/classes";
import { Still } from "@/components/ui/Still";
import { Link } from "@/i18n/navigation";

const FINALE_SECTION = 7;

const PILLARS = [
  { key: "market", icon: Boxes, still: "scraps" },
  { key: "continuity", icon: ScanSearch, still: "weighing" },
  { key: "verified", icon: ShieldCheck, still: "press" },
] as const;

export default async function Home({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");
  const ts = await getTranslations("shell");
  const story = await storySource();
  // Sayaç hikâyenin son bölümünde durur; o bölüm henüz render edilmediyse girişin altında gösterilir.
  const finaleInStory =
    !!story &&
    Object.values(story.variants).every((v) => v.indices.some((index) => sectionOf({ index }, story.framesPerSection) === FINALE_SECTION));
  const headline = <h1 className="font-display text-3xl leading-tight sm:text-5xl">{t("headline")}</h1>;

  return (
    <main id="main" className="flex w-full flex-1 flex-col">
      {story && <StoryPlayer source={story} headline={headline} finale={<StoryCounter />} />}
      {/* Hikâye uzay finaliyle (koyu indigo) biter; devamı aynı koyu yüzeyde sürer (T4.8). */}
      <div id="after-story" className="rb-aurora rb-dark">
        <div className="mx-auto grid w-full max-w-5xl gap-14 px-4 py-24 sm:px-6">
          <div className="grid max-w-3xl gap-6">
            {!story && headline}
            <p className="text-xl leading-relaxed text-side-muted sm:text-2xl">{t("lead")}</p>
            {!finaleInStory && <StoryCounter />}
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/giris" className={`${btnPrimary} min-h-12 px-6 text-base`}>
                {t("signIn")}
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </div>
          </div>

          <ul className="grid gap-5 md:grid-cols-3">
            {PILLARS.map(({ key, icon: Icon, still }) => (
              <li key={key} className="group overflow-hidden rounded-2xl border border-side-line bg-side-active">
                <div className="relative isolate h-36 overflow-hidden">
                  <Still name={still} className="absolute inset-0 -z-10 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  <span aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-t from-side to-transparent" />
                </div>
                <div className="grid gap-2 p-5">
                  <span aria-hidden="true" className="grid size-10 place-items-center rounded-xl bg-brand text-on-brand">
                    <Icon className="size-5" />
                  </span>
                  <h2 className="text-lg font-semibold text-side-ink">{ts(`pillars.${key}`)}</h2>
                  <p className="text-sm leading-relaxed text-side-muted">{ts(`pillarsText.${key}`)}</p>
                </div>
              </li>
            ))}
          </ul>

          <p role="note" className="max-w-3xl rounded-xl border border-side-line bg-side-active px-4 py-3 text-sm text-side-muted">
            {t("demoNotice")}
          </p>
          {/* Son bölümün uydu görüntüsü CC BY 4.0: künye görüntünün gösterildiği sayfada durur (RESEARCH.md §4). */}
          {finaleInStory && (
            <p className="max-w-3xl text-xs break-words text-side-muted">
              {t.rich("imageryCredit", {
                eox: (c) => (
                  <a href="https://cloudless.eox.at" className="underline">
                    {c}
                  </a>
                ),
                cc: (c) => (
                  <a href="https://creativecommons.org/licenses/by/4.0/" className="underline">
                    {c}
                  </a>
                ),
              })}
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
