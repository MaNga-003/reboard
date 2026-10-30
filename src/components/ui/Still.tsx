import { STILL, type StillName } from "./classes";

/**
 * Hikâyenin render karesi. Düz <img> bilinçli: kareler zaten sıkıştırılmış WebP ve sabit boyutlu; next/image üretimde
 * sharp ister ve çevrimdışı demoda ek bir bağımlılık olur. Süs görseldir (alt boş); anlam her zaman yazıdadır.
 */
export function Still({ name, className, eager = false }: { name: StillName; className?: string; eager?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={STILL[name]}
      alt=""
      width={1920}
      height={1080}
      loading={eager ? undefined : "lazy"}
      fetchPriority={eager ? "high" : undefined}
      decoding="async"
      className={className}
    />
  );
}
