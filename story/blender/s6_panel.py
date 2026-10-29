# 6. bölüm: panel (birim mm). 5. bölümün son karesinden devam eder: kamera çıkış masasındaki levhaya iner; levhanın
# benekli yüzü kadrajı doldurur, öndeki kenarda 18 mm'lik kalınlık seçilir (hedef kalınlık, ölçülmüş değil; D-011).
# Bölümler arasında tek yaklaşma budur; 7. bölüm aynı yüzeyden geri çekilir.
import lib
import pressing
import s1_fibre as s1
import s5_press as s5
from mathutils import Vector
from weighing import FLOOR

END_K = 0.006
TOP = pressing.ROLL_Z + pressing.SHEET[2] + pressing.BOARD[2]  # levhanın üst yüzü (zeminden)
# Son kare: azimut, yükseklik açısı, görüş genişliği (mobilde dikey kenar) ve odak (pres yerelinde x, y; z levha
# yüzünde). Azimut 170° hat yerelinde −Y'dir: kamera levhanın kameraya bakan kenarının üstünden dik bakar. Yaklaşırken
# ön kenar (18 mm) altta görünür, son karelerde kadrajdan çıkar: kesmede iki karede de yalnızca levha yüzü kalır
# (kenarın ötesi 6. bölümde çelik sac, 7. bölümde dolap kapağı; şerit olarak kalsaydı kesmede renk sıçrardı).
# Kadrajın levhadaki izi dolap üstünün 600 mm'lik derinliğine (−1830…−1230) iki yandan ~45 mm payla sığar:
# kesmede ne ön ne arka kenar görünür.
END = {
    "d": (170, 62, 700.0, (2850.0, -1545.0)),
    "m": (170, 72, 500.0, (2850.0, -1482.0)),
}


def end_target(aspect):
    x, y = END[aspect][3]
    return Vector((*pressing.world(x, y), FLOOR + TOP))


def camera_path(cam, cfg, f0, f1):
    az0, el0, w0, _ = s5.END[cfg.aspect]
    az1, el1, w1, _ = END[cfg.aspect]
    start, end = s5.end_target(cfg.aspect), end_target(cfg.aspect)

    def width(t):
        return lib.expo(w0, w1, lib.soft(t, 0.35))

    def path(t):
        w = width(t)
        # Odak genişlikle birlikte kayar: yaklaşırken levha kadrajdan kaçmaz.
        g = lib.lerp(start, end, (w - w0) / (w1 - w0))
        d = lib.dist_for_width(cam, w)
        az = lib.lerp(az0, az1, lib.smooth(t))
        el = lib.lerp(el0, el1, lib.smooth(lib.soft(t, 0.35)))
        return lib.orbit(g, d, az, el), g

    def fstop(t):
        return 0.1 / (2 * lib.lerp(s5.END_K, END_K, lib.soft(t, 0.35)) * width(t))

    lib.fly(cam, cam.constraints[0].target, f0, f1, path, fstop)


def build(cfg, f0=150, f1=179):
    lib.setup(cfg, f0, f1, exposure=0.0)
    meta = s1.scene()
    cam, tgt = lib.camera(cfg, lens=100, fstop=2.0, clip=(0.02, 60000))
    camera_path(cam, cfg, f0, f1)
    print(f"S6 curves={meta['curves']} points={meta['points']}")
    return meta
