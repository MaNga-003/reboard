# Sahne denetimi, render yok (pnpm story:check). Ölçümleri JSON'a yazar; eşikleri tests/unit/story-scene.test.ts koyar.
#   blender -b --factory-startup -P story/blender/check.py -- --out <dosya.json>
# 1. Sonraki bölümün eşyaları önceki bölümü bozmaz: 3. bölümün kattıkları (zemin, tartım köşesi, masa eşyaları) 1. ve
#    2. bölümün hiçbir karesinde görünmez (kameradan ışın) ve görünen noktalara gölge düşürmez (görünen noktadan her
#    ışığın yüzeyine ışın). Masadaki kumaş topu bir ara anahtar ışığın %11'ini kesiyordu; kontrol ölçümü o yeri sınar.
# 2. Çuvaldaki yığın folyo gibi parlamaz: kısa dalgalar büyütülünce kırpıntılar paralel oluklu, dik ve tepeli kalıyordu.
import argparse
import functools
import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402
import numpy as np  # noqa: E402
from mathutils import Vector  # noqa: E402

import lib  # noqa: E402
import s1_fibre as s1  # noqa: E402
import s2_scraps as s2  # noqa: E402
import scraps  # noqa: E402
import weighing as W  # noqa: E402

LATER = ("floor", "station", "bench")  # 3. bölümün sahneye kattıkları
BAD_BOLT = (-330.0, -330.0, 18.0)  # topun anahtar ışığı kestiği eski yeri (x, y, dönüş °)
SECTIONS = ((1, s1, 0), (2, s2, 30))
VIEW_GRID, SHADOW_GRID, LIGHT_GRID = 48, 16, 5  # uzun kenardaki ışın sayısı; ışık yüzeyinde n×n örnek
SHADOW_FRAMES = (0, 5, 10, 15, 20, 25, 29)  # bölüm içi

added = set()


def _tracked(fn):
    @functools.wraps(fn)
    def run(*a, **k):
        before = {o.name for o in bpy.data.objects}
        out = fn(*a, **k)
        added.update(o.name for o in bpy.data.objects if o.name not in before)
        return out
    return run


for _n in LATER:
    setattr(W, _n, _tracked(getattr(W, _n)))


def camera_rays(cam, sc, n_long):
    """Kare ızgarasının piksel merkezlerinden geçen ışınlar (dünya)."""
    tr, br, bl, tl = cam.data.view_frame(scene=sc)  # kamera yerelinde; kaydırma (shift) dahil
    M = cam.matrix_world
    o = M.translation.copy()
    wide = sc.render.resolution_x >= sc.render.resolution_y
    nx, ny = (n_long, round(n_long * 9 / 16)) if wide else (round(n_long * 9 / 16), n_long)
    rays = []
    for j in range(ny):
        for i in range(nx):
            u, v = (i + 0.5) / nx, (j + 0.5) / ny
            p = tl.lerp(tr, u).lerp(bl.lerp(br, u), v)
            rays.append((o, (M @ p - o).normalized()))
    return rays


def light_points():
    bpy.context.view_layer.update()  # ışıklar kısıtla döner; matrix_world arka planda kendiliğinden güncellenmez
    out = {}
    for o in bpy.data.objects:
        if o.type == "LIGHT" and o.data.type == "AREA":
            sx = o.data.size
            sy = o.data.size_y if o.data.shape in ("RECTANGLE", "ELLIPSE") else sx
            g = np.linspace(-1, 1, LIGHT_GRID)
            out[o.name] = [o.matrix_world @ Vector((u * sx / 2, v * sy / 2, 0)) for u in g for v in g]
    return out


def visible_points(sc, cam, frame, n_long):
    """Kameranın gördüğü ilk yüzeyler: [(nokta, normal, nesne adı)] ve atılan ışın sayısı."""
    sc.frame_set(frame)
    dg = bpy.context.evaluated_depsgraph_get()
    rays = camera_rays(cam.evaluated_get(dg), sc, n_long)
    out = []
    for o, d in rays:
        hit, p, n, _, obj, _ = sc.ray_cast(dg, o, d)
        if hit:
            out.append((p, n if n.dot(d) < 0 else -n, obj.name))
    return out, len(rays)


def shadow(sc, points, lights, only=None):
    """Her ışık için: görünen noktalarda ışık yüzeyinin 3. bölüm eşyalarınca kesilen payı (ortalama, en kötü)."""
    dg = bpy.context.evaluated_depsgraph_get()
    res = {}
    for name, L in sorted(lights.items()):
        if only and name != only:
            continue
        frac = []
        for p, n, _ in points:
            o = p + n * 0.05
            blocked = 0
            for q in L:
                d = q - o
                hit, _, _, _, obj, _ = sc.ray_cast(dg, o, d.normalized(), distance=d.length)
                blocked += bool(hit and obj.name in added)
            frac.append(blocked / len(L))
        res[name] = {"mean": round(float(np.mean(frac)), 5), "max": round(float(np.max(frac)), 4)}
    return res


def move_bolt(x, y, rot_deg):
    root = bpy.data.objects["BoltRoot"]
    root.location = (x, y, 0.0)
    root.rotation_euler = (0.0, 0.0, math.radians(rot_deg))
    bpy.context.view_layer.update()


def intrusion(aspect):
    """1.–2. bölüm: 3. bölüm eşyalarının görünmesi ve gölgesi; ardından bilerek bozulmuş iki kontrol."""
    out = {"view": {}, "shadow": {}}
    cfg = lib.Cfg(aspect, "preview", lib.ROOT)
    for sec, mod, f0 in SECTIONS:
        lib.reset()
        added.clear()
        f1 = f0 + lib.FRAMES_PER_SECTION - 1
        mod.build(cfg, f0, f1)
        sc = bpy.context.scene
        cam = sc.objects["Cam"]
        lights = light_points()
        rays = seen = 0
        for f in range(f0, f1 + 1):
            pts, n = visible_points(sc, cam, f, VIEW_GRID)
            rays += n
            seen += sum(name in added for _, _, name in pts)
        pts = []
        for k in SHADOW_FRAMES:
            pts += visible_points(sc, cam, f0 + k, SHADOW_GRID)[0]
        out["view"][f"s{sec}"] = {"rays": rays, "hits": seen}
        out["shadow"][f"s{sec}"] = {"points": len(pts), "lights": shadow(sc, pts, lights)}
        if sec == 2:
            last = visible_points(sc, cam, f1, SHADOW_GRID)[0]
            # Kontrol 1: top kesim alanının ortasına konunca son karede görünmeli.
            move_bolt(s2.CENTER[0], s2.CENTER[1], 0.0)
            hits = sum(name in added for _, _, name in visible_points(sc, cam, f1, VIEW_GRID)[0])
            # Kontrol 2: top eski yerindeyken anahtar ışığı son karede kesmeli.
            move_bolt(*BAD_BOLT)
            out["control"] = {"view_hits": hits, "key_shadow": shadow(sc, last, lights, only="Key")["Key"]}
            move_bolt(W.BOLT_AT[0], W.BOLT_AT[1], math.degrees(W.BOLT_ROT))
    return out


def heap_metrics():
    """dik: kırpıntı üst yüzünde eğimi 60°'yi aşan alan payı. oluk: yüz normalinin tümsek normaline göre 30°'den
    fazla eğik olduğu alan payı (kısa dalga sırtı, kırışık). tepe: çuval dudağının üstünde mm. örtü: ağız içinde
    kırpıntıyla örtülü nokta payı."""
    lib.reset()
    res = W.heap()
    bpy.context.view_layer.update()  # matrix_world arka planda kendiliğinden güncellenmez
    base = W.heap_field(8)
    gy, gx = np.gradient(base.H, base.Y[:, 0], base.X[0, :])
    x0, y0 = base.X[0, 0], base.Y[0, 0]
    dx, dy = base.X[0, 1] - x0, base.Y[1, 0] - y0
    area = steep = groove = 0.0
    top = -1e9
    for o in res["objects"]:
        me = o.data
        n = len(me.polygons)
        nrm, cen, ar = np.zeros(n * 3), np.zeros(n * 3), np.zeros(n)
        sm = np.zeros(n, bool)
        me.polygons.foreach_get("normal", nrm)
        me.polygons.foreach_get("center", cen)
        me.polygons.foreach_get("area", ar)
        me.polygons.foreach_get("use_smooth", sm)
        co = np.zeros(len(me.vertices) * 3)
        me.vertices.foreach_get("co", co)
        top = max(top, co.reshape(-1, 3)[:, 2].max())
        # Köşeler kırpıntı yerelinde (x, y), z dünyada; nesne yalnızca konum ve z dönüşü taşır.
        M = np.array(o.matrix_world)
        assert abs(M[2, 3]) < 1e-6, f"{o.name}: nesnenin z konumu sıfır değil, tepe ölçüsü geçersiz"
        cen = cen.reshape(-1, 3) @ M[:3, :3].T + M[:3, 3]
        nrm = nrm.reshape(-1, 3) @ M[:3, :3].T
        i = np.clip(np.rint((cen[:, 1] - y0) / dy).astype(int), 0, base.H.shape[0] - 1)
        j = np.clip(np.rint((cen[:, 0] - x0) / dx).astype(int), 0, base.H.shape[1] - 1)
        nf = np.stack([-gx[i, j], -gy[i, j], np.ones(n)], axis=1)
        nf /= np.linalg.norm(nf, axis=1, keepdims=True)
        rel = np.abs(np.sum(nrm * nf, axis=1))
        # Kesik kenar şeridi (düz gölgeli) sayılmaz: yalnızca kumaşın üst yüzü.
        area += ar[sm].sum()
        steep += ar[sm & (np.abs(nrm[:, 2]) < 0.5)].sum()
        groove += ar[sm & (rel < math.cos(math.radians(30)))].sum()
    f = res["field"]
    mouth = W._rho(f.X, f.Y) < 0.95
    lip = W.PLAT_TOP + W.SACK_H + 2 * W.LIP
    return {"pieces": len(res["objects"]), "steep": round(steep / area, 4), "groove": round(groove / area, 4),
            "crest_mm": round(float(top - lip), 1), "cover": round(float(np.mean(f.H[mouth] > base.H[mouth] + 0.2)), 4)}


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--out", required=True)
    args = p.parse_args(argv)
    out = {"intrusion": {a: intrusion(a) for a in ("d", "m")}, "heap": heap_metrics()}
    # Kontrol: kısa dalganın eğim sınırı kalkınca (eski yığın) oluk ölçüsü eşiği aşmalı.
    keep = scraps.heap
    scraps.heap = functools.partial(keep, max_slope=1e9)
    out["heap"]["control_groove"] = heap_metrics()["groove"]
    scraps.heap = keep
    with open(args.out, "w", encoding="utf8") as fh:
        json.dump(out, fh, ensure_ascii=False, indent=2)
    print("CHECK " + json.dumps(out, ensure_ascii=False))


main()
