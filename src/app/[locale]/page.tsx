import { getTranslations, setRequestLocale } from "next-intl/server";
import { sectionOf } from "@/components/story/sequence";
import { storySource } from "@/components/story/source";
import { StoryCounter } from "@/components/story/StoryCounter";
import { StoryPlayer } from "@/components/story/StoryPlayer";
import { Link } from "@/i18n/navigation";

const FINALE_SECTION = 7;

export default async function Home({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");
  const story = await storySource();
  // Sayaç hikâyenin son bölümünde durur; o bölüm henüz render edilmediyse girişin altında gösterilir.
  const finaleInStory =
    !!story &&
    Object.values(story.variants).every((v) => v.indices.some((index) => sectionOf({ index }, story.framesPerSection) === FINALE_SECTION));
  const headline = <h1 className="font-display text-3xl leading-tight sm:text-5xl">{t("headline")}</h1>;

  return (
    <main id="main" className="flex w-full flex-1 flex-col">
      {story && <StoryPlayer source={story} headline={headline} finale={<StoryCounter />} />}
      <div id="after-story" className="mx-auto flex w-full max-w-3xl flex-col justify-center gap-6 px-4 py-24">
        {!story && headline}
        <p className="text-lg">{t("lead")}</p>
        {!finaleInStory && <StoryCounter />}
        <p role="note" className="rounded border border-fg/30 px-3 py-2 text-sm">
          {t("demoNotice")}
        </p>
        {/* Son bölümün uydu görüntüsü CC BY 4.0: künye görüntünün gösterildiği sayfada durur (RESEARCH.md §4). */}
        {finaleInStory && (
          <p className="text-xs break-words">
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
        <Link href="/giris" className="inline-flex min-h-11 items-center self-start rounded bg-accent px-5 font-semibold text-on-accent">
          {t("signIn")}
        </Link>
      </div>
    </main>
  );
}
