import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { addCompileHints } from "./src/lib/compile-hints";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// R-6: nonce'suz CSP (Next CSP rehberi): nonce bütün sayfaları dinamik çizime zorlardı. Next'in satır içi önyükleme betikleri için
// script-src 'unsafe-inline' gerekir; yine de dış betik, object, base, form hedefi, çerçeveleme ve dışarı bağlantı kapalıdır.
// Tek dış kaynak harita altlığı (stil, karo, yazı tipi, sprite). Geliştirmede React hata yığınları için eval gerekir.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  "connect-src 'self' https://tiles.openfreemap.org",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

// D-008: Cache Components kapalı; demo takvimi için klasik dinamik/statik ayrımı yeterli.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  cacheComponents: false,
  compiler: {
    // R-7: çatı parçalarına V8 derleme ipucu. Kanca Vercel'de de çalışır (yayın next.config.ts'i yükler, scripts/'i yüklemez).
    runAfterProductionCompile: async ({ distDir }) => {
      addCompileHints(distDir);
    },
  },
  experimental: {
    // Kanıt yükleme (D-018): dosya en çok 4 MiB; çok parçalı form payıyla Vercel'in 4,5 MB gövde sınırına eşit.
    serverActions: { bodySizeLimit: "4.5mb" },
  },
  // PGlite WASM dosyalarını kendisi yükler; paketlenmemeli.
  serverExternalPackages: ["@electric-sql/pglite"],
  async headers() {
    // Yapılandırma başlığı rota başlığını ezer: kanıt ucu kendi daha sıkı CSP'sini (sandbox) taşır, genel CSP ona yazılmaz.
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/:path((?!api/evidence/).*)", headers: [{ key: "Content-Security-Policy", value: csp }] },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default withNextIntl(nextConfig);
