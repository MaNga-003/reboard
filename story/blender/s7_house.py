# 7. bölüm: dolap, oda, ev (birim mm). Atölyeden kesme: ilk kare 6. bölümün son karesidir, ama levha artık bir
# dolabın üstüdür. Kamera aynı yerden geri çekilip yükselir: dolap, levha kaplı duvar, oda, kesitli ev ve bahçe
# açılır; son karede ev neredeyse tepeden görünür, 8. bölüm oradan dikine yükselir.
import bpy
from mathutils import Vector

import house
import lib
import pressing
import s6_panel as s6

END_K = 0.004
SOFT = 0.35  # genişlik eğrisinin yumuşaması (lib.soft); 8. bölüm son karedeki hızı bundan sürdürür
# Son kare: yükseklik açısı, görüş genişliği (mobilde dikey kenar) ve odak (ev koordinatında). Azimut kesmeden gelir
# (6. bölümde hat yerelinde −Y, evde dünya −Y: 270°) ve değişmez.
END = {
    "d": (84, 36000.0, (6500.0, 4200.0, 0.0)),
    "m": (84, 40000.0, (6500.0, 4600.0, 0.0)),
}
# Kesmede ışık: 6. bölümün son karesinde levhayı presin tavan ışıkları aydınlatır; yüzeyde üstte ve sağda açık bir
# havuz vardır (satır L 0,49 → 0,42). Evin gün ışığı dolabın üstünü düz aydınlatır; eğim kesmede birden kaybolurdu.
# Bu yüzden aynı ışıklar kesmeyle eve taşınır ve ilk karelerde söner. Pozlama EXPOSURE0'dan sıfıra döner ve ışık
# her karede o pozlamayı dengeleyecek kadar kısılır: yüzeyin ortalama parlaklığı sabit kalır, fotoğraf makinesinin
# otomatik pozlaması gibi. POOL_GAIN ve EXPOSURE0 ölçülerek seçildi (M-30): kesmede satır ve sütun eğimi ile
# ortalama renk 6. bölümün son karesine eşlenir. Havuz gün ışığından ne kadar güçlüyse eğim o kadar korunur
# (×6'da satır biçim farkı 0,023 → 0,004). Atölyede presin gövdesi PoolPress'i levhanın sol yanında keser; evde o
# gövde yok, sol taraf aydınlanıyordu. Levhanın üstündeki PoolBoard güçlendirilerek yatay eğim de eşlenir
# (masaüstü sütun biçim farkı 0,017 → 0,005).
POOL_GAIN = (6.0, 20.0)  # pres ışıkları, levha ışığı (PoolBoard)
EXPOSURE0 = -3.16
FADE = 0.4  # bölümün ilk %40'ında söner
NO_SHADOW = ("Cladding", "Art")  # arka duvardakiler: ışık duvarın ötesinden gelir, gölgeleri düşmez


def start(aspect):
    """6. bölümün son karesindeki kamera ve odak, levhanın yerelinden dolabın üstüne taşınmış."""
    az, el, w, _ = s6.END[aspect]
    g6 = s6.end_target(aspect)
    d = w * 100.0 / 36.0  # lib.dist_for_width, lens 100 ve sensör 36 (6. bölümle aynı kamera)
    c6 = lib.orbit(g6, d, az, el)
    m = house.cut()
    return m @ c6, m @ g6


def camera_path(cam, cfg, f0, f1):
    c0, g0 = start(cfg.aspect)
    w0 = s6.END[cfg.aspect][2]
    el1, w1, g1 = END[cfg.aspect]
    g1 = Vector(g1)
    off = c0 - g0
    az = 270.0
    el0 = s6.END[cfg.aspect][1]

    def width(t):
        return lib.expo(w0, w1, lib.soft(t, SOFT))

    def path(t):
        w = width(t)
        # Odak genişlikle birlikte kayar: ilk yarıda dolap kadrajın ortasında kalır, ev sonra ortalanır.
        g = lib.lerp(g0, g1, (w - w0) / (w1 - w0))
        return lib.orbit(g, lib.dist_for_width(cam, w), az, lib.lerp(el0, el1, lib.smooth(t))), g

    def fstop(t):
        return 0.1 / (2 * lib.lerp(s6.END_K, END_K, lib.soft(t, SOFT)) * width(t))

    assert abs(off.length - lib.dist_for_width(cam, w0)) < 1e-3
    lib.fly(cam, cam.constraints[0].target, f0, f1, path, fstop)


def pool_lights():
    """Presin ışıkları (pressing.lights, aynı kod) 6. bölümün dünyasında kurulur, sonra hedefleriyle birlikte kesmeyle
    taşınır: levhanın yerelinde aynı yerde dururlar. Kesme Z çevresinde dönme ve öteleme olduğu için TRACK_TO'nun
    yukarı ekseni de korunur. Levhayı asıl aydınlatan PoolPress'tir (kapatınca L 0,49 → 0,17) ve eğim onun koni
    kenarından gelir; evde bu ışıklar odanın arka duvarının ötesinde kalır. Bu yüzden ışık ve gölge bağlamayla
    yalnızca odanın içini aydınlatırlar (geri çekilirken oda karanlıkta kalmasın); gölgeyi de duvarın önündeki
    eşyalar düşürür, duvar, kaplama ve tablo düşürmez."""
    before = set(bpy.data.objects)
    pressing.lights()
    m = house.cut()
    new = [o for o in bpy.data.objects if o not in before]
    for o in new:
        o.location = m @ o.location
    x0, x1, y0, y1 = house.ROOM
    receivers = bpy.data.collections.new("PoolReceivers")  # sahneye bağlı değil; yalnızca bağlama listesi
    blockers = bpy.data.collections.new("PoolBlockers")
    for o in bpy.data.objects:
        if o.type != "MESH":
            continue
        c = o.matrix_world @ (sum((Vector(v) for v in o.bound_box), Vector()) / 8)
        if x0 <= c.x <= x1 and y0 <= c.y <= y1 and c.z < house.STOREY:
            receivers.objects.link(o)
            if not o.name.startswith(NO_SHADOW):
                blockers.objects.link(o)
    lights = [o for o in new if o.type == "LIGHT"]
    for o in lights:
        o.light_linking.receiver_collection = receivers
        o.light_linking.blocker_collection = blockers
    return lights


def exposure(sc, lights, f0, f1):
    """Pozlama e(f) yumuşakça EXPOSURE0'dan sıfıra; ışığın payı k = (2^−e − 1) / (2^−EXPOSURE0 − 1). Kesmede
    2^EXPOSURE0 · (havuz + gün) = gün olacak biçimde ölçüldüğü için her karede 2^e · (k · havuz + gün) = gün kalır."""
    assert EXPOSURE0 < 0
    fe = f0 + round((f1 - f0) * FADE)
    full = {o: o.data.energy * POOL_GAIN[o.name.startswith("PoolBoard")] for o in lights}
    for f in range(f0, fe + 1):
        e = EXPOSURE0 * (1.0 - lib.smooth((f - f0) / (fe - f0)))
        sc.view_settings.exposure = e
        sc.view_settings.keyframe_insert("exposure", frame=f)
        k = (2.0 ** -e - 1.0) / (2.0 ** -EXPOSURE0 - 1.0)
        for o, E in full.items():
            o.data.energy = E * k
            o.data.keyframe_insert("energy", frame=f)


def build(cfg, f0=180, f1=209):
    sc = lib.setup(cfg, f0, f1, exposure=0.0)
    house.build()
    lights = pool_lights()
    cam, tgt = lib.camera(cfg, lens=100, fstop=2.0, clip=(1.0, 1.0e6))
    camera_path(cam, cfg, f0, f1)
    exposure(sc, lights, f0, f1)
    print(f"S7 objects={len(bpy.data.objects)}")
    return {}
