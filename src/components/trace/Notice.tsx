import { useTranslations } from "next-intl";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** ?durum= ve ?hata= sorgu parametrelerinden gelen sonuç; yalnızca bilinen anahtarlar gösterilir (sorgudan metin enjekte edilmez). */
export function Notice({ query }: { query: Record<string, string | string[] | undefined> }) {
  const t = useTranslations("trace");
  const notice = one(query.durum);
  const error = one(query.hata);
  return (
    <>
      {notice && t.has(`notices.${notice}`) && (
        <p role="status" className="rounded border-2 border-accent px-3 py-2 font-semibold">
          {t(`notices.${notice}`)}
        </p>
      )}
      {error && t.has(`errors.${error}`) && (
        <p role="alert" className="rounded border-2 border-fg px-3 py-2">
          {t(`errors.${error}`)}
        </p>
      )}
    </>
  );
}
