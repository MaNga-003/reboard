# 1. bölüm: tek lif (birim mm). Kamera saçaktaki tek bir liften geri çekilir, denimin dokusunu açar.
import math

import lib
import textile
from mathutils import Vector

COLOURS = {
    "warp": "Deep Lyons Blue",
    "warp_inner": "Salvia Blue",
    "weft": "Ecru",
    "warp_core": "Dark Tyrian Blue",
    "weft_core": "Ecru",
}

W0, W1 = 0.75, 13.0  # görüş genişliği (mm): baş ve son kare


def table(size=4000):
    m = lib.paper("Kraft", "Isabella Color", rough=0.75, scale=2.5)
    return lib.plane("Table", (size, size), (0, 0, 0), m)


def lights(scale=1.0):
    lib.world("Deep Slate Olive", strength=0.04)
    lib.area_light(lib.orbit((0, 0, 0), 240 * scale, 250, 42), (0, -2, 0), size=70 * scale,
                   power=520e3 * scale ** 2, color="Sulpher Yellow", name="Key")
    lib.area_light(lib.orbit((0, 0, 0), 220 * scale, 15, 20), (0, 0, 0), size=50 * scale,
                   power=650e3 * scale ** 2, color="Nile Blue", name="Rim")
    lib.area_light(lib.orbit((0, 0, 0), 420 * scale, 175, 62), (0, -4, 0), size=320 * scale,
                   power=260e3 * scale ** 2, color="White", name="Fill")


def camera_path(cam, meta, f0, f1):
    start = Vector(meta["hero_mid"])
    end = Vector((meta["hero_tip"][0] - 0.6, -2.6, 0.35))

    def path(t):
        tau = lib.soft(t, 0.35)
        w = lib.expo(W0, W1, tau)
        g = lib.lerp(start, end, lib.smooth(min(1.0, tau * 1.08)))
        d = lib.dist_for_width(cam, w)
        az = lib.lerp(166, 204, lib.smooth(t))
        el = lib.lerp(13, 36, lib.smooth(tau))
        return lib.orbit(g, d, az, el), g

    def fstop(t):
        tau = lib.soft(t, 0.35)
        w = lib.expo(W0, W1, tau)
        k = lib.lerp(0.032, 0.011, tau)  # arka planın bulanıklığı, kare genişliğine oranla
        return 0.1 / (2 * k * w)

    lib.fly(cam, cam.constraints[0].target, f0, f1, path, fstop)


def build(cfg, f0=0, f1=29):
    lib.setup(cfg, f0, f1, exposure=0.0)
    table()
    lights()
    spec = textile.Denim(seed=11)
    meta = textile.build(spec, COLOURS)
    cam, tgt = lib.camera(cfg, lens=100, fstop=2.0, clip=(0.02, 20000))
    camera_path(cam, meta, f0, f1)
    print(f"S1 curves={meta['curves']} points={meta['points']}")
    return meta
