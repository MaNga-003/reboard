// İstemci bileşenlerine giden çeviri ad alanları, rota kapsamı başına (R-7). Kapsamı, `clientMessages("<ad>")` çağıran
// layout belirler; altındaki her sayfa onu kullanır. Listeler kaynak grafiğinden doğrulanır: tests/unit/client-messages.test.ts.
export const CLIENT_NAMESPACES = {
  root: ["common", "resultClass", "story"],
  giris: ["auth"],
  pasaport: ["passport"],
  app: ["common", "fibres", "market", "resultClass", "scenario", "trace", "units"],
} as const;

export type ClientScope = keyof typeof CLIENT_NAMESPACES;
