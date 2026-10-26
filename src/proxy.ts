import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // API, Next iç yolları ve uzantılı dosyalar (kareler, favicon) dil yönlendirmesinden geçmez.
  matcher: "/((?!api|_next|_vercel|.*\..*).*)",
};
