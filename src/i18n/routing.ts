import { defineRouting } from "next-intl/routing";

// D-005: varsayılan Türkçe, ikinci dil İngilizce.
export const routing = defineRouting({
  locales: ["tr", "en"],
  defaultLocale: "tr",
});

export type Locale = (typeof routing.locales)[number];
