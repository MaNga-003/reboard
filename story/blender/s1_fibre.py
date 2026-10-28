# 1. bölüm: tek lif (birim mm). Kamera saçaktaki tek bir liften geri çekilir, denimin dokusunu açar.
import math

import lib
import scraps
import textile
from mathutils import Vector

COLOURS = {
    "warp": ["Dark Tyrian Blue", "Deep Lyons Blue", "Violet Blue", "Deep Lyons Blue"],
    "warp_inner": ["Olympic Blue", "Salvia Blue"],
    "weft": ["Ecru", "Ivory Buff"],
    "warp_core": "Dark Tyrian Blue",
    "weft_core": "Ecru",
    "hero": ["Deep Lyons Blue", "Deep Lyons Blue", "Olympic Blue"],
}

W0, W1 = 0.6, 13.0  # görüş genişliği (mm): baş ve son kare
END_AZ, END_EL, END_K = 204, 36, 0.011  # son kare: 2. bölüm buradan devam eder


def table(size=4000):
    m = lib.kraft("Kraft", "Isabella Color", "Maple", "Ivory Buff", unit=1.0)
    return lib.plane("Table", (size, size), (0, 0, 0), m)


def lights(scale=4.0):
    lib.world("Deep Slate Olive", strength=0.04)
    # Alçak anahtar ışık kâğıdın lifini sıyırır; arka ışık ince lifin kenarını yakar; dolgu zayıf: derinlik kalır.
    # scale uzaklığı ve boyu büyütür, gücü karesiyle artırır: merkezdeki aydınlık aynı kalır, 2. bölümün
    # geniş kadrajında ışık kenarlara doğru sönmez.
    lib.area_light(lib.orbit((0, 0, 0), 240 * scale, 250, 30), (0, -2, 0), size=70 * scale,
                   power=560e3 * scale ** 2, color="Sulpher Yellow", name="Key")
    lib.area_light(lib.orbit((0, 0, 0), 220 * scale, 15, 16), (0, 0, 0), size=40 * scale,
                   power=760e3 * scale ** 2, color="Nile Blue", name="Rim")
    lib.area_light(lib.orbit((0, 0, 0), 420 * scale, 175, 62), (0, -4, 0), size=320 * scale,
                   power=150e3 * scale ** 2, color="White", name="Fill")


def end_target(meta):
    return Vector((meta["hero_tip"][0] - 0.6, -2.6, 0.35))


def camera_path(cam, meta, f0, f1):
    P = meta["hero_path"]
    # Açılış: lifin ucu kadrajın sağ yarısında, ince ve net.
    start = Vector(P[-14])
    end = end_target(meta)

    def path(t):
        tau = lib.soft(t, 0.35)
        w = lib.expo(W0, W1, tau)
        g = lib.lerp(start, end, lib.smooth(min(1.0, tau * 1.08)))
        d = lib.dist_for_width(cam, w)
        az = lib.lerp(138, END_AZ, lib.smooth(t))
        el = lib.lerp(13, END_EL, lib.smooth(tau))
        return lib.orbit(g, d, az, el), g

    def fstop(t):
        tau = lib.soft(t, 0.35)
        w = lib.expo(W0, W1, tau)
        k = lib.lerp(0.032, END_K, tau)  # arka planın bulanıklığı, kare genişliğine oranla
        return 0.1 / (2 * k * w)

    lib.fly(cam, cam.constraints[0].target, f0, f1, path, fstop)


def scene():
    """Kesim masası: kraft kâğıt, ışık, lif düzeyinde denim şerit ve çevresindeki kırpıntılar (1. ve 2. bölüm)."""
    table()
    lights()
    meta = textile.build(textile.Denim(seed=11), COLOURS)
    meta["table"] = scraps.cutting_table()
    return meta


def build(cfg, f0=0, f1=29):
    lib.setup(cfg, f0, f1, exposure=0.0)
    meta = scene()
    cam, tgt = lib.camera(cfg, lens=100, fstop=2.0, clip=(0.02, 20000))
    camera_path(cam, meta, f0, f1)
    print(f"S1 curves={meta['curves']} points={meta['points']}")
    return meta
