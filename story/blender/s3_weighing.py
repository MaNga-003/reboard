# 3. bölüm: çuval ve kantar (birim mm). 2. bölümün son karesinden devam eder: kamera kesim masasından geri çekilip
# sola döner; masa, zemin ve önde kantarın üstündeki kırpıntı çuvalı açılır. Işık 1. bölümün üçlüsüdür: bu
# açıdan anahtar ışık sağ önden, arka ışık tam arkadan, dolgu sol önden gelir.
import lib
import s1_fibre as s1
import s2_scraps as s2
from mathutils import Vector

W2, W3 = s2.W2, 2450.0  # görüş genişliği (mm): baş ve son kare (mobilde dikey kenar)
END_AZ, END_EL, END_K = 200, 40, 0.0028
# Son karenin odağı. Masaüstü: çuval sağda, gösterge ve platform tümüyle kadrajda; masa, kırpıntı kümesi ve
# kumaş topu solda (metin kartı sol altta boş masaya düşer). Mobil: çuval ortada; masa üstte, metin altta zemine.
END_D = Vector((490.0, -1005.0, -345.0))
END_M = Vector((430.0, -985.0, -290.0))


def camera_path(cam, cfg, f0, f1):
    start, end = s2.CENTER, (END_M if cfg.portrait else END_D)

    def width(t):
        return lib.expo(W2, W3, lib.soft(t, 0.35))

    def path(t):
        tau = lib.soft(t, 0.35)
        w = width(t)
        # Odak genişlikle orantılı kayar: ekrandaki kayma hızı zoom boyunca aynı kalır.
        g = lib.lerp(start, end, (w - W2) / (W3 - W2))
        d = lib.dist_for_width(cam, w)
        az = lib.lerp(222, END_AZ, lib.smooth(t))
        el = lib.lerp(58, END_EL, lib.smooth(tau))
        return lib.orbit(g, d, az, el), g

    def fstop(t):
        k = lib.lerp(0.005, END_K, lib.soft(t, 0.35))
        return 0.1 / (2 * k * width(t))

    lib.fly(cam, cam.constraints[0].target, f0, f1, path, fstop)


def build(cfg, f0=60, f1=89):
    lib.setup(cfg, f0, f1, exposure=0.0)
    meta = s1.scene()
    cam, tgt = lib.camera(cfg, lens=100, fstop=2.0, clip=(0.02, 30000))
    camera_path(cam, cfg, f0, f1)
    print(f"S3 curves={meta['curves']} points={meta['points']}")
    return meta
