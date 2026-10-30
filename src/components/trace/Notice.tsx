import { useTranslations } from "next-intl";
import { alertBox } from "@/components/ui/classes";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** ?durum= ve ?hata= sorgu parametrelerinden gelen sonuç; yalnızca bilinen anahtarlar gösterilir (sorgudan metin enjekte edilmez). */
export function Notice({ query }: { query: Record<string, string | string[] | undefined> }) {
  const t = useTranslations("trace");
  const notice = one(query.durum);
  const error = one(query.hata);
  return (
    <>
      {notice && t.has(`notices.${notice}`) && (
        <p role="status" className="rounded-xl border-2 border-brand bg-brand-soft px-4 py-3 font-semibold text-ink">
          {t(`notices.${notice}`)}
        </p>
      )}
      {error && t.has(`errors.${error}`) && (
        <p role="alert" className={alertBox}>
          {t(`errors.${error}`)}
        </p>
      )}
    </>
  );
}
