# Bağlayıcı ve pres istasyonu (birim mm): parçalama hattının devamında, aynı atölyede. Besleme masasında sac
# üstünde açılmış lif keçesi, ortada çerçeve plakalı tek katlı sıcak pres, çıkış masasında preslenmiş benekli
# levha. Keçenin yanında iki bağlayıcı adayı durur: elyaf balyası (PET/CoPET) ve kapalı varil (pMDI). Reçete
# seçilmedi ve test edilmedi; ikisi de etiketsiz, hiçbiri öne çıkmaz (D-011). 1. bölümden beri sahnede durur;
# 1.–4. bölümün karelerine girmez, gölge düşürmez ve ışıkları o bölümlerde görünen yüzeye ulaşmaz (pnpm story:check).
import math

import numpy as np

import lib
import shredding as SH
from weighing import FLOOR

TAU = 2 * math.pi

# İstasyonun kökeni parçalama hattının yerelinde: hat +X boyunca sürer. 3. ve 4. bölümün kameraları x ≥ 7 m'yi
# hiçbir karede görmez (izdüşüm haritası, 3,3 m yüksekliğe kadar); masalar ve pres ±4,1 m sürer.
X0 = 11500.0
ROT = SH.LINE_ROT
# Yerel eksenler hattınkiyle aynı: +X akış, −Y kameraya bakan yüz, z zeminden.
ROLL_Z = 900.0  # masaların ve alt plakanın üst yüzü: sac kesintisiz kayar
TABLE_X = 1650.0, 4050.0  # masaların presin ekseninden iç ve dış ucu
TABLE_Y = 2050.0  # masa yarı boyu (Y)
PLATEN = (2200.0, 3900.0)  # ısıtıcı plaka (X, Y)
DAYLIGHT = 300.0  # plakalar arası açıklık
SHEET = (2000.0, 3860.0, 6.0)  # taşıyıcı sac
BOARD = (1830.0, 3660.0, 18.0)  # levha: 18 mm hedef, ölçülmüş değil (D-011)
MAT_H = 170.0  # keçenin presten önceki kalınlığı (kabarık)
PAIRS = (-1300.0, 0.0, 1300.0)  # çift çerçeve plakalarının ortası (Y); silindirler çiftin arasında
PLATE_T, PAIR_GAP = 70.0, 380.0
FRAME = (1500.0, 3300.0)  # plaka yarı eni ve boyu
WINDOW = (1150.0, 420.0, 2650.0)  # pencere yarı eni, alt ve üst z
CYL_X = (-550.0, 550.0)
BINDER_AT = (-2950.0, -2800.0)  # bağlayıcı adaylarının paleti (yerel)


def world(x, y):
    return SH.world(X0 + x, y)


def _root(name, objs):
    wx, wy = world(0.0, 0.0)
    root = lib.empty(name, (wx, wy, FLOOR))
    root.rotation_euler = (0.0, 0.0, ROT)
    for o in objs:
        o.parent = root
    return root


def materials():
    return {
        "frame": lib.plastic("PressFrame", "Vandar Poel's Blue", rough=0.4, wear=0.3, scale=0.004),
        "table": lib.plastic("PressTable", "Slate Color", rough=0.42, wear=0.3, scale=0.006),
        "guard": lib.plastic("PressGuard", "Orange Yellow", rough=0.45, wear=0.35, scale=0.006),
        "unit": lib.plastic("PressUnit", "Dark Medici Blue", rough=0.38, wear=0.25, scale=0.01),
        "box": lib.plastic("PressBox", "Mineral Gray", rough=0.5, wear=0.2, scale=0.01),
        # Isıtıcı plaka yağ ve ısıyla kararmış çelik; sac parlak hadde çeliği.
        "platen": lib.steel("Platen", "Deep Violet / Plumbeous", rough=0.38, brushed=True, scale=0.02),
        "sheet": lib.steel("CaulSheet", "Neutral Gray", rough=0.26, brushed=True, scale=0.02),
        "chrome": lib.steel("Rod", "White", rough=0.12, brushed=False),
        "galv": lib.steel("PressGalv", "Neutral Gray", rough=0.42, brushed=False),
        # Boru koyu: galvaniz parlaklığında tepedeki hatlar uzaktan beyaz çubuk gibi okunuyordu.
        "pipe": lib.steel("PressPipe", "Deep Violet / Plumbeous", rough=0.35, brushed=False),
        "rubber": lib.plastic("PressHose", "Black", rough=0.7, wear=0.3, scale=0.02),
        "black": lib.plastic("PressBlack", "Black", rough=0.5),
        "red": lib.plastic("PressEstop", "Spectrum Red", rough=0.3),
        "lamp": lib.plastic("PressLamp", "Green", rough=0.2),
        "line": lib.plastic("FloorLine", "Orange Yellow", rough=0.6, wear=0.6, scale=0.004),
    }


# --- Pres ---

def _rounded(x0, x1, z0, z1, r, k=6):
    """Köşeleri r yarıçaplı dikdörtgen (XZ), saat yönünün tersine; her köşede k+1 nokta."""
    P = []
    for (cx, cz), a0 in (((x1 - r, z0 + r), -90), ((x1 - r, z1 - r), 0), ((x0 + r, z1 - r), 90), ((x0 + r, z0 + r), 180)):
        for a in np.linspace(math.radians(a0), math.radians(a0 + 90), k + 1):
            P.append((cx + r * math.cos(a), cz + r * math.sin(a)))
    return P


def _frame_plate(name, y, mat):
    """Pencereli çerçeve plakası: pencerenin köşeleri gerilme yığılmasın diye yuvarlak (gerçek preslerde de öyle)."""
    hw, h = FRAME
    wx, wz0, wz1 = WINDOW
    outer = _rounded(-hw, hw, 0.0, h, 40.0)
    inner = _rounded(-wx, wx, wz0, wz1, 160.0)
    n = len(outer)
    V = [(x, y, z) for x, z in outer] + [(x, y, z) for x, z in inner]
    F = [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
    o = lib.mesh_from(name, V, F, mat, smooth_shade=False)
    so = o.modifiers.new("Solid", "SOLIDIFY")
    so.thickness = PLATE_T
    so.offset = 0.0
    return SH._bevel(o, 6.0)


def press(mats):
    fr, st = mats["frame"], mats["galv"]
    objs = []
    wx, wz0, wz1 = WINDOW
    for yc in PAIRS:
        for s in (-1, 1):
            y = yc + s * (PAIR_GAP + PLATE_T) / 2
            objs.append(_frame_plate("FramePlate", y, fr))
            objs.append(lib.box("Anchor", (FRAME[0] * 2 + 120, PLATE_T + 160, 30), (0, y, 15), fr, bevel=4.0))
            # Ankraj cıvataları: plaka zemine oturur, havada durmaz.
            for x in (-FRAME[0] - 20, FRAME[0] + 20):
                for dy in (-55, 55):
                    objs.append(lib.cylinder("AnchorNut", 22, 36, (x, y + dy, 48), st, verts=6, bevel=2.0))
            # Çiftin plakalarını bağlayan saplamaların somunları (dış yüzde): düz plaka döküm blok gibi duruyordu.
            face = y + s * PLATE_T / 2
            for x in (-(FRAME[0] + wx) / 2, (FRAME[0] + wx) / 2):
                for z in (wz0 / 2, (wz0 + wz1) / 2, (wz1 + FRAME[1]) / 2):
                    objs.append(lib.cylinder("TieWasher", 75, 12, (x, face + s * 6, z), st, rot=(90, 0, 0), verts=32,
                                             bevel=2.0))
                    objs.append(lib.cylinder("TieNut", 55, 40, (x, face + s * 32, z), st, rot=(90, 0, 0), verts=6,
                                             bevel=3.0))
        # Silindir yuvası: çiftin iki plakası arasında, pencerenin üstünde.
        objs.append(lib.box("CylMount", (2 * wx - 80, PAIR_GAP, 260), (0, yc, wz1 - 130), fr, bevel=6.0))
    hy = PLATEN[1] / 2 + 20
    # Alt tabla ve ısıtıcı plaka; üstte hareketli başlık ve üst ısıtıcı plaka (açık: arada 300 mm).
    objs.append(lib.box("Bed", (2 * wx, 2 * hy, 400), (0, 0, wz0 + 200), fr, bevel=8.0))
    objs.append(lib.box("PlatenLow", (PLATEN[0], PLATEN[1], ROLL_Z - wz0 - 400), (0, 0, (ROLL_Z + wz0 + 400) / 2),
                        mats["platen"], bevel=3.0))
    up0 = ROLL_Z + DAYLIGHT
    objs.append(lib.box("PlatenHigh", (PLATEN[0], PLATEN[1], 80), (0, 0, up0 + 40), mats["platen"], bevel=3.0))
    head0, head1 = up0 + 80, up0 + 400
    objs.append(lib.box("Head", (2 * wx - 40, 2 * hy, head1 - head0), (0, 0, (head0 + head1) / 2), fr, bevel=8.0))
    # Isıtıcı plakaların yağ kanalı ağızları: ön uçta tapalar.
    for z in (ROLL_Z - 40, up0 + 40):
        for x in np.linspace(-900, 900, 7):
            objs.append(lib.cylinder("Port", 16, 30, (x, -PLATEN[1] / 2 - 15, z), st, rot=(90, 0, 0), verts=6))
    # Silindirler: krom mil başlıktan gövdeye, gövde yuvaya.
    barrel0 = head1 + 360
    for yc in PAIRS:
        for x in CYL_X:
            objs.append(lib.cylinder("RodFlange", 150, 40, (x, yc, head1 + 20), st, verts=48, bevel=3.0))
            objs.append(lib.cylinder("Rod", 90, barrel0 - head1, (x, yc, (head1 + barrel0) / 2), mats["chrome"], verts=48))
            objs.append(lib.cylinder("Gland", 140, 60, (x, yc, barrel0 + 30), st, verts=48, bevel=4.0))
            top = wz1 - 260
            objs.append(lib.cylinder("Barrel", 165, top - barrel0 - 60, (x, yc, (barrel0 + 60 + top) / 2), fr, verts=64,
                                     bevel=4.0))
    # Işık perdesi direkleri: pencerenin dört köşesinde, iç yüzünde koyu pencere şeridi.
    for x in (-FRAME[0] - 110, FRAME[0] + 110):
        for s in (-1, 1):
            y = s * (hy + 140)
            objs.append(lib.box("CurtainPost", (60, 60, 1800), (x, y, 900), mats["guard"], bevel=3.0))
            objs.append(lib.box("CurtainLens", (24, 6, 1500), (x, y - s * 33, 1000), mats["black"]))
            objs.append(lib.box("CurtainFoot", (160, 160, 10), (x, y, 5), mats["guard"], bevel=2.0))
    return objs


def hydraulics(mats):
    """Arkada hidrolik ünite ve pano; borular arka plakadan tepeye çıkar, tepede silindirlere dağılır."""
    st, un, pp = mats["galv"], mats["unit"], mats["pipe"]
    objs = []
    uy = PAIRS[-1] + 1450
    objs.append(lib.box("Tank", (2000, 1000, 800), (0, uy, 400), un, bevel=10.0))
    objs.append(lib.box("TankLid", (2040, 1040, 30), (0, uy, 815), un, bevel=6.0))
    for x in (-500, 450):
        objs.append(lib.cylinder("PumpMotor", 170, 520, (x, uy, 830 + 190), un, rot=(0, 90, 0), verts=48, bevel=4.0))
        objs.append(lib.box("MotorFoot", (360, 300, 30), (x, uy, 845), un, bevel=3.0))
    objs.append(lib.box("Cabinet", (900, 450, 1900), (1700, uy + 150, 950), mats["box"], bevel=8.0))
    objs.append(lib.box("CabinetDoorLine", (6, 452, 1800), (1700, uy + 150, 950), mats["black"]))
    # Basınç hatları: tanktan arka plakaya, plaka boyunca yukarı, tepede Y boyunca; her silindir çiftine iniş.
    top = FRAME[1] + 70
    yb = PAIRS[-1] + (PAIR_GAP + PLATE_T) / 2 + PLATE_T / 2 + 70
    for x in (-150, 150):
        path = np.array([(x, uy - 420, 760), (x, uy - 520, 900), (x, yb, 1000), (x, yb, top - 120), (x, yb - 80, top),
                         (x, PAIRS[0] - 160, top)])
        objs.append(_pipe("PressLine", path, 40, pp))
        # Plaka tepelerinde boru eyerleri: hat havada durmaz.
        for yc in PAIRS:
            for s in (-1, 1):
                y = yc + s * (PAIR_GAP + PLATE_T) / 2
                objs.append(lib.box("PipeSaddle", (140, PLATE_T + 20, 30), (x, y, FRAME[1] + 15), st, bevel=3.0))
        for yc in PAIRS:
            for cx in CYL_X:
                if (cx > 0) == (x > 0):  # her hat kendi tarafındaki silindirlere iner
                    objs.append(_pipe("PressDrop", np.array([(x, yc, top), ((x + cx) / 2, yc, top - 20),
                                                              (cx, yc, FRAME[1] + 10)]), 26, pp))
    return objs


def _pipe(name, path, r, mat, n=40):
    P = SH._smooth_path(np.asarray(path, float), n)
    o = lib.curves(name, [(P, np.full(len(P), float(r)))], mat)
    return o


def control(mats):
    px, py = -1900.0, -2650.0
    objs = [lib.box("PressPost", (60, 60, 1250), (px, py, 625), mats["table"], bevel=2.0),
            lib.box("PressPlate", (180, 180, 10), (px, py, 5), mats["table"], bevel=1.5),
            lib.box("PressControl", (380, 220, 420), (px, py - 20, 1400), mats["box"], bevel=8.0)]
    fz = py - 130
    objs.append(lib.cylinder("PressEstopCollar", 40, 6, (px + 100, fz - 3, 1460), mats["guard"], rot=(90, 0, 0), verts=32))
    objs.append(lib.cylinder("PressEstop", 27, 26, (px + 100, fz - 19, 1460), mats["red"], rot=(90, 0, 0), verts=32,
                             bevel=4.0))
    for x in (-110, -40):
        objs.append(lib.cylinder("PressLampLens", 12, 14, (px + x, fz - 7, 1480), mats["lamp"], rot=(90, 0, 0), verts=24))
    # Çift el butonu: pres iki elle kapanır.
    for x in (-90, 90):
        objs.append(lib.cylinder("TwoHand", 22, 20, (px + x, fz - 10, 1300), mats["black"], rot=(90, 0, 0), verts=32))
    return objs


# --- Masalar ---

def roller_table(mats, x0, x1, name):
    """Makaralı masa: makara eksenleri Y boyunca; sac üstünde kayar."""
    objs = []
    r = 38.0
    for x in np.arange(x0 + 100, x1 - 50, 200.0):
        objs.append(lib.cylinder(name + "Roller", r, 2 * TABLE_Y - 60, (x, 0, ROLL_Z - r), mats["galv"], rot=(90, 0, 0),
                                 verts=32))
    xm, L = (x0 + x1) / 2, x1 - x0
    for s in (-1, 1):
        objs.append(lib.box(name + "Rail", (L, 70, 130), (xm, s * TABLE_Y, ROLL_Z - 50), mats["table"], bevel=3.0))
        for x in (x0 + 80, xm, x1 - 80):
            objs.append(lib.box(name + "Leg", (70, 70, ROLL_Z - 115), (x, s * TABLE_Y, (ROLL_Z - 115) / 2),
                                mats["table"], bevel=2.0))
            objs.append(lib.box(name + "Foot", (130, 130, 10), (x, s * TABLE_Y, 5), mats["table"], bevel=1.5))
    for x in (x0 + 80, x1 - 80):
        objs.append(lib.box(name + "Brace", (50, 2 * TABLE_Y, 50), (x, 0, 260), mats["table"], bevel=1.5))
    return objs


# --- Keçe ve levha ---

def _waves(rs, X, Y, scale, n=6, amp=1.0):
    """Rastgele yönlü sinüslerin toplamı: tekrar etmeyen, tohumla sabit gürültü (−amp..amp civarı)."""
    out = np.zeros_like(X)
    for _ in range(n):
        a = rs.uniform(0, TAU)
        k = TAU / (scale * rs.uniform(0.6, 1.4))
        out += np.sin((X * math.cos(a) + Y * math.sin(a)) * k + rs.uniform(0, TAU))
    return out * amp / math.sqrt(n / 2)


def mat_field(seed=41, step=15.0):
    """Keçenin yükseklik alanı (yerel; keçe ortası x = masa ortası): kenarda kalınlık sıfıra iner, kenar çizgisi
    dalgalı (makasla kesilmiş değil, serilmiş lif). Döner: X, Y, Z (üst yüz, z), içeride mi."""
    rs = np.random.default_rng(seed)
    L, W = BOARD[0] + 40, BOARD[1] + 40
    xs = np.arange(-L / 2 - 90, L / 2 + 90 + step, step)
    ys = np.arange(-W / 2 - 90, W / 2 + 90 + step, step)
    X, Y = np.meshgrid(xs, ys)
    d = np.minimum(L / 2 - np.abs(X), W / 2 - np.abs(Y)) + _waves(rs, X, Y, 260, amp=22) + _waves(rs, X, Y, 70, amp=8)
    ramp = np.clip(d / 140, 0, 1)
    # Taranmış keçe düz ama kabarık: uzun dalga hafif, kısa dalga tutam ölçeğinde (110 mm'lik dalga baloncuk gibiydi).
    h = MAT_H * (1 + _waves(rs, X, Y, 600, amp=0.05) + _waves(rs, X, Y, 45, n=10, amp=0.025)) * ramp * ramp * (3 - 2 * ramp)
    base = ROLL_Z + SHEET[2]
    return X, Y, np.where(d > 0, base + h, base - 3.0), d > 0


def fibre_mat(mats, xc):
    X, Y, Z, inside = mat_field()
    rs = np.random.default_rng(43)
    ny, nx = X.shape
    V = np.column_stack([X.ravel() + xc, Y.ravel(), Z.ravel()])
    idx = np.arange(nx * ny).reshape(ny, nx)
    q = inside[:-1, :-1] | inside[:-1, 1:] | inside[1:, 1:] | inside[1:, :-1]
    j, i = np.nonzero(q)
    F = np.column_stack([idx[j, i], idx[j, i + 1], idx[j + 1, i + 1], idx[j + 1, i]])
    # Tarak lifi karıştırır: zemin tek ton, melanjı tutamlar verir. Köşe başına ton, yüzde ara değerlenip
    # sabit rampada eşiklenince 2–3 hücrelik lekeler kamuflaj gibi okunuyordu. `clump` tutam rengini seçer.
    # Kumaş renkleri tutamlarda ve seyrek beneklerde kalır (sık benekle yüz terrazzo gibi okunuyordu).
    clump = rs.random(X.size)
    mat = lib.fibre_mass("FibreMat", ["Deep Violet / Plumbeous"], SH.FIBRE, size=30.0, density=0.15)
    o = lib.mesh_from("FibreMat", [tuple(p) for p in V], [tuple(f) for f in F], mat)
    o.data.attributes.new("clump", "FLOAT", "POINT").data.foreach_set("value", clump.astype(np.float32))
    return o, (X + xc, Y, Z, inside, clump.reshape(X.shape))


def mat_fluff(field, seed=47, tufts=150000):
    """Keçenin yüzündeki ve kenarındaki tutamlar: yüzey düz ama tüylü; kenar saçaklı."""
    X, Y, Z, inside, clump = field
    rs = np.random.default_rng(seed)
    gy, gx = np.gradient(Z, Y[:, 0], X[0, :])
    cand = np.argwhere(inside)
    pick = cand[rs.integers(0, len(cand), tufts)]
    j, i = pick[:, 0], pick[:, 1]
    step = X[0, 1] - X[0, 0]
    jit = rs.uniform(-0.5, 0.5, (tufts, 2)) * step
    roots = np.column_stack([X[j, i] + jit[:, 0], Y[j, i] + jit[:, 1], Z[j, i] - 3.0])
    up = np.column_stack([-gx[j, i], -gy[j, i], np.ones(tufts)])
    up /= np.linalg.norm(up, axis=1, keepdims=True)
    P, Rr, _ = SH.fibres(rs, roots, up, 4, (20, 60), 0.09, spread=0.9, lift=0.15)
    yarn = np.repeat(SH.fibre_colour(roots, clump[j, i]), 4)
    mat = lib.fibre_hair("MatFluff", SH.FIBRE_TONES + SH.FIBRE, rough=0.5, var=0.3, yarn_weight=0.97, streak=0.12)
    return lib.curves_array("MatFluff", P, Rr, yarn, mat)


def board(mats, xc):
    """Preslenmiş levha: lif sıkışınca renk koyulaşır, her kaynağın lifi benek olarak kalır (6. bölüm bunu yakından
    gösterir). Yüzey düz ama mat; kenarda katmanlar seçilmez."""
    L, W, T = BOARD
    z0 = ROLL_Z + SHEET[2]
    # Zemin sıkışmış denimin koyu mavisi (gevşek lifte ışık saçılır, açık görünür; preste saçılma azalır). felt'in
    # Voronoi ölçeği 5: size=45 → ~9 mm benek. 9 ile 1,8 mm'lik benekler bej bir ortalamaya karışıyordu.
    m = lib.felt("Board", "Violet Blue", SH.FIBRE + ["Salvia Blue", "Olympic Blue"], scale=1.0, density=0.4,
                 rough=0.8, fuzz=0.12, bump=0.25, size=45.0)
    return [lib.box("Board", (L, W, T), (xc, 0, z0 + T / 2), m, bevel=1.5)]


def sheets(mats, xs):
    return [lib.box("CaulSheet", SHEET, (x, 0, ROLL_Z + SHEET[2] / 2), mats["sheet"], bevel=1.0) for x in xs]


# --- Bağlayıcı adayları ---

def binders(mats):
    """İki aday, ikisi de etiketsiz: palette sarılı elyaf balyası ve yanında kapalı çelik varil."""
    bx, by = BINDER_AT
    ply = lib.wood("Pallet", "Isabella Color", "Maple", scale=0.6, rough=0.7, coat=0.0)
    objs = []
    # Euro palet 1200×800: üç ayak sırası, üst tahtalar.
    for x in (-540, 0, 540):
        for y in (-345, 0, 345):
            objs.append(lib.box("PalletBlock", (145, 100, 78), (x, y, 22 + 39), ply, bevel=2.0))
        objs.append(lib.box("PalletRunner", (145, 800, 22), (x, 0, 11), ply, bevel=1.5))
    for y in np.linspace(-345, 345, 5):
        objs.append(lib.box("PalletBoard", (1200, 120 if abs(y) > 300 else 100, 22), (0, y, 100 + 11), ply, bevel=1.5))
    # Balya: şeffaf olmayan beyaz streç; köşeler basınçla yuvarlanmış, dört çember.
    wrap = lib.plastic("BaleWrap", "White", rough=0.32, wear=0.25, scale=0.01)
    bale = lib.box("Bale", (1100, 720, 820), (0, 0, 122 + 410), wrap, bevel=60.0, segments=4)
    objs.append(bale)
    strap = lib.plastic("BaleStrap", "Black", rough=0.55)
    for x in (-390, -130, 130, 390):
        objs.append(lib.box("Strap", (32, 732, 832), (x, 0, 122 + 410), strap, bevel=6.0))
    root = _place("BinderPallet", objs, bx, by, math.radians(8))  # elle bırakılmış: hatla tam hizalı değil
    # Varil: 200 L çelik, iki yuvarlanma çemberi, kapakta iki tıpa; tavada değil zeminde.
    drum = lib.plastic("Drum", "Deep Lyons Blue", rough=0.35, wear=0.35, scale=0.01)
    d = [lib.cylinder("DrumBody", 292, 880, (0, 0, 440), drum, verts=64, bevel=6.0)]
    for z in (300, 590):
        d.append(lib.cylinder("DrumHoop", 300, 24, (0, 0, z), drum, verts=64, bevel=6.0))
    d.append(lib.cylinder("DrumRim", 296, 16, (0, 0, 880), drum, verts=64, bevel=5.0))
    for x, r in ((-170, 30), (150, 20)):
        d.append(lib.cylinder("DrumBung", r, 14, (x, 60, 887), mats["galv"], verts=24, bevel=2.0))
    return [root, _place("BinderDrum", d, bx + 1000, by - 120, 0.0)]


def _place(name, objs, x, y, rot):
    """Yerel bir grubu istasyon yereline koyar (kök istasyonun köküne bağlı)."""
    g = lib.empty(name, (x, y, 0.0))
    g.rotation_euler = (0.0, 0.0, rot)
    for o in objs:
        o.parent = g
    return g


# --- Zemin çizgileri ---

def floor_lines(mats):
    """Pres alanının sarı sınır çizgisi: zemin boyası, aşınmış."""
    x0, x1 = -TABLE_X[1] - 250, TABLE_X[1] + 250
    y0, y1 = -TABLE_Y - 420, PAIRS[-1] + 2100
    w = 70.0
    objs = [lib.box("FloorLine", (x1 - x0, w, 1.0), ((x0 + x1) / 2, y0, 0.5), mats["line"]),
            lib.box("FloorLine", (w, y1 - y0, 1.0), (x0, (y0 + y1) / 2, 0.5), mats["line"]),
            lib.box("FloorLine", (w, y1 - y0, 1.0), (x1, (y0 + y1) / 2, 0.5), mats["line"])]
    return objs


# --- Işık ---

# Tavan ışıkları: ad, yerel konum, boy, güç (W), yayılım (tam açı, °). Pres 3,3 m; ışık onun üstünde.
POOL_H = 5200.0
POOLS = (("PoolPress", (0.0, -300.0), (3200.0, 2400.0), 1.3e8, 60.0),
         ("PoolForm", (-2950.0, -1500.0), (2600.0, 2400.0), 6.0e7, 55.0),
         ("PoolBoard", (2900.0, -500.0), (2000.0, 1600.0), 5.5e7, 55.0))


def lights():
    """Pres istasyonunun ışık havuzları. Her ışık çuvalın tersine yayılım açısının yarısı kadar eğilir: konisinin
    önceki bölümlere bakan kenarı dikey iner (parçalama hattındaki havuzlar gibi)."""
    for name, (x, y), size, power, spread in POOLS:
        cx, cy = world(x, y)
        ax, ay = cx - SH.ORIGIN[0], cy - SH.ORIGIN[1]
        k = POOL_H * math.tan(math.radians(spread / 2)) / math.hypot(ax, ay)
        lib.area_light((cx, cy, FLOOR + POOL_H), (cx + ax * k, cy + ay * k, FLOOR), size=size[0], size_y=size[1],
                       power=power, color="Sulpher Yellow", spread=spread, name=name)
    # Presin arkasından soğuk kenar ışığı: çerçevenin hatları ve keçenin tüyü zeminden ayrılır.
    cx, cy = world(-600.0, 4200.0)
    tx, ty = world(-600.0, 0.0)
    lib.area_light((cx, cy, FLOOR + 3600), (tx, ty, FLOOR + 900), size=2400, power=6.0e7, color="Nile Blue", spread=70,
                   name="PoolPressRim")


def station():
    """Bağlayıcı ve pres: besleme masası ve keçe, pres, hidrolik, çıkış masası ve levha, bağlayıcı adayları, ışıklar."""
    mats = materials()
    xin = -(TABLE_X[0] + TABLE_X[1]) / 2
    xout = -xin
    objs = press(mats) + hydraulics(mats) + control(mats) + floor_lines(mats)
    objs += roller_table(mats, -TABLE_X[1], -TABLE_X[0], "In") + roller_table(mats, TABLE_X[0], TABLE_X[1], "Out")
    objs += sheets(mats, (xin, xout)) + board(mats, xout)
    m, field = fibre_mat(mats, xin)
    objs += [m, mat_fluff(field)] + binders(mats)
    _root("PressRoot", objs)
    lights()
