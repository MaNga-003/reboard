import type { ReactNode } from "react";
import { eyebrow as eyebrowClass, h1 as h1Class, lead as leadClass, type StillName } from "./classes";
import { Still } from "./Still";

/** Sayfa başlığı: üst etiket, h1, açıklama ve sağda eylemler. <header> kullanılmaz: testler başlıktaki rol menüsünü tek <header> içinde arar. */
export function PageHeader({ eyebrow, title, lead, actions }: { eyebrow?: string; title: string; lead?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="grid min-w-0 gap-2">
        {eyebrow && <p className={eyebrowClass}>{eyebrow}</p>}
        <h1 className={h1Class}>{title}</h1>
        {lead && <div className={leadClass}>{lead}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </div>
  );
}

/**
 * Görselli başlık: koyu yüzey, sağda hikâyenin render karesi (kenara doğru sönümlenir), solda metin.
 * Metin yalnızca koyu alanın üstünde durur; görsel sağ yarıya sınırlıdır.
 */
export function PageBanner({
  still,
  eyebrow,
  title,
  lead,
  actions,
  children,
}: {
  still: StillName;
  eyebrow?: string;
  title: string;
  lead?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="rb-aurora rb-dark relative isolate overflow-hidden rounded-3xl shadow-pop">
      <Still
        name={still}
        className="absolute inset-y-0 right-0 -z-10 hidden h-full w-3/5 object-cover opacity-80 [mask-image:linear-gradient(to_left,black_35%,transparent)] md:block"
      />
      <div className="grid gap-5 px-6 py-8 sm:px-10 sm:py-10 md:max-w-[60%]">
        {eyebrow && <p className="text-xs font-semibold uppercase tracking-[0.14em] text-side-muted">{eyebrow}</p>}
        <h1 className="text-3xl font-semibold tracking-tight text-side-ink sm:text-4xl">{title}</h1>
        {lead && <div className="max-w-prose text-base leading-relaxed text-side-muted">{lead}</div>}
        {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
      </div>
      {children}
    </section>
  );
}
