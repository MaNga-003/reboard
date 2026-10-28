# 5. bölüm: bağlayıcı ve pres (birim mm). 4. bölümün son karesinden devam eder: kamera hat boyunca sağa kayıp
# biraz geri çekilir; lif yığını soldan çıkar, besleme masasındaki keçe, pres ve çıkış masasındaki levha açılır.
import lib
import pressing
import s1_fibre as s1
import s4_shred as s4
from mathutils import Vector
from weighing import FLOOR

END_K = 0.0028
# Son kare: azimut, yükseklik açısı, görüş genişliği (mobilde dikey kenar) ve odak (pres yerelinde x, y, z).
END = {
    "d": (205, 30, 13000.0, (0.0, -300.0, 700.0)),
    "m": (234, 44, 12500.0, (0.0, -200.0, 900.0)),
}


def end_target(aspect):
    x, y, z = END[aspect][3]
    return Vector((*pressing.world(x, y), FLOOR + z))


def camera_path(cam, cfg, f0, f1):
    az0, el0, w0, start = s4.END[cfg.aspect]
    az1, el1, w1, _ = END[cfg.aspect]
    end = end_target(cfg.aspect)

    def width(t):
        return lib.expo(w0, w1, lib.soft(t, 0.35))

    def path(t):
        tau = lib.soft(t, 0.35)
        g = lib.lerp(start, end, lib.smooth(tau))
        d = lib.dist_for_width(cam, width(t))
        az = lib.lerp(az0, az1, lib.smooth(t))
        el = lib.lerp(el0, el1, lib.smooth(tau))
        return lib.orbit(g, d, az, el), g

    def fstop(t):
        return 0.1 / (2 * lib.lerp(s4.END_K, END_K, t) * width(t))

    lib.fly(cam, cam.constraints[0].target, f0, f1, path, fstop)


def build(cfg, f0=120, f1=149):
    lib.setup(cfg, f0, f1, exposure=0.0)
    meta = s1.scene()
    cam, tgt = lib.camera(cfg, lens=100, fstop=2.0, clip=(0.02, 60000))
    camera_path(cam, cfg, f0, f1)
    print(f"S5 curves={meta['curves']} points={meta['points']}")
    return meta
