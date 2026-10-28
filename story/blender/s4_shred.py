# 4. bölüm: ayıklama ve parçalama (birim mm). 3. bölümün son karesinden devam eder: kamera çuvaldan geri çekilip
# sağa kayar; arkada ayıklama bandı ve ipek kasası, ortada yırtma makinesi, sağ önde açılmış lif yığını görünür.
import lib
import s1_fibre as s1
import s3_weighing as s3
import shredding
from mathutils import Vector
from weighing import FLOOR

W3 = s3.W3
END_K = 0.0028
# Son kare: azimut, yükseklik açısı, görüş genişliği (mobilde dikey kenar) ve odak (shredding.at: sağ, derinlik).
# Masaüstü: çuval sol kenarda, bant arkadan makineye iner, yığın sağ önde; metin kartı çuvalın önündeki boş
# zemine düşer (çuval tabanı kartın üst kenarının üstünde kalmalı: v ≤ 0,80). Mobil: hat bu açıdan yatay sığmaz
# (5,1 m ↔ 4,3 m); kamera hattın ucuna döner, hat kadrajı çapraz keser: üstte kasa ve bant, ortada makine, altta
# yığın; metin altta zemine. Değerler kilit noktaların izdüşümüyle seçildi (içerik masaüstünde u 0,10–0,89,
# v 0,07–0,79; mobilde u 0,08–0,93, v 0,15–0,70).
END = {
    "d": (205, 31, 6500.0, Vector((*shredding.at(2950, 1250), FLOOR + 400))),
    "m": (232, 42, 7900.0, Vector((*shredding.at(1850, 1950), FLOOR + 550))),
}


def camera_path(cam, cfg, f0, f1):
    start = s3.END_M if cfg.portrait else s3.END_D
    az1, el1, w1, end = END[cfg.aspect]

    def width(t):
        return lib.expo(W3, w1, lib.soft(t, 0.35))

    def path(t):
        tau = lib.soft(t, 0.35)
        w = width(t)
        g = lib.lerp(start, end, (w - W3) / (w1 - W3))
        d = lib.dist_for_width(cam, w)
        az = lib.lerp(s3.END_AZ, az1, lib.smooth(t))
        el = lib.lerp(s3.END_EL, el1, lib.smooth(tau))
        return lib.orbit(g, d, az, el), g

    def fstop(t):
        k = lib.lerp(s3.END_K, END_K, lib.soft(t, 0.35))
        return 0.1 / (2 * k * width(t))

    lib.fly(cam, cam.constraints[0].target, f0, f1, path, fstop)


def build(cfg, f0=90, f1=119):
    lib.setup(cfg, f0, f1, exposure=0.0)
    meta = s1.scene()
    cam, tgt = lib.camera(cfg, lens=100, fstop=2.0, clip=(0.02, 40000))
    camera_path(cam, cfg, f0, f1)
    print(f"S4 curves={meta['curves']} points={meta['points']}")
    return meta
