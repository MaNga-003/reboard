import { getTranslations, setRequestLocale } from "next-intl/server";
import { ShieldCheck, Truck } from "lucide-react";
import type { ReactNode } from "react";
import { ResultClassBadge } from "@/components/ResultClassBadge";
import { MonthlyChart, ProjectionChart, type MonthDatum, type ProjectionDatum } from "@/components/panel/Charts";
import { KgTotalText, Kpi } from "@/components/panel/Kpi";
import { StatusChip } from "@/components/panel/Status";
import { Qty } from "@/components/trace/Qty";
import { TableWrap, td, th, tr } from "@/components/trace/Table";
import { lead as leadClass, note as noteClass, page } from "@/components/ui/classes";
import { PageBanner } from "@/components/ui/PageHeader";
import { getDb } from "@/db/client";
import { panelData } from "@/db/repo/panel";
import { permissionList } from "@/domain/access";
import type { KgTotal } from "@/domain/impact";
import type { ResultClass } from "@/domain/result";
import type { SupplyAlert } from "@/domain/supply";
import { fmtDate, fmtMonth, fmtNumber, fmtPercent, fmtShortDate, fmtSignedPercent } from "@/lib/format";
import { requireViewer } from "@/lib/viewer";

const X_TICKS = [0, 7, 14, 21, 28];

/** Grafik ya da tablo başlığı ve sınıfı: tablodaki her sayı bu sınıfı taşır (D-011). */
function Caption({ id, title, resultClass, children }: { id: string; title: string; resultClass: ResultClass; children?: ReactNode }) {
  return (
    <div className="grid gap-1">
      <h3 id={id} className="flex flex-wrap items-center gap-2 text-lg font-semibold tracking-tight text-ink">
        {title}
        <ResultClassBadge value={resultClass} />
      </h3>
      {children && <p className="max-w-prose text-sm text-muted">{children}</p>}
    </div>
  );
}

// <details> ızgara konteyneridir: min-w-0 ve minmax(0,1fr) sütun, içindeki geniş tablonun (kendi kabında kayar) onu
// genişletip sayfayı ya da kendi kutusunu taşırmasını önler.
const details = "group grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3";
const summary = "inline-flex min-h-11 cursor-pointer items-center font-semibold text-brand underline-offset-4 hover:underline";
const sectionTitle = "text-2xl font-semibold tracking-tight text-ink";

// Etki ve tedarik paneli (T2.3). Sayılar src/domain'den; burada yalnızca biçim ve yerleşim var.
export default async function PanelPage({ params }: PageProps<"/[locale]/panel">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const viewer = await requireViewer(locale);
  const t = await getTranslations();
  const perms = permissionList(viewer.roles.join(","));
  const now = new Date();
  const { impact, supply, names } = await panelData(getDb(), viewer.orgId, now);
  const orgName = (id: string) => names.get(id) ?? t("market.hiddenOrg");
  const unknown = t("common.unknown");
  const num = (v: { toString(): string }, digits = 1) => fmtNumber(v.toString(), locale, digits);
  const kgText = (total: KgTotal) => {
    if (total.kg === null) return unknown;
    const text = t("panel.kg", { kg: num(total.kg) });
    return total.unknown > 0 ? t("panel.atLeast", { value: text }) : text;
  };
  const unknownNote = (total: KgTotal) => (total.unknown > 0 ? <span>{t("panel.unknownItems", { count: total.unknown })}</span> : undefined);
  const level = (l: "ok" | "warn" | "danger") => t(`panel.level.${l}`);

  const alertText = (a: SupplyAlert) => {
    switch (a.kind) {
      case "cover":
        return [
          t("panel.supply.alerts.cover", { days: num(a.days), threshold: num(a.threshold, 0) }),
          a.lowerBound ? t("panel.supply.alerts.coverLowerBound") : "",
        ].join(" ");
      case "need_missing":
        return t("panel.supply.alerts.need_missing");
      case "projected_danger":
      case "stockout":
        return t(`panel.supply.alerts.${a.kind}`, { date: fmtDate(a.at, locale), day: a.day });
      case "overdue":
        return t("panel.supply.alerts.overdue", { supplier: orgName(a.supplierOrgId), date: fmtDate(a.plannedAt, locale), kg: a.kg === null ? unknown : t("panel.kg", { kg: num(a.kg) }) });
      case "pending":
        return t("panel.supply.alerts.pending", { batches: a.batches, kg: kgText(a.kg) });
      case "stock_unknown":
        return t("panel.supply.alerts.stock_unknown", { batches: a.batches });
      case "concentration":
        return t("panel.supply.alerts.concentration", { hhi: num(a.hhi, 0), supplier: orgName(a.topOrgId), share: fmtPercent(a.topShare.times(100).toNumber(), locale) });
    }
  };

  const impactSection = impact && (
    <>
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi accent="brand" id="verified" label={t("panel.impact.verified")} value={<KgTotalText total={impact.verified} locale={locale} />} resultClass={impact.resultClass} note={unknownNote(impact.verified)} />
        <Kpi accent="muted" id="declared" label={t("panel.impact.declared")} value={<KgTotalText total={impact.declared} locale={locale} />} resultClass={impact.resultClass} note={unknownNote(impact.declared)} />
        {impact.inPanel && (
          <Kpi accent="glow" id="inPanel" label={t("panel.impact.inPanel")} value={<KgTotalText total={impact.inPanel} locale={locale} />} resultClass={impact.inPanel.resultClass} />
        )}
        <Kpi
          accent="sky"
          id="batches"
          label={t("panel.impact.batches")}
          value={t("panel.impact.batchesValue", { verified: impact.verifiedBatches, total: impact.batches })}
          resultClass={impact.resultClass}
        />
      </dl>

      <section aria-labelledby="sources-title" className="grid gap-3">
        <Caption id="sources-title" title={t(supply ? "panel.impact.sourcesTitle" : "panel.impact.receiversTitle")} resultClass={impact.resultClass} />
        <TableWrap label={t(supply ? "panel.impact.sourcesTitle" : "panel.impact.receiversTitle")}>
          <table className="w-full text-left text-sm" aria-labelledby="sources-title">
            <thead>
              <tr>
                <th scope="col" className={th}>{t("panel.impact.cols.org")}</th>
                <th scope="col" className={th}>{t("panel.impact.cols.kg")}</th>
                <th scope="col" className={th}>{t("panel.impact.cols.share")}</th>
              </tr>
            </thead>
            <tbody>
              {impact.byCounterparty.map((r) => (
                <tr key={r.orgId} data-counterparty={r.orgId} className={tr}>
                  <td className={td}>{orgName(r.orgId)}</td>
                  <td className={td}>{kgText(r.verified)}</td>
                  <td className={td}>
                    {r.share === null ? (
                      unknown
                    ) : (
                      <span className="grid min-w-28 gap-1">
                        <span>{fmtPercent(r.share.times(100).toNumber(), locale)}</span>
                        <span aria-hidden="true" className="block h-1.5 overflow-hidden rounded-full bg-line">
                          <span className="block h-full rounded-full bg-brand" style={{ width: `${Math.min(100, r.share.times(100).toNumber())}%` }} />
                        </span>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </section>

      <section aria-labelledby="trend-title" className="grid gap-3">
        <Caption id="trend-title" title={t("panel.impact.trendTitle")} resultClass={impact.resultClass}>
          {t("panel.impact.trendLead")}
        </Caption>
        {impact.monthly.length >= 2 && (
          <MonthlyChart
            label={t("panel.impact.trendTitle")}
            hint={t("panel.chartHint")}
            locale={locale}
            bars={impact.monthly.map(
              (m): MonthDatum => ({ key: m.month, label: fmtMonth(m.month, locale), value: m.verified.kg?.toNumber() ?? 0, display: kgText(m.verified) }),
            )}
          />
        )}
        <details className={details} open={impact.monthly.length < 2}>
          <summary className={summary}>{t("panel.tableView")}</summary>
          <TableWrap label={t("panel.impact.trendTitle")}>
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th scope="col" className={th}>{t("panel.impact.cols.month")}</th>
                  <th scope="col" className={th}>{t("panel.impact.cols.kg")}</th>
                </tr>
              </thead>
              <tbody>
                {impact.monthly.map((m) => (
                  <tr key={m.month} data-month={m.month} className={tr}>
                    <td className={td}>{fmtMonth(m.month, locale)}</td>
                    <td className={td}>{kgText(m.verified)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </details>
      </section>
      <p role="note" data-co2="hidden" className={`max-w-prose ${noteClass}`}>
        {t("panel.impact.co2")}
      </p>
    </>
  );

  const projection = supply?.projection;
  const firstDanger = supply?.alerts.find((a) => a.kind === "projected_danger");
  const projectionPoints: ProjectionDatum[] =
    supply && projection
      ? [
          {
            day: 0,
            days: supply.days!.toNumber(),
            date: `${t("panel.supply.today")} · ${fmtDate(now, locale)}`,
            detail: t("panel.supply.pointDetail", { kg: num(supply.usable.kg!, 0), days: num(supply.days!) }),
            level: supply.level!,
            levelLabel: level(supply.level!),
            arrival: null,
          },
          ...projection.points.map((p) => ({
            day: p.day,
            days: p.days.toNumber(),
            date: fmtDate(p.at, locale),
            detail: t("panel.supply.pointDetail", { kg: num(p.stockKg, 0), days: num(p.days) }),
            level: p.level,
            levelLabel: level(p.level),
            arrival:
              p.arrivals === 0
                ? null
                : p.arrivalKg === null
                  ? t("panel.supply.arrivalUnknown", { count: p.arrivals })
                  : t("panel.supply.arrival", { count: p.arrivals, kg: num(p.arrivalKg, 0) }),
          })),
        ]
      : [];

  const supplySection = supply && (
    <>
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          accent="brand"
          id="days"
          label={t("panel.supply.days")}
          value={supply.days === null ? <span data-days="unknown">{unknown}</span> : <span data-days={supply.days.toString()}>{t("panel.supply.daysValue", { days: num(supply.days) })}</span>}
          resultClass={supply.resultClass}
          note={supply.level && <StatusChip level={supply.level} label={level(supply.level)} />}
        />
        <Kpi id="usable" label={t("panel.supply.usable")} value={<KgTotalText total={supply.usable} locale={locale} />} resultClass={supply.resultClass} note={unknownNote(supply.usable)} />
        <Kpi accent="muted" id="pending" label={t("panel.supply.pending")} value={<KgTotalText total={supply.pending} locale={locale} />} resultClass={supply.resultClass} note={<span>{t("panel.supply.pendingNote", { batches: supply.pending.batches })}</span>} />
        <Kpi
          accent="sky"
          id="need"
          label={t("panel.supply.need")}
          value={
            supply.dailyNeedKg === null ? (
              <span data-kg="unknown">{unknown}</span>
            ) : (
              <span data-kg={supply.dailyNeedKg.toString()}>{t("panel.kgPerDay", { kg: num(supply.dailyNeedKg) })}</span>
            )
          }
          resultClass={supply.resultClass}
        />
      </dl>
      <p
        className="max-w-prose text-sm text-muted"
        data-thresholds-from-model={supply.thresholds.fromModel}
        data-green={supply.thresholds.greenDays.toString()}
        data-yellow={supply.thresholds.yellowDays.toString()}
      >
        {t(supply.thresholds.fromModel ? "panel.supply.thresholds" : "panel.supply.thresholdsDefault", {
          green: num(supply.thresholds.greenDays, 0),
          yellow: num(supply.thresholds.yellowDays, 0),
        })}
      </p>

      <section aria-labelledby="alerts-title" className="grid gap-3">
        <h3 id="alerts-title" className="text-lg font-semibold tracking-tight text-ink">
          {t("panel.supply.alertsTitle")}
        </h3>
        {supply.alerts.length === 0 ? (
          <p>{t("panel.supply.alertsEmpty")}</p>
        ) : (
          <ul className="grid gap-2">
            {supply.alerts.map((a, i) => (
              <li key={`${a.kind}-${i}`} data-alert={a.kind} data-level={a.level} className="flex flex-wrap items-start gap-x-3 gap-y-1 rounded-xl border border-line bg-surface p-3 shadow-card">
                <StatusChip level={a.level} label={level(a.level)} />
                <span className="min-w-0 flex-1 basis-60">{alertText(a)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {projection && (
        <section aria-labelledby="projection-title" className="grid gap-3">
          <Caption id="projection-title" title={t("panel.supply.projectionTitle")} resultClass={supply.projectionClass}>
            {t("panel.supply.projectionLead")}
            {projection.unknownArrivals > 0 && ` ${t("panel.supply.unknownArrivals", { count: projection.unknownArrivals })}`}
          </Caption>
          <ProjectionChart
            label={t("panel.supply.projectionTitle")}
            hint={t("panel.chartHint")}
            locale={locale}
            points={projectionPoints}
            thresholds={[
              ...([
                [supply.thresholds.greenDays, "ok"],
                [supply.thresholds.yellowDays, "danger"],
              ] as const).map(([days, lv]) => ({
                days: days.toNumber(),
                label: t("panel.supply.thresholdLine", { days: num(days, 0), level: level(lv) }),
                short: t("panel.supply.thresholdShort", { days: num(days, 0) }),
              })),
            ]}
            marker={
              firstDanger
                ? { day: firstDanger.day, label: t("panel.supply.marker", { day: firstDanger.day }), short: t("panel.supply.markerShort", { day: firstDanger.day }) }
                : null
            }
            ticks={X_TICKS.map((d) => ({ day: d, label: d === 0 ? t("panel.supply.today") : fmtShortDate(projection.points[d - 1].at, locale) }))}
          />
          <details className={details}>
            <summary className={summary}>{t("panel.tableView")}</summary>
            <TableWrap label={t("panel.supply.projectionTitle")}>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    <th scope="col" className={th}>{t("panel.supply.cols.date")}</th>
                    <th scope="col" className={th}>{t("panel.supply.cols.stock")}</th>
                    <th scope="col" className={th}>{t("panel.supply.cols.level")}</th>
                    <th scope="col" className={th}>{t("panel.supply.cols.arrival")}</th>
                  </tr>
                </thead>
                <tbody>
                  {projectionPoints.map((p) => (
                    <tr key={p.day} data-day={p.day} className={tr}>
                      <td className={`${td} whitespace-nowrap`}>{p.date}</td>
                      <td className={td}>{p.detail}</td>
                      <td className={td}>{p.levelLabel}</td>
                      <td className={td}>{p.arrival ?? "–"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </details>
        </section>
      )}

      <section aria-labelledby="upcoming-title" className="grid gap-3">
        <Caption id="upcoming-title" title={t("panel.supply.upcomingTitle")} resultClass={supply.resultClass} />
        {supply.upcoming.length === 0 ? (
          <p>{t("panel.supply.upcomingEmpty")}</p>
        ) : (
          <TableWrap label={t("panel.supply.upcomingTitle")}>
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th scope="col" className={th}>{t("panel.supply.cols.plannedAt")}</th>
                  <th scope="col" className={th}>{t("panel.supply.cols.supplier")}</th>
                  <th scope="col" className={th}>{t("panel.supply.cols.plannedKg")}</th>
                </tr>
              </thead>
              <tbody>
                {supply.upcoming.map((d) => (
                  <tr key={d.id} data-delivery-id={d.id} className={tr}>
                    <td className={`${td} whitespace-nowrap`}>{fmtDate(d.plannedAt, locale)}</td>
                    <td className={td}>{orgName(d.supplierOrgId)}</td>
                    <td className={td}>
                      <Qty value={d.plannedKg} locale={locale} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </section>

      <section aria-labelledby="suppliers-title" className="grid gap-3">
        <Caption id="suppliers-title" title={t("panel.supply.suppliersTitle")} resultClass={supply.resultClass}>
          {supply.hhi === null ? t("panel.supply.hhiUnknown") : t("panel.supply.hhi", { value: num(supply.hhi, 0) })}
        </Caption>
        <TableWrap label={t("panel.supply.suppliersTitle")}>
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                <th scope="col" className={th}>{t("panel.supply.cols.supplier")}</th>
                <th scope="col" className={th}>{t("panel.supply.cols.onTime")}</th>
                <th scope="col" className={th}>{t("panel.supply.cols.gap")}</th>
                <th scope="col" className={th}>{t("panel.supply.cols.share")}</th>
                <th scope="col" className={th}>{t("panel.supply.cols.batches")}</th>
              </tr>
            </thead>
            <tbody>
              {supply.suppliers.map((s) => (
                <tr key={s.orgId} data-supplier={s.orgId} className={tr}>
                  <td className={td}>{orgName(s.orgId)}</td>
                  <td className={td}>
                    {s.onTime.rate === null
                      ? unknown
                      : t("panel.supply.onTimeValue", { rate: fmtPercent(s.onTime.rate.times(100).toNumber(), locale), onTime: s.onTime.onTime, due: s.onTime.due })}
                  </td>
                  <td className={td}>{s.gap === null ? unknown : fmtSignedPercent(s.gap.times(100).toNumber(), locale)}</td>
                  <td className={td}>{s.share === null ? unknown : fmtPercent(s.share.times(100).toNumber(), locale)}</td>
                  <td className={td}>{s.batches}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </section>
    </>
  );

  return (
    <main id="main" className={`${page} gap-10`}>
      <PageBanner still="press" title={t("panel.title")} lead={t("panel.welcome", { name: viewer.userName })}>
        <dl className="relative grid gap-x-8 gap-y-3 border-t border-side-line px-6 py-4 text-sm sm:grid-cols-3 sm:px-10">
          <div>
            <dt className="text-side-muted">{t("panel.organization")}</dt>
            <dd className="font-semibold text-side-ink">{viewer.orgName}</dd>
          </div>
          <div>
            <dt className="text-side-muted">{t("panel.kind")}</dt>
            <dd className="font-semibold text-side-ink">{viewer.orgKind ? t(`orgKind.${viewer.orgKind}`) : unknown}</dd>
          </div>
          <div>
            <dt className="text-side-muted">{t("panel.role")}</dt>
            <dd className="font-semibold text-side-ink">{viewer.roles.map((r) => t(`roles.${r}`)).join(", ")}</dd>
          </div>
        </dl>
      </PageBanner>

      <section aria-labelledby="impact-heading" data-section="impact" className="grid gap-6">
        <div className="grid gap-2">
          <h2 id="impact-heading" className={`${sectionTitle} flex items-center gap-3`}>
            <span aria-hidden="true" className="grid size-9 place-items-center rounded-xl bg-brand-soft text-brand">
              <ShieldCheck className="size-5" />
            </span>
            {t("panel.impact.title")}
          </h2>
          <p className={leadClass}>{impact ? t("panel.impact.lead") : t("panel.impact.empty")}</p>
        </div>
        {impactSection}
      </section>

      <section aria-labelledby="supply-heading" data-section="supply" className="grid gap-6">
        <div className="grid gap-2">
          <h2 id="supply-heading" className={`${sectionTitle} flex items-center gap-3`}>
            <span aria-hidden="true" className="grid size-9 place-items-center rounded-xl bg-brand-soft text-brand">
              <Truck className="size-5" />
            </span>
            {t("panel.supply.title")}
          </h2>
          <p className={leadClass}>{supply ? t("panel.supply.lead") : t("panel.supply.empty")}</p>
        </div>
        {supplySection}
      </section>

      <details className={details}>
        <summary className={summary}>{t("panel.permissionsTitle")}</summary>
        <p className="max-w-prose">{t("panel.permissionsLead")}</p>
        <ul className="grid gap-x-6 sm:grid-cols-2">
          {perms.map((p) => (
            <li key={`${p.resource}.${p.action}`} data-allowed={p.allowed} className="flex justify-between gap-4 rounded-lg border border-line bg-surface px-3 py-2">
              <span>{t(`permissions.${p.resource}.${p.action}`)}</span>
              <span className={p.allowed ? "font-semibold" : "line-through"}>{p.allowed ? t("panel.allowed") : t("panel.denied")}</span>
            </li>
          ))}
        </ul>
      </details>
    </main>
  );
}
