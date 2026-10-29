import "server-only";
import { getMessages } from "next-intl/server";
import { CLIENT_NAMESPACES, type ClientScope } from "./client-scopes";

// Sağlayıcıya ileti verilmezse bütün katalog her sayfanın HTML'ine gömülür (ana sayfada RSC yükünün %79'u, R-7).
// İç içe sağlayıcı dıştakiyle birleşmez, yerine geçer: her kapsam kendi listesinin tamamını taşır.
export async function clientMessages(scope: ClientScope) {
  const all = await getMessages();
  return Object.fromEntries(CLIENT_NAMESPACES[scope].map((ns) => [ns, all[ns]]));
}
