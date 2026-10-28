# Ayıklama ve parçalama istasyonu (birim mm): tartım köşesinin sağında, aynı atölyede. Ayıklama bandının yanında
# ayrılan ipeğin kasası, bandın eğimli ucunda yırtma makinesi, çıkış oluğunun önünde açılmış lif yığını ve havada
# lif tutamları. 1. bölümden beri sahnede durur; 1.–3. bölümün karelerine girmez, gölge düşürmez ve ışıkları 1.–2.
# bölümde görünen yüzeye doğrudan ulaşmaz (pnpm story:check). Makinede yazı, plaka ya da gösterge yok (D-011).
import math

import numpy as np

import lib
import scraps
from weighing import FLOOR, _local, _world

TAU = 2 * math.pi

# Yerleşim 4. bölümün son kamerasına göre okunur: R sağ, F derinlik (azimut 205°); köken 3. bölümün son odağı
# (çuval). "Çuvalın 2,6 m sağı, 0,9 m gerisi" gibi.
ORIGIN = (490.0, -1005.0)
_AZ = math.radians(205)
R = (-math.sin(_AZ), math.cos(_AZ))
F = (-math.cos(_AZ), -math.sin(_AZ))


def at(right, depth):
    return (ORIGIN[0] + right * R[0] + depth * F[0], ORIGIN[1] + right * R[1] + depth * F[1])


# Hat yereli: +X akış yönü (ayıklama → makine → lif); sağa giderken 35° kameraya döner, böylece çıkış oluğu ve
# lif yığını öne gelir. −Y kameraya bakan yüz; z zeminden. Hat çuvalın 1,5 m gerisinde: daha önde iken kasa
# sehpası ve bant ayakları 3. bölümün son karelerine giriyordu (mobilde 134 kamera ışını).
LINE_AT = at(2600.0, 1500.0)
LINE_ROT = math.atan2(R[1], R[0]) - math.radians(35)
BELT_W, BELT_Z, BELT_TOP = 700.0, 850.0, 1230.0  # bant eni; ayıklama yüksekliği; besleme ucundaki yükseklik
BELT_X = (-3650.0, -2050.0, -900.0)  # bandın başı, eğimin başladığı yer, besleme ucu
BODY = (1300.0, 1100.0, 150.0, 1300.0)  # gövde boyu (X), eni (Y), alt ve üst z
CHUTE = ((650.0, 330.0, 450.0, 800.0), (1050.0, 360.0, 270.0, 600.0))  # oluk kesiti: x, yarı en, alt z, üst z
# Kasa bant kenarına yakın (rayla arası ~70 mm) ve ayıklama kısmının gerisinde: önde iken sehpa ayağı 3. bölümün
# mobil son karelerine giriyordu.
CRATE_AT, CRATE, STAND_H = (-3150.0, -700.0), (600.0, 400.0, 320.0), 430.0
PILE_AT, PILE_R, PILE_H = (1550.0, 30.0), 700.0, 520.0
# Açılmış karışık lif: kumaştan açıktır (boyasız lif özü görünür). Topaklar mavi-gri melanj (çuvalın çoğu denim);
# içinde çuvaldaki her kumaşın renginden lif benekleri (6. bölüm: levhanın her lekesi bir kaynaktan). İpek
# ayrıldığı için ipek renkleri yok.
FIBRE_TONES = ["Salvia Blue", "Deep Violet / Plumbeous", "Olympic Blue", "Salvia Blue", "Deep Violet / Plumbeous",
               "Warm Gray"]
FIBRE = sorted({spec[0] for spec in scraps.FABRICS.values()})
FLECK, FLECK_SHARE = 25.0, 0.22  # benek hücresi (mm) ve benekli hücre payı


def world(x, y):
    return _world(LINE_AT, LINE_ROT, x, y)


def local(x, y):
    return _local(LINE_AT, LINE_ROT, x, y)


def _root(name, objs):
    root = lib.empty(name, (LINE_AT[0], LINE_AT[1], FLOOR))
    root.rotation_euler = (0.0, 0.0, LINE_ROT)
    for o in objs:
        o.parent = root
    return root


def _bevel(o, width, segments=3):
    bv = o.modifiers.new("Bevel", "BEVEL")
    bv.width = width
    bv.segments = segments
    bv.limit_method = "ANGLE"
    bv.harden_normals = True
    for p in o.data.polygons:
        p.use_smooth = True
    return o


def _open_box(name, size, loc, mat, wall, open_face="top", bevel=2.0):
    """İnce cidarlı kutu (kasa, davlumbaz); open_face tarafı açık. Cidar içe doğru kalınlaşır."""
    w, d, h = size
    x, y, z = loc
    V = [(x + sx * w / 2, y + sy * d / 2, z + sz * h / 2) for sz in (-1, 1) for sy in (-1, 1) for sx in (-1, 1)]
    faces = {"bottom": (0, 2, 3, 1), "top": (4, 5, 7, 6), "-y": (0, 1, 5, 4), "+y": (2, 6, 7, 3),
             "-x": (0, 4, 6, 2), "+x": (1, 3, 7, 5)}
    o = lib.mesh_from(name, V, [f for k, f in faces.items() if k != open_face], mat, smooth_shade=False)
    so = o.modifiers.new("Solid", "SOLIDIFY")
    so.thickness = wall
    so.offset = -1.0
    return _bevel(o, bevel)


def materials():
    return {
        "paint": lib.plastic("MachinePaint", "Andover Green", rough=0.42, wear=0.35, scale=0.004),
        "guard": lib.plastic("GuardPaint", "Orange Yellow", rough=0.45, wear=0.4, scale=0.006),
        "frame": lib.plastic("LineFrame", "Slate Color", rough=0.42, wear=0.3, scale=0.006),
        "motor": lib.plastic("MotorPaint", "Dark Medici Blue", rough=0.38, wear=0.25, scale=0.01),
        "galv": lib.steel("Galvanised", "Neutral Gray", rough=0.42, brushed=False),
        "steel": lib.steel("LineSteel", "Neutral Gray", rough=0.3, brushed=True, scale=0.02),
        "rubber": lib.plastic("BeltRubber", "Black", rough=0.72, wear=0.3, scale=0.02),
        "crate": lib.plastic("Crate", "Neutral Gray", rough=0.55, wear=0.3, scale=0.01),
        "box": lib.plastic("ControlBox", "Mineral Gray", rough=0.5, wear=0.2, scale=0.01),
        "red": lib.plastic("Estop", "Spectrum Red", rough=0.3),
        "lamp": lib.plastic("PilotLamp", "Green", rough=0.2),
        "black": lib.plastic("Grille", "Black", rough=0.6),
    }


# --- Bant ---

def belt_z(x):
    """Bant üst yüzünün yüksekliği: düz ayıklama kısmı, ~500 mm'lik yumuşak bükümle eğimli besleme kısmı."""
    x0, xb, x1 = BELT_X
    slope = (BELT_TOP - BELT_Z) / (x1 - xb)
    r = 250.0
    x = np.asarray(x, float)
    mid = slope * (x - (xb - r)) ** 2 / (4 * r)
    return BELT_Z + np.where(x < xb - r, 0.0, np.where(x > xb + r, slope * (x - xb), mid))


def _sweep(name, xs, section, mat):
    """Bant yolu boyunca kesit süpürür; section [(y, h)] kapalı çokgen, h yolun normali boyunca (yukarı +)."""
    zs = belt_z(xs)
    dz = np.gradient(zs, xs)
    nl = np.hypot(1.0, dz)
    V = [(x - d / l * h, y, z + h / l) for x, z, d, l in zip(xs, zs, dz, nl) for y, h in section]
    m = len(section)
    F = [(i * m + k, i * m + (k + 1) % m, (i + 1) * m + (k + 1) % m, (i + 1) * m + k)
         for i in range(len(xs) - 1) for k in range(m)]
    F += [tuple(range(m))[::-1], tuple((len(xs) - 1) * m + k for k in range(m))]
    return lib.mesh_from(name, V, F, mat, smooth_shade=False)


def conveyor(mats):
    x0, xb, x1 = BELT_X
    xs = np.concatenate([np.linspace(x0, xb - 300, 4), np.linspace(xb - 250, xb + 250, 24), np.linspace(xb + 300, x1, 6)])
    hw = BELT_W / 2
    objs = [_sweep("Belt", xs, [(-hw, -8), (hw, -8), (hw, 0), (-hw, 0)], mats["rubber"]),
            _sweep("BeltReturn", xs, [(-hw, -112), (hw, -112), (hw, -104), (-hw, -104)], mats["rubber"])]
    # Yan profiller: dışa açık C kesit; üst kenarı bandın 35 mm üstünde, kırpıntı dökülmesin.
    for s in (-1, 1):
        yi = s * (hw + 20)
        yo, yf = yi + s * 6, yi + s * 56
        sec = [(yi, 35), (yf, 35), (yf, 29), (yo, 29), (yo, -124), (yf, -124), (yf, -130), (yi, -130)]
        if s > 0:
            sec = sec[::-1]
        objs.append(_bevel(_sweep("Rail", xs, sec, mats["frame"]), 1.5))
    # Uç tamburları: bant dönüşü.
    for x in (x0, x1):
        z = float(belt_z(x))
        objs.append(lib.cylinder("Drum", 56, BELT_W, (x, 0, z - 56), mats["rubber"], rot=(90, 0, 0), verts=48))
        objs.append(lib.cylinder("Axle", 16, BELT_W + 150, (x, 0, z - 56), mats["steel"], rot=(90, 0, 0), verts=24))
    # Ayaklar ve çapraz kuşaklar.
    for x in (-3500.0, -2800.0, -2150.0, -1500.0):
        top = float(belt_z(x)) - 130
        for s in (-1, 1):
            y = s * (hw + 50)
            objs.append(lib.box("Leg", (50, 50, top), (x, y, top / 2), mats["frame"], bevel=2.0))
            objs.append(lib.box("Foot", (110, 110, 8), (x, y, 4), mats["frame"], bevel=1.5))
        objs.append(lib.box("Brace", (40, BELT_W + 100, 40), (x, 0, 240), mats["frame"], bevel=1.5))
    return objs


def _scrap_material(k, fab):
    warp, weft, twill, pitch, _ = scraps.spec(fab)
    if fab in scraps.SILK:  # bant uzakta: masadaki parıltı burada plastik gibi okunuyordu
        return lib.satin(f"Silk_{fab}_{k}", warp, rough=0.34)
    # Hav kendi renginde: beyaz hav sıyırma açısında denimi leylak griye, keteni naylon torbaya çekiyordu.
    # Uzakta dokuma seçilmez, ortalama renk kalır. Denimde kalın çözgü ince atkıyı neredeyse örter; desendeki
    # %33 ekru doğrusal ışıkta laciverti leylak griye (#6a6b8a) çekiyordu. Bu uzaklıkta yüz rengi çözgüdür.
    if fab.startswith("denim"):
        weft = warp
    return lib.fabric(f"Line_{fab}_{k}", warp, weft, pitch=pitch, twill=twill, fuzz=0.7, var=0.14, bump=0.5,
                      sheen=warp)


def _field_over(x0, y0, x1, y1, h):
    """Hat yerelindeki dikdörtgeni örten, dünya eksenli yükseklik alanı."""
    P = [world(x, y) for x in (x0, x1) for y in (y0, y1)]
    xs, ys = [p[0] for p in P], [p[1] for p in P]
    region = (min(xs), min(ys), max(xs), max(ys))
    return scraps.Field(*region, h=h), region


BED_X = (BELT_X[0] + 60, -960.0)  # yükün başı ve sonu (sonu besleme davlumbazının içinde)


def belt_bed(seed=29):
    """Bandın yükü: tümsekli, kenarları dalgalı bir kumaş katmanı; besleme ucuna doğru incelir. Boş koyu bantta
    seyrek kırpıntı konfeti gibi okunuyordu. Döner: üstüne kırpıntı serilecek yükseklik alanı ve bölgesi."""
    xa, xe = BED_X
    f, region = _field_over(xa, -BELT_W / 2, xe, BELT_W / 2, 4.0)
    lx, ly = local(f.X, f.Y)
    base = FLOOR + belt_z(np.clip(lx, BELT_X[0], BELT_X[2]))
    rs = np.random.default_rng(seed)
    edge = BELT_W / 2 - 55 + 25 * np.sin(lx / 170 + 0.7) + 15 * np.sin(lx / 61 + 2.1)
    t = np.clip((lx - xa) / 120, 0, 1) * np.clip((xe - lx) / 60, 0, 1)
    inside = (np.abs(ly) < edge) & (t > 0)
    lump = np.zeros_like(lx)
    for _ in range(70):
        bx, by = rs.uniform(xa, xe), rs.uniform(-0.8, 0.8) * BELT_W / 2
        s = rs.uniform(50, 150)
        lump += rs.uniform(8, 30) * np.exp(-((lx - bx) ** 2 + (ly - by) ** 2) / (2 * s * s))
    taper = np.clip(1 - (lx - BELT_X[1]) / 1600, 0.45, 1)  # eğimde yük seyrelir
    fall = np.clip((edge - np.abs(ly)) / 60, 0, 1) ** 0.5
    thick = (10 + lump) * taper * fall * t
    f.H = np.where(inside, base + thick, base)
    # Ağın sınırı kalınlığın sıfırlandığı yerin bir hücre dışında: sınır bandın altında kalır (eşikle kesilince
    # kenar basamak basamak görünüyordu).
    keep = (np.abs(ly) < edge + 2 * f.h) & (t > 0)
    idx = -np.ones(keep.shape, int)
    idx[keep] = np.arange(int(keep.sum()))
    V = np.column_stack([f.X[keep], f.Y[keep], f.H[keep] - 1.0])
    q = keep[:-1, :-1] & keep[:-1, 1:] & keep[1:, 1:] & keep[1:, :-1]
    j, i = np.nonzero(q)
    Fc = np.column_stack([idx[j, i], idx[j, i + 1], idx[j + 1, i + 1], idx[j + 1, i]])
    # Kırpıntıların arasından görünen alt katlar: gölgede, koyu ve çoğu denim (açık ve alaca tonda taş döşeme gibi
    # okunuyordu).
    D = [scraps.FABRICS["denim"][0], scraps.FABRICS["denim_dark"][0]]
    cols = D * 4 + [scraps.FABRICS["olive"][0]]
    lib.mesh_from("BeltBed", [tuple(p) for p in V], [tuple(x) for x in Fc],
                  lib.scrap_mass("BeltBed", cols, cell=180.0, dark=0.14, sheen=D[1]))
    return f, region


def belt_scraps(f, region, seed=31):
    """Yükün üstünde kırpıntılar; aralarında henüz ayrılmamış iki ipek parçası. Parçalar üst üste biner."""
    xa, xe = BED_X
    placed = []

    def inside(c, Wp):
        lx, ly = local(Wp[:, 0], Wp[:, 1])
        if np.any(np.abs(ly) > BELT_W / 2 - 25) or np.any(lx < xa) or np.any(lx > xe - 150):
            return False
        if placed and min(math.hypot(c[0] - p[0], c[1] - p[1]) for p in placed) < 55:
            return False
        placed.append(c)
        return True

    # Yarısı denim (çuvalın çoğu gibi); toprak tonları seyrek, ipek iki parça, ayıklanmayı bekliyor. Her parçası
    # başka renkte yük alaca bir mozaik gibi okunuyordu.
    order = ["denim", "denim_dark", "canvas", "denim", "silk_teal", "sienna", "denim_dark", "denim", "olive",
             "denim_dark", "ochre_red", "denim", "canvas", "denim_dark", "silk_red", "denim", "ocher", "denim_dark",
             "sienna", "denim", "olive", "denim_dark", "cinnamon", "denim", "canvas", "denim_dark", "ochre_red",
             "denim", "ivory", "denim_dark"]
    order += [c for c in order[:14] if c not in scraps.SILK]
    return scraps.heap(seed, f, region, len(order), sizes=(240, 400), spread=(1400, 1400), mesh_step=3.0,
                       crumple=1.0, relief=4.0, accept=inside, order=order, material=_scrap_material,
                       drape=(0.16, (10.0, 26.0), (3, 6)))


# --- İpek kasası ---

def crate(mats):
    w, d, h = CRATE
    cx, cy = CRATE_AT
    objs = [lib.box("StandTop", (w + 40, d + 40, 30), (cx, cy, STAND_H - 15), mats["frame"], bevel=3.0)]
    for sx in (-1, 1):
        for sy in (-1, 1):
            objs.append(lib.box("StandLeg", (40, 40, STAND_H - 30),
                                (cx + sx * (w / 2 - 10), cy + sy * (d / 2 - 10), (STAND_H - 30) / 2), mats["frame"],
                                bevel=2.0))
    objs.append(_open_box("Crate", (w, d, h), (cx, cy, STAND_H + h / 2), mats["crate"], wall=6.0, bevel=2.5))
    # Kasa ağzının altında taşıma kolu yarıkları: kısa kenarlarda koyu dikdörtgen.
    for sx in (-1, 1):
        objs.append(lib.box("CrateGrip", (2, 120, 34), (cx + sx * (w / 2 + 0.5), cy, STAND_H + h - 45), mats["black"]))
    _root("CrateRoot", objs)
    return objs


def silk_heap(seed=37):
    """Kasadaki ipek: ortası kabarık, kenarda ağzın biraz altında."""
    w, d, h = CRATE
    cx, cy = CRATE_AT
    iw, idp = w / 2 - 8, d / 2 - 8
    f, region = _field_over(cx - iw, cy - idp, cx + iw, cy + idp, 2.0)
    lx, ly = local(f.X, f.Y)
    u, v = (lx - cx) / iw, (ly - cy) / idp
    inside = (np.abs(u) < 1) & (np.abs(v) < 1)
    dome = np.clip(1 - u ** 2, 0, 1) * np.clip(1 - v ** 2, 0, 1)
    floor_z = FLOOR + STAND_H + 6
    f.H = np.where(inside, floor_z + 200 + 70 * dome, floor_z)
    keep = inside & (np.abs(u) < 0.985) & (np.abs(v) < 0.985)
    idx = -np.ones(keep.shape, int)
    idx[keep] = np.arange(int(keep.sum()))
    V = np.column_stack([f.X[keep], f.Y[keep], f.H[keep] - 2.0])
    q = keep[:-1, :-1] & keep[:-1, 1:] & keep[1:, 1:] & keep[1:, :-1]
    j, i = np.nonzero(q)
    Fc = np.column_stack([idx[j, i], idx[j, i + 1], idx[j + 1, i + 1], idx[j + 1, i]])
    silk = sorted({c[0] for c in scraps.SILK.values()})
    lib.mesh_from("SilkBed", [tuple(p) for p in V], [tuple(x) for x in Fc], lib.scrap_mass("SilkBed", silk, cell=90.0))
    placed = []

    def ok(c, Wp):
        a, b = local(Wp[:, 0], Wp[:, 1])
        if np.any(np.abs(a - cx) > iw * 1.02) or np.any(np.abs(b - cy) > idp * 1.02):
            return False
        if placed and min(math.hypot(c[0] - p[0], c[1] - p[1]) for p in placed) < 70:
            return False
        placed.append(c)
        return True

    order = ["silk_red", "silk_teal", "silk_gold", "silk_violet", "silk_ivory", "silk_green", "silk_red",
             "silk_teal", "silk_violet", "silk_gold", "silk_green"]
    return scraps.heap(seed, f, region, len(order), sizes=(130, 260), spread=(500, 500), mesh_step=2.0, crumple=2.0,
                       accept=ok, order=order, material=_scrap_material)


# --- Yırtma makinesi ---

def _hull(points):
    """Düzlemde dışbükey örtü (CCW)."""
    P = sorted(set(points))

    def half(seq):
        out = []
        for p in seq:
            while len(out) >= 2 and ((out[-1][0] - out[-2][0]) * (p[1] - out[-2][1])
                                     - (out[-1][1] - out[-2][1]) * (p[0] - out[-2][0])) <= 0:
                out.pop()
            out.append(p)
        return out

    lo, hi = half(P), half(P[::-1])
    return lo[:-1] + hi[:-1]


def machine(mats):
    L, Wd, z0, z1 = BODY
    p, fr, mo, st = mats["paint"], mats["frame"], mats["motor"], mats["steel"]
    objs = []
    for s in (-1, 1):
        objs.append(lib.box("Skid", (1900, 120, 150), (0, s * 470, 75), fr, bevel=4.0))
    for x in (-850, 0, 850):
        objs.append(lib.box("SkidCross", (100, 820, 120), (x, 0, 70), fr, bevel=3.0))
    objs.append(lib.box("Body", (L, Wd, z1 - z0), (0, 0, (z0 + z1) / 2), p, bevel=10.0))
    objs.append(lib.box("Cover", (L + 40, Wd + 40, 70), (0, 0, z1 + 35), p, bevel=14.0))
    # Üst kapak: menteşeli bakım kapağı ve iki kulp.
    hz = z1 + 70
    objs.append(lib.box("Hatch", (520, 420, 24), (180, 60, hz + 12), p, bevel=6.0))
    for x in (-20, 380):
        objs.append(lib.cylinder("HatchGrip", 9, 120, (x, 60, hz + 24 + 26), st, rot=(90, 0, 0), verts=24))
        for y in (10, 110):
            objs.append(lib.cylinder("GripPost", 8, 26, (x, y, hz + 24 + 13), st, verts=16))
    # Kameraya bakan yüzde servis kapağı: kulp, menteşe, kenarında cıvatalar.
    fy = -Wd / 2
    objs.append(lib.box("Door", (640, 14, 620), (-260, fy - 7, 690), p, bevel=5.0))
    objs.append(lib.cylinder("DoorGrip", 10, 150, (-530, fy - 44, 690), st, verts=24))
    for z in (640, 740):
        objs.append(lib.cylinder("DoorGripPost", 8, 30, (-530, fy - 29, z), st, rot=(90, 0, 0), verts=16))
    for z in (430, 690, 950):
        objs.append(lib.cylinder("Hinge", 13, 80, (62, fy - 20, z), st, verts=24))
    for k in range(9):
        x = -L / 2 + 40 + k * (L - 80) / 8
        objs.append(lib.cylinder("Bolt", 9, 8, (x, fy - 4, z1 - 30), st, rot=(90, 0, 0), verts=12))
    # Kayış muhafazası (sarı): tambur ve motor kasnağını örter; motor dışarıda, ayaklı tabanında.
    c1, r1, c2, r2 = (300.0, 820.0), 170.0, (470.0, 330.0), 115.0
    ring = [(c[0] + r * math.cos(a), c[1] + r * math.sin(a)) for c, r in ((c1, r1), (c2, r2))
            for a in np.linspace(0, TAU, 48, endpoint=False)]
    guard = scraps._slab("Guard", _hull([(round(x, 3), round(y, 3)) for x, y in ring]), 150, mats["guard"], bevel=6.0)
    guard.rotation_euler = (math.radians(90), 0.0, 0.0)
    guard.location = (0.0, fy - 12, 0.0)
    objs.append(guard)
    gy = fy - 162
    for c, r in ((c1, r1 - 40), (c2, r2 - 35)):
        for a in np.linspace(0.3, TAU + 0.3, 6, endpoint=False):
            objs.append(lib.cylinder("GuardBolt", 8, 8, (c[0] + r * math.cos(a), gy - 3, c[1] + r * math.sin(a)), st,
                                     rot=(90, 0, 0), verts=12))
    my, mz, mr = gy - 210, c2[1], 160.0
    objs.append(lib.cylinder("Motor", mr, 400, (c2[0], my, mz), mo, rot=(90, 0, 0), verts=64, bevel=4.0))
    for k in range(24):
        a = k * TAU / 24
        if 4.0 < a < 5.5:  # ayakların olduğu alt kısımda kanat yok
            continue
        objs.append(lib.box("Fin", (5, 360, 18), (c2[0] + (mr + 8) * math.cos(a), my, mz + (mr + 8) * math.sin(a)),
                            mo, rot=(0, 90 - math.degrees(a), 0)))
    objs.append(lib.cylinder("FanCover", mr + 12, 130, (c2[0], my - 265, mz), mo, rot=(90, 0, 0), verts=64, bevel=5.0))
    objs.append(lib.cylinder("FanGrille", mr - 25, 4, (c2[0], my - 331, mz), mats["black"], rot=(90, 0, 0), verts=48))
    # Ayak tabandan gövdenin yarı yüksekliğine çıkar (eskiden tabanın 90 mm üstünde asılı kalıyordu).
    foot_top = mz - mr * 0.5
    objs.append(lib.box("MotorFeet", (300, 340, foot_top - 40), (c2[0], my, (foot_top + 40) / 2), fr, bevel=4.0))
    objs.append(lib.box("MotorBase", (520, 600, 40), (c2[0], my + 20, 20), fr, bevel=4.0))
    objs.append(lib.box("TerminalBox", (150, 150, 100), (c2[0], my + 40, mz + mr + 40), mo, bevel=5.0))
    # Besleme davlumbazı: bant buradan makineye girer; ağzı açık, içi karanlık.
    objs.append(_open_box("FeedHood", (300, 900, 430), (-L / 2 - 150, 0, z1 - 215), p, wall=4.0, open_face="-x",
                          bevel=3.0))
    # Çıkış oluğu: dört sac, alçalarak genişler.
    (xa, wa, ba, ta), (xb, wb, bb, tb) = CHUTE
    V = [(xa, -wa, ba), (xa, wa, ba), (xa, wa, ta), (xa, -wa, ta), (xb, -wb, bb), (xb, wb, bb), (xb, wb, tb), (xb, -wb, tb)]
    chute = lib.mesh_from("Chute", V, [(0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)], mats["galv"],
                          smooth_shade=False)
    so = chute.modifiers.new("Solid", "SOLIDIFY")
    so.thickness = 3.0
    objs.append(_bevel(chute, 1.5))
    # Kumanda kutusu: direk üstünde; acil durdurma ve iki ışık, yazısız.
    px, py = -950.0, -800.0  # besleme ağzının önünde; daha solda iken direk 3. bölümün kadrajına giriyordu
    objs.append(lib.box("Post", (60, 60, 1250), (px, py, 625), fr, bevel=2.0))
    objs.append(lib.box("Plate", (180, 180, 10), (px, py, 5), fr, bevel=1.5))
    objs.append(lib.box("ControlBox", (360, 220, 460), (px, py - 20, 1400), mats["box"], bevel=8.0))
    fz = py - 130
    objs.append(lib.cylinder("EstopCollar", 40, 6, (px + 90, fz - 3, 1480), mats["guard"], rot=(90, 0, 0), verts=32))
    objs.append(lib.cylinder("Estop", 27, 26, (px + 90, fz - 19, 1480), mats["red"], rot=(90, 0, 0), verts=32,
                             bevel=4.0))
    for x in (-110, -40):
        objs.append(lib.cylinder("Lamp", 12, 14, (px + x, fz - 7, 1500), mats["lamp"], rot=(90, 0, 0), verts=24))
    _root("MachineRoot", objs)
    # Kablo kanalı: kutunun altından direk boyunca zemine, oradan motora.
    pts = [(px + 60, py - 20, 1170), (px + 70, py - 10, 900), (px + 70, py - 5, 120), (px + 140, py + 10, 30),
           (c2[0] - 300, my + 120, 30), (c2[0] - 40, my + 60, mz + mr + 40)]
    P = np.array([(*world(x, y), FLOOR + z) for x, y, z in pts])
    lib.curves("Conduit", [(_smooth_path(P, 60), np.full(60, 11.0))], mats["rubber"])
    return objs


def _smooth_path(P, n):
    """Kontrol noktalarından yumuşak eğri (Catmull-Rom)."""
    P = np.vstack([P[0], P, P[-1]])
    out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for t in np.linspace(0, 1, n // (len(P) - 3) + 1)[:-1]:
            out.append(0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t ** 2
                              + (3 * p1 - p0 - 3 * p2 + p3) * t ** 3))
    out.append(P[-2])
    out = np.array(out)
    return out[np.linspace(0, len(out) - 1, n).round().astype(int)]


# --- Lif yığını ---

SQUASH = 0.85  # topaklar kendi ağırlığıyla biraz basıktır


def _footprint(dx, dy):
    """Yığının taban sınırına göre uzaklık (1 kenar) ve gövde zarfının yüksekliği; hat yereli, yığın merkezli."""
    ang = np.arctan2(dy, dx)
    rad = PILE_R * (1 + 0.11 * np.sin(3 * ang + 1.3) + 0.07 * np.sin(5 * ang + 0.4))
    rho = np.hypot(dx / 1.2, dy) / rad
    dome = np.clip(1 - rho ** 2, 0, None) ** 0.7
    tilt = np.clip(1 - (dx + 650) / 1700, 0.35, 1.0)  # oluk tarafı yüksek
    return rho, PILE_H * dome * tilt


class Ball:
    """Bir lif topağı: basık, yüzeyi birkaç dalgayla bozulmuş küre. tone: renk seçimi (0–1)."""

    def __init__(self, rs, c, r, tone):
        self.c, self.r, self.tone = np.asarray(c, float), r, tone
        # Düzgün küre çakıl taşı gibi okunuyordu: altı dalga, daha derin ve sık.
        self.n = rs.normal(0, 1, (6, 3))
        self.n /= np.linalg.norm(self.n, axis=1, keepdims=True)
        self.k = rs.uniform(2.5, 7.0, 6)
        self.a = rs.uniform(0.04, 0.12, 6)
        self.ph = rs.uniform(0, TAU, 6)

    def surface(self, d):
        """Birim yönlerden (m, 3) yüzey noktaları."""
        s = 1 + (self.a * np.sin(d @ self.n.T * self.k + self.ph)).sum(1)
        return self.c + d * (self.r * s)[:, None] * (1.0, 1.0, SQUASH)


def pile_field():
    """Zarfın yükseklik alanı (dünya koordinatı): topakların oturduğu yüzey ve yönü."""
    cx, cy = world(*PILE_AT)
    span = PILE_R * 1.3
    f = scraps.Field(cx - span, cy - span, cx + span, cy + span, h=8.0)
    lx, ly = local(f.X, f.Y)
    f.rho, env = _footprint(lx - PILE_AT[0], ly - PILE_AT[1])
    f.H = FLOOR + np.where(f.rho < 1, env, -4.0)
    return f


def pile_balls(f, seed=21, count=300):
    """Açılmış lif kum gibi akıp düz yamaç yapmaz; pamuk gibi topak topak kabarır (düz zarfla yığın kum tepesine,
    yükseklik alanındaki yarım kürelerle dik duvarlı bloklara benziyordu). Zarfın yüzeyine iri topaklar gömülür,
    her irinin dış yüzüne küçükler: karnabahar gibi iki ölçek. Küçükler çoğunlukla irinin tonunu alır."""
    rs = np.random.default_rng(seed)
    gy, gx = np.gradient(f.H, f.h)
    balls = []
    placed = 0
    while placed < count:
        bx, by = rs.uniform(-1.25, 1.25) * PILE_R, rs.uniform(-1.05, 1.05) * PILE_R
        rho, _ = _footprint(bx, by)
        # Son çeyrek kenar halkası: zarf orada alçak, topaklar seyrek kalınca içteki zarf kum gibi görünüyordu.
        if rho > 0.98 or (placed >= count * 3 // 4 and rho < 0.75):
            continue
        wx, wy = world(PILE_AT[0] + bx, PILE_AT[1] + by)
        n = np.array([-f.sample(gx, wx, wy), -f.sample(gy, wx, wy), 1.0])
        n /= np.linalg.norm(n)
        p = np.array([wx, wy, f.sample(f.H, wx, wy)])
        r = 40.0 * (140.0 / 40.0) ** rs.random()
        big = Ball(rs, p + n * r * (rs.uniform(0.15, 0.45) - 1), r, rs.random())
        balls.append(big)
        placed += 1
        for _ in range(int(rs.integers(1, 5))):
            d = n + rs.normal(0, 0.9, 3)
            d /= np.linalg.norm(d)
            if d[2] < -0.15:
                continue
            s = r * rs.uniform(0.18, 0.45)
            q = big.surface(d[None])[0]
            tone = big.tone if rs.random() < 0.8 else rs.random()
            balls.append(Ball(rs, q + d * s * (rs.uniform(0.25, 0.55) - 1), s, tone))
    # Tamamen zeminin altında kalanlar atılır.
    return [b for b in balls if b.c[2] + b.r * SQUASH > FLOOR + 2]


def _ico(sub):
    import bmesh

    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=1.0)
    V = np.array([v.co[:] for v in bm.verts])
    F = np.array([[v.index for v in fc.verts] for fc in bm.faces])
    bm.free()
    return V, F


def pile_mesh(f, balls):
    """Topaklar ve aralarından görünebilecek zarf (biraz içeride) tek nesnede; `clump` köşe niteliği tonu taşır."""
    ico = {3: _ico(3), 2: _ico(2)}
    Vs, Fs, Ts = [], [], []
    off = 0
    for b in balls:
        U, Fi = ico[3 if b.r > 35 else 2]
        Vs.append(b.surface(U))
        Fs.append(Fi + off)
        Ts.append(np.full(len(U), b.tone))
        off += len(U)
    keep = f.rho < 1.0
    idx = -np.ones(keep.shape, int)
    idx[keep] = off + np.arange(int(keep.sum()))
    # Kenarda zeminin altına iner: yoksa topakların dışında düz bir etek gibi görünüyordu.
    Vs.append(np.column_stack([f.X[keep], f.Y[keep], FLOOR + (f.H[keep] - FLOOR) * 0.75 - 25.0]))
    q = keep[:-1, :-1] & keep[:-1, 1:] & keep[1:, 1:] & keep[1:, :-1]
    j, i = np.nonzero(q)
    core = np.column_stack([idx[j, i], idx[j, i + 1], idx[j + 1, i + 1], idx[j + 1, i]])
    Ts.append(np.full(int(keep.sum()), 0.15))
    V = np.concatenate(Vs)
    faces = [tuple(x) for F in Fs for x in F] + [tuple(x) for x in core]
    mat = lib.fibre_mass("FibrePile", FIBRE_TONES, FIBRE, size=30.0, density=0.35)
    o = lib.mesh_from("FibrePile", [tuple(p) for p in V], faces, mat)
    o.data.attributes.new("clump", "FLOAT", "POINT").data.foreach_set("value", np.concatenate(Ts).astype(np.float32))
    return o


def fibres(rs, roots, ups, per, length, radius, k=7, curl=0.55, spread=0.6, lift=0.35, jitter=2.5):
    """Tutam başına `per` kıvrık lif; kökler yüzeyin biraz içinden başlar. Döner: P (n, k, 3), R (n, k), yarn."""
    T = len(roots)
    N = T * per
    up = np.repeat(ups, per, 0)
    v = up + rs.normal(0, spread, (N, 3))
    v /= np.linalg.norm(v, axis=1, keepdims=True)
    step = rs.uniform(*length, N)[:, None] / (k - 1)
    P = np.empty((N, k, 3))
    P[:, 0] = np.repeat(roots, per, 0) + rs.normal(0, jitter, (N, 3)) - up * 2.0
    for i in range(1, k):
        v = v + rs.normal(0, curl, (N, 3)) + up * lift
        v /= np.linalg.norm(v, axis=1, keepdims=True)
        P[:, i] = P[:, i - 1] + v * step
    Rr = radius * np.linspace(1.0, 0.45, k)[None, :] * rs.uniform(0.7, 1.3, (N, 1))
    return P, Rr, np.repeat(rs.random(T), per)


def fibre_colour(roots, tone):
    """Tutam rengi (`yarn`, 0–1, FIBRE_TONES + FIBRE listesinde dilim ortası): FLECK mm'lik hücrelerin FLECK_SHARE
    kadarı bir kaynak kumaşın renginde, kalanı topağın melanj tonunda. Tek tek lif piksel altında kalır; benek ancak
    aynı renkte lifler kümelenince görünür (rastgele renkle yığın düz pembe-bej okunuyordu)."""
    cell = np.floor(roots / FLECK).astype(np.int64)
    h = ((cell[:, 0] * 73856093) ^ (cell[:, 1] * 19349663) ^ (cell[:, 2] * 83492791)) & 0x7FFFFFFF
    fleck = (h % 10007) / 10007 < FLECK_SHARE
    nt = len(FIBRE_TONES)
    idx = np.where(fleck, nt + (h // 10007) % len(FIBRE), np.minimum((tone * nt).astype(int), nt - 1))
    return (idx + 0.5) / (nt + len(FIBRE))


def fluff(balls, seed=23, tufts=160000, air=320, ground=240):
    """Topakların yüzündeki tutamlar, oluk ağzından savrulan ve yere düşmüş lifler."""
    rs = np.random.default_rng(seed)
    w = np.array([b.r ** 2 for b in balls])
    pick = rs.choice(len(balls), tufts, p=w / w.sum())
    roots, ups, tones = [], [], []
    for bi in np.unique(pick):
        # Alt yüzler gömülü; yan yüzler de kameraya döner (tüysüz kalınca taş gibi parlıyordu).
        d = rs.normal(0, 1, (int((pick == bi).sum()), 3)) + (0.0, 0.0, 0.3)
        d /= np.linalg.norm(d, axis=1, keepdims=True)
        roots.append(balls[bi].surface(d))
        n = d / (1.0, 1.0, SQUASH)
        ups.append(n / np.linalg.norm(n, axis=1, keepdims=True))
        tones.append(np.full(len(d), balls[bi].tone))
    roots, ups, tones = np.concatenate(roots), np.concatenate(ups), np.concatenate(tones)
    keep = roots[:, 2] > FLOOR + 2
    roots, ups, tones = roots[keep], ups[keep], tones[keep]
    # Sık ve yatık tüy: topak kenarlarını yumuşatır (seyrek dik tutamla topaklar sert hatlı taş gibi kalıyordu).
    per = 6
    P, Rr, _ = fibres(rs, roots, ups, per, (25, 75), 0.09, spread=0.8, lift=0.2)
    parts = [(P, Rr, np.repeat(fibre_colour(roots, tones), per))]
    # Havada: oluk ağzından yığına doğru savrulan tutamlar; ağza yakın sık, uzaklaştıkça seyrek ve geniş.
    s = rs.random(air) ** 1.6
    (xa, _, ba, ta), (xb, _, bb, tb) = CHUTE
    lx = xb + 40 + s * 650 + rs.normal(0, 60, air)
    ly = rs.normal(0, 140 + 220 * s, air)
    lz = (bb + tb) / 2 + 40 - s * 260 + 320 * s * (1 - s) + rs.normal(0, 70 + 90 * s, air)
    wx, wy = world(lx, ly)
    c = np.column_stack([wx, wy, FLOOR + np.maximum(lz, 30)])
    d = rs.normal(0, 1, (air, 3))
    d /= np.linalg.norm(d, axis=1, keepdims=True)
    P, Rr, _ = fibres(rs, c, d, 14, (8, 34), 0.12, curl=0.8, spread=1.2, lift=0.0, jitter=6.0)
    parts.append((P, Rr, np.repeat(fibre_colour(c, rs.random(air)), 14)))
    # Zeminde: yığının çevresine düşmüş seyrek tutamlar, yatık.
    a = rs.uniform(0, TAU, ground)
    r = PILE_R * rs.uniform(0.95, 1.9, ground)
    gx2, gy2 = world(PILE_AT[0] + 1.2 * r * np.cos(a), PILE_AT[1] + r * np.sin(a))
    c = np.column_stack([gx2, gy2, np.full(ground, FLOOR + 3.0)])
    flat = np.column_stack([rs.normal(0, 1, ground), rs.normal(0, 1, ground), np.full(ground, 0.12)])
    flat /= np.linalg.norm(flat, axis=1, keepdims=True)
    P, Rr, _ = fibres(rs, c, flat, 6, (10, 40), 0.12, curl=0.45, spread=0.5, lift=0.0)
    P[..., 2] = np.maximum(P[..., 2], FLOOR + 0.4)
    parts.append((P, Rr, np.repeat(fibre_colour(c, rs.random(ground)), 6)))
    P = np.concatenate([p[0] for p in parts])
    Rr = np.concatenate([p[1] for p in parts])
    yarn = np.concatenate([p[2] for p in parts])
    # Renk tutam başına (yarn); lif başına sapma dilimi aşmasın diye küçük.
    mat = lib.fibre_hair("FibreFluff", FIBRE_TONES + FIBRE, rough=0.5, var=0.3, yarn_weight=0.97, streak=0.12)
    return lib.curves_array("FibreFluff", P, Rr, yarn, mat)


# --- Işık ---

# Tavan ışıkları: ad, hat yerelinde konum, boy, güç (W), yayılım (tam açı, °).
POOL_H = 3300.0
POOLS = (("PoolMachine", (500.0, -150.0), (2200.0, 1500.0), 8.0e7, 60.0),
         ("PoolSort", (-2850.0, -200.0), (1400.0, 900.0), 6.0e7, 50.0))


def lights():
    """İstasyonun ışık havuzları: dar açılı tavan ışıkları. 1.–3. bölümün üç ışığı istasyonda zayıf kalıyor
    (uzaklık ve açı); ölçeklerini büyütmek 3. bölümün son karesini düzleştiriyordu (SSIM 0,935). Her ışık çuvalın
    tersine yayılım açısının yarısı kadar eğilir: konisinin çuvala bakan kenarı dikey iner, ışık 3. bölümün
    kadrajına taşmaz (pnpm story:check)."""
    for name, (x, y), size, power, spread in POOLS:
        cx, cy = world(x, y)
        ax, ay = cx - ORIGIN[0], cy - ORIGIN[1]
        k = POOL_H * math.tan(math.radians(spread / 2)) / math.hypot(ax, ay)
        lib.area_light((cx, cy, FLOOR + POOL_H), (cx + ax * k, cy + ay * k, FLOOR), size=size[0], size_y=size[1],
                       power=power, color="Sulpher Yellow", spread=spread, name=name)
    # Yığının arkasından: lif saçağı ışığı geçirir, kenarı yanar (1. bölümdeki tek lifin arka ışığı gibi).
    cx, cy = world(*PILE_AT)
    lib.area_light((cx + 1700 * F[0], cy + 1700 * F[1], FLOOR + 1100), (cx, cy, FLOOR + 250), size=900, power=1.9e7,
                   color="Nile Blue", spread=90, name="PoolRim")


def station():
    """Ayıklama ve parçalama: bant, kasa, makine, lif yığını ve ışıklar."""
    mats = materials()
    _root("ConveyorRoot", conveyor(mats))
    belt_scraps(*belt_bed())
    crate(mats)
    silk_heap()
    machine(mats)
    f = pile_field()
    balls = pile_balls(f)
    pile_mesh(f, balls)
    fluff(balls)
    lights()
