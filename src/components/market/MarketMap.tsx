"use client";
// İlan haritası (T2.1): kademeli iyileştirme. WebGL ya da altlık yoksa liste yeter; harita yalnızca konumu gösterir.
// Kontrol düğmesi yok (dokunma hedefi M-12); atıf kendi metnimizle, haritanın altında.
import "maplibre-gl/dist/maplibre-gl.css";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { MARKER, markerColors } from "@/design/map";
import { groupByPoint } from "@/domain/geo";
import { useRouter } from "@/i18n/navigation";

export type MapPoint = { id: string; title: string; own: boolean; lon: number; lat: number };

const STYLE = "https://tiles.openfreemap.org/styles/positron";
// Turbopack bu dosyayı statik varlık olarak kopyalar; MapLibre 6 işçisi kendi başına bir ES modülüdür.
const WORKER = new URL("../../../node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url);
const ANTALYA: [number, number] = [30.7, 36.93];
const LINK = "inline-flex min-h-11 items-center font-semibold underline underline-offset-4";

export function MarketMap({ points }: { points: MapPoint[] }) {
  const t = useTranslations("market.map");
  const locale = useLocale();
  const router = useRouter();
  const title = t("title");
  const here = t("here");
  // Harita yalnızca nokta kümesi değişince yeniden kurulur: bağımlılık dizinin kimliği değil içeriğidir.
  const key = JSON.stringify(points);
  const open = useEffectEvent((id: string) => router.push(`/pazar/${id}`));
  const box = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "fallback">("loading");

  useEffect(() => {
    let disposed = false;
    let remove = () => {};
    const points = JSON.parse(key) as MapPoint[];
    const titles = new Map(points.map((p) => [p.id, p.title]));
    const groups = groupByPoint(points);
    const c = markerColors();
    (async () => {
      if (!document.createElement("canvas").getContext("webgl2")) return setState("fallback");
      const maplibre = await import("maplibre-gl");
      if (disposed || !box.current) return;
      maplibre.setWorkerUrl(WORKER.href);
      const map = new maplibre.Map({
        container: box.current,
        style: STYLE,
        center: ANTALYA,
        zoom: 8.5,
        attributionControl: false,
        dragRotate: false,
        locale: { "Map.Title": title },
      });
      remove = () => map.remove();
      map.on("error", () => !disposed && setState((s) => (s === "ready" ? s : "fallback")));
      map.on("load", () => {
        if (disposed) return;
        map.addSource("listings", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: groups.map((g, i) => ({ type: "Feature", properties: { i, own: g.own, count: g.ids.length }, geometry: { type: "Point", coordinates: [g.lon, g.lat] } })),
          },
        });
        map.addLayer({
          id: "listings",
          type: "circle",
          source: "listings",
          paint: {
            "circle-radius": ["case", [">", ["get", "count"], 1], MARKER.groupRadius, MARKER.radius],
            "circle-color": ["case", ["get", "own"], c.own.fill, c.other.fill],
            "circle-stroke-color": ["case", ["get", "own"], c.own.ring, c.other.ring],
            "circle-stroke-width": ["case", ["get", "own"], MARKER.ownRing, MARKER.ring],
          },
        });
        map.addLayer({ id: "listing-hits", type: "circle", source: "listings", paint: { "circle-radius": MARKER.hitRadius, "circle-opacity": 0 } });
        // Sayı dolgunun üstüne değil yanına, zemin haleli yazılır (M-22).
        map.addLayer({
          id: "listing-counts",
          type: "symbol",
          source: "listings",
          filter: [">", ["get", "count"], 1],
          layout: {
            "text-field": ["to-string", ["get", "count"]],
            "text-font": ["Noto Sans Regular"],
            "text-size": 14,
            "text-anchor": "left",
            "text-offset": [1.1, 0],
            "text-allow-overlap": true,
          },
          paint: { "text-color": c.label.text, "text-halo-color": c.label.halo, "text-halo-width": 2 },
        });
        map.on("click", "listing-hits", (e) => {
          // Dokunma alanları komşu noktalarda örtüşebilir: dokunulan yere en yakın grup seçilir.
          const near = (e.features ?? [])
            .map((f) => groups[Number(f.properties?.i)])
            .filter((g) => g !== undefined)
            .map((g) => ({ g, d: map.project([g.lon, g.lat]).dist(e.point) }))
            .sort((a, b) => a.d - b.d);
          const g = near[0]?.g;
          if (!g) return;
          if (g.ids.length === 1) return open(g.ids[0]);
          // Aynı ilçedeki ilanlar: başlıklar bağlantı olarak listelenir. Başlık kullanıcı metni; yalnızca textContent.
          const list = document.createElement("ul");
          list.setAttribute("aria-label", here);
          for (const id of g.ids) {
            const a = document.createElement("a");
            a.href = `/${locale}/pazar/${id}`;
            a.className = LINK;
            a.textContent = titles.get(id) ?? id;
            a.addEventListener("click", (ev) => {
              ev.preventDefault();
              open(id);
            });
            const li = document.createElement("li");
            li.append(a);
            list.append(li);
          }
          new maplibre.Popup({ closeButton: false, className: "rb-map-popup", maxWidth: "18rem" }).setLngLat([g.lon, g.lat]).setDOMContent(list).addTo(map);
        });
        map.on("mouseenter", "listing-hits", () => (map.getCanvas().style.cursor = "pointer"));
        map.on("mouseleave", "listing-hits", () => (map.getCanvas().style.cursor = ""));
        if (groups.length > 1) {
          const lons = groups.map((g) => g.lon);
          const lats = groups.map((g) => g.lat);
          map.fitBounds(
            [
              [Math.min(...lons), Math.min(...lats)],
              [Math.max(...lons), Math.max(...lats)],
            ],
            { padding: 40, maxZoom: 11, duration: 0 },
          );
        }
        setState("ready");
      });
    })();
    return () => {
      disposed = true;
      remove();
    };
  }, [key, title, here, locale]);

  return (
    <figure className="grid gap-2">
      <div
        ref={box}
        data-map-state={state}
        data-points={points.length}
        data-groups={groupByPoint(points).length}
        className="h-80 w-full overflow-hidden rounded-2xl border border-line bg-canvas shadow-card"
      />
      <figcaption className="grid gap-1 text-sm text-muted">
        <span>{state === "fallback" ? t("fallback") : t("legend")}</span>
        <span>
          {t("attribution")}{" "}
          <a href="https://openfreemap.org" className={LINK}>
            OpenFreeMap
          </a>{" "}
          ·{" "}
          <a href="https://www.openstreetmap.org/copyright" className={LINK}>
            © OpenStreetMap
          </a>
        </span>
      </figcaption>
    </figure>
  );
}
