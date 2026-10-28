# 2. bölüm: kırpıntılar (birim mm). 1. bölümün son karesinden devam eder: kamera denim şeritten geri çekilir,
# kesim masasındaki öteki kırpıntıları, makası ve tebeşiri açar.
import lib
import s1_fibre as s1
from mathutils import Vector

W1, W2 = s1.W1, 210.0  # görüş genişliği (mm): baş ve son kare
CENTER = Vector((34.0, 18.0, 1.0))  # son karede kadrajın odağı: şerit önde, kırpıntı yığını arkada


def camera_path(cam, meta, f0, f1):
    start = s1.end_target(meta)

    def path(t):
        tau = lib.soft(t, 0.35)
        w = lib.expo(W1, W2, tau)
        g = lib.lerp(start, CENTER, lib.smooth(tau))
        d = lib.dist_for_width(cam, w)
        az = lib.lerp(s1.END_AZ, 222, lib.smooth(t))
        el = lib.lerp(s1.END_EL, 58, lib.smooth(tau))
        return lib.orbit(g, d, az, el), g

    def fstop(t):
        tau = lib.soft(t, 0.35)
        w = lib.expo(W1, W2, tau)
        k = lib.lerp(s1.END_K, 0.005, tau)
        return 0.1 / (2 * k * w)

    lib.fly(cam, cam.constraints[0].target, f0, f1, path, fstop)


def build(cfg, f0=30, f1=59):
    lib.setup(cfg, f0, f1, exposure=0.0)
    meta = s1.scene()
    cam, tgt = lib.camera(cfg, lens=100, fstop=2.0, clip=(0.02, 20000))
    camera_path(cam, meta, f0, f1)
    print(f"S2 curves={meta['curves']} points={meta['points']}")
    return meta
