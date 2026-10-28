# Atölye ve tartım köşesi (birim mm): kesim masasının kendisi, beton zemin, kantarda duran kırpıntı çuvalı.
# 1–3. bölüm aynı dünyayı kurar. 1. ve 2. bölümde masa kâğıdı kadrajı doldurur; 3. bölümde kamera geri çekilince
# masa, zemin ve tartım köşesi açılır. Kantarın göstergesi kameraya sırtını döner: karede sayı yok (D-011).
import math

import numpy as np
from mathutils import Matrix, Vector, noise

import lib
import scraps

TAU = 2 * math.pi
FLOOR = -750.0
TABLE = (-900.0, -600.0, 900.0, 500.0)  # tabla: x0, y0, x1, y1 (üst yüz z = 0, üstünde kâğıt)
TOP_T = 24.0  # kontrplak kalınlığı

# Kolon yerel +X'te: çuvalın sağ arkasında kalır, göstergenin yüzü kameradan uzağa bakar. 25°'de kolon kameradan
# bakınca yığının tam arkasına düşüyor, yığının içinden çıkıyor gibi görünüyordu.
SCALE_AT, SCALE_ROT = (420.0, -1000.0), math.radians(-39)
COLUMN = 850.0  # zeminden gösterge altına
PLAT_TOP = FLOOR + 75.0
SACK_ROT = math.radians(-55)  # geniş yüz kameraya bakar
SACK_A, SACK_B, SACK_N = 235.0, 170.0, 4.0  # taban: süperelips yarı eksenleri ve üssü
SACK_H, CUFF, ROLL, LIP, BULGE = 600.0, 70.0, 22.0, 3.5, 22.0
DOME, HEAP_COUNT = 40.0, 82  # ağızdaki tümseğin yüksekliği (mm) ve kırpıntı sayısı


def _smooth(x, a, b):
    t = np.clip((np.asarray(x, float) - a) / (b - a), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def _local(at, rot, x, y):
    """Dünya → nesne yereli (yalnızca z ekseni dönüşü)."""
    c, s = math.cos(rot), math.sin(rot)
    dx, dy = np.asarray(x) - at[0], np.asarray(y) - at[1]
    return c * dx + s * dy, -s * dx + c * dy


def _world(at, rot, lx, ly):
    c, s = math.cos(rot), math.sin(rot)
    return at[0] + c * lx - s * ly, at[1] + s * lx + c * ly


# --- Masa ve zemin ---

def table():
    x0, y0, x1, y1 = TABLE
    cx, cy, W, D = (x0 + x1) / 2, (y0 + y1) / 2, x1 - x0, y1 - y0
    # Kâğıdın nesne kökeni dünya kökeninde: dokusu 1. bölümdeki tek düzlemle aynı yerde kalır.
    kraft = lib.kraft("Kraft", "Isabella Color", "Maple", "Ivory Buff", unit=1.0)
    px0, py0, px1, py1 = x0 + 30, y0 + 25, x1 - 30, y1 - 25
    lib.mesh_from("Paper", [(px0, py0, 0), (px1, py0, 0), (px1, py1, 0), (px0, py1, 0)], [(0, 1, 2, 3)], kraft,
                  smooth_shade=False)
    ply = lib.wood("Ply", "Ivory Buff", "Maple", scale=1.0, rough=0.5, coat=0.15)
    lib.box("Top", (W, D, TOP_T), (cx, cy, -0.3 - TOP_T / 2), ply, bevel=1.5)
    paint = lib.plastic("TableFrame", "Slate Color", rough=0.42, wear=0.25, scale=0.01)
    under = -0.3 - TOP_T
    h = under - FLOOR
    for sx in (x0 + 70, x1 - 70):
        for sy in (y0 + 70, y1 - 70):
            lib.box("Leg", (50, 50, h), (sx, sy, FLOOR + h / 2), paint, bevel=2.0)
    # Kuşak: tablanın altında bacakları bağlayan profil.
    for sy in (y0 + 70, y1 - 70):
        lib.box("ApronX", (W - 140, 30, 80), (cx, sy, under - 40), paint, bevel=1.5)
    for sx in (x0 + 70, x1 - 70):
        lib.box("ApronY", (30, D - 140, 80), (sx, cy, under - 40), paint, bevel=1.5)


def floor():
    m = lib.concrete("Floor", "Warm Gray", "Light Grayish Olive", "Neutral Gray", unit=1.0)
    # 100 m: kamera her bölümde metrelerce geri çekilir; dikey karenin köşesi zeminin dışına düşünce ufuk çizgisi
    # görünüyordu (4. bölümde 16 m, 5. bölümde 40 m yetmedi). Desen nesne koordinatında, boy değişince ölçeği değişmez.
    lib.plane("Floor", (100000, 100000), (0, 0, FLOOR), m)


# --- Masadaki atölye eşyaları ---
# 3. bölümün ara karelerinde masa boş kalmasın: denim topu ve katlanmış kumaşlar. 1.–2. bölüm kadrajına girmezler
# (kırpıntı alanından en az 70 mm uzak; projeksiyonla denetlendi) ve anahtar ışıkla kesim alanı arasında durmazlar:
# top (−330, −330, 18°) iken ışığın ortalama %11'ini kesiyor, 2. bölümün son karesinin sağ altını %6 karartıyordu
# (ışın izlemeyle ölçüldü; bu yerde 0).

BOLT_AT, BOLT_ROT = (-540.0, -250.0), math.radians(35)  # eksen yerel X; açılan kat yerel −Y'ye serilir
BOLT_R, BOLT_L, CORE_R, CORE_OUT, FLAP = 58.0, 560.0, 21.0, 12.0, 130.0
STACK_AT, STACK_ROT = (150.0, -420.0), math.radians(-8)


def _grid_faces(rows, cols, outward=True):
    """rows × cols köşe ızgarası (satır satır) için dörtgen yüzler."""
    F = []
    for j in range(rows - 1):
        for i in range(cols - 1):
            a, b, c, d = j * cols + i, j * cols + i + 1, (j + 1) * cols + i + 1, (j + 1) * cols + i
            F.append((a, b, c, d) if outward else (a, d, c, b))
    return F


def _uv_mesh(name, V, F, uv_of_vert, mat, loc=(0, 0, 0)):
    o = lib.mesh_from(name, [tuple(p) for p in V], F, mat)
    uv = o.data.uv_layers.new(name="UVMap")
    uv.data.foreach_set("uv", np.array([uv_of_vert[k] for f in F for k in f], np.float32).ravel())
    o.location = loc
    return o


def _tube(name, r_out, r_in, length, mat, n=96):
    """Eksen yerel X boyunca boru: dış ve iç yüz, iki uçta halka."""
    a = np.linspace(0, TAU, n, endpoint=False)
    V, F = [], []
    for x in (-length / 2, length / 2):
        for r in (r_out, r_in):
            V += [(x, r * math.cos(t), r * math.sin(t)) for t in a]
    ring = lambda x_k, r_k: (2 * x_k + r_k) * n  # noqa: E731
    for k in range(n):
        k1 = (k + 1) % n
        F.append((ring(0, 0) + k, ring(0, 0) + k1, ring(1, 0) + k1, ring(1, 0) + k))  # dış yüz
        F.append((ring(0, 1) + k, ring(1, 1) + k, ring(1, 1) + k1, ring(0, 1) + k1))  # iç yüz
        F.append((ring(0, 0) + k, ring(0, 1) + k, ring(0, 1) + k1, ring(0, 0) + k1))  # −X ucu
        F.append((ring(1, 0) + k, ring(1, 0) + k1, ring(1, 1) + k1, ring(1, 1) + k))  # +X ucu
    return lib.mesh_from(name, V, F, mat)


def bolt(seed=6):
    """Denim topu: karton masuraya sarılı kumaş. Dış kat topun altından çıkıp masaya serilir; top kendi katının
    üstünde durur. Kesik uçlarda katlar hafifçe kaymış (sarımda kenar tam hizalanmaz)."""
    _, _, twill, pitch, t = scraps.FABRICS["denim"]
    # Atkı açık mavi-gri (yıkanmış denim). Ekru atkıyla ortalama renk uzaktan gri-mora düşüyordu (doğrusal ortalama
    # ≈ sRGB 120/117/140); iki koyu mavide ise dimi görünmüyor, top kâğıt rulo gibiydi. Bu çiftte ortalama
    # ≈ 101/132/163. Hav kumaşın kendi renginde: silindirde yüzeyin çoğu sıyırma açısında kaldığı için beyaz hav
    # topu griye çekiyordu; mavi hav kenarda yumuşak bir parlama verir.
    warp, weft = "Deep Lyons Blue", "Light Glaucous Blue"
    cloth = lib.fabric("BoltCloth", warp, weft, pitch=pitch, twill=twill, fuzz=0.6, var=0.22, bump=0.5, coord="UV",
                       sheen=warp)
    rs = np.random.default_rng(seed)
    ph = rs.uniform(0, TAU, 6)
    zc = BOLT_R + t

    def rad(a, x):  # dış kat tam silindir değil: sarım gerginliği boyunca hafif dalga
        return BOLT_R + 0.5 * np.sin(3 * a + ph[0]) + 0.35 * np.sin(x / 90 + ph[1]) * np.cos(2 * a + ph[2])

    M, K = 288, 48
    A = np.linspace(0, TAU, M + 1)  # dikişte köşe iki kez: UV sarılmaz
    X = np.linspace(-BOLT_L / 2, BOLT_L / 2, K)
    V, UV = [], []
    for x in X:
        for a in A:
            r = rad(a, x)
            V.append((x, r * math.cos(a), r * math.sin(a)))
            UV.append((x + BOLT_L / 2, a * BOLT_R))
    parts = [_uv_mesh("BoltSide", V, _grid_faces(K, M + 1), UV, cloth, (0, 0, zc))]
    # Uçlar: masuradan dış kata halka; her yarıçapta katın kayması ayrı.
    end = lib.bolt_end("BoltEnd", warp, weft, layer=1.1)
    R0 = np.linspace(0.0, 1.0, 26)  # masuradan dış kata oran
    for side in (-1, 1):
        x0 = side * BOLT_L / 2
        Ve = []
        for f in R0:
            for a in A[:-1]:
                r_out = rad(a, x0)
                r = CORE_R + (r_out - CORE_R) * f
                slip = (1.3 * math.sin(r / 6.5 + ph[3]) + 0.5 * math.sin(r / 1.9 + ph[4] + a)) * (1 - f ** 6)
                Ve.append((x0 + side * slip, r * math.cos(a), r * math.sin(a)))
        Fe = []
        for j in range(len(R0) - 1):
            for i in range(M):
                i1 = (i + 1) % M
                q = (j * M + i, j * M + i1, (j + 1) * M + i1, (j + 1) * M + i)
                Fe.append(q[::-1] if side > 0 else q)  # yüz normali uçtan dışarı
        o = lib.mesh_from(f"BoltEnd{side}", Ve, Fe, end)
        o.location = (0, 0, zc)
        parts.append(o)
    core = lib.kraft("BoltCore", "Isabella Color", "Maple", "Ivory Buff", unit=1.0)
    c = _tube("BoltCore", CORE_R, CORE_R - 3.0, BOLT_L + 2 * CORE_OUT, core)
    c.location = (0, 0, zc)
    parts.append(c)
    # Serilen kat: topun altından (yerel y = +12) kameraya doğru; kesik ucu hafif eğri.
    nx, ns = 141, 40
    Vf, UVf = [], []
    for s in np.linspace(0, 1, ns):
        for x in np.linspace(-BOLT_L / 2, BOLT_L / 2, nx):
            y_end = -FLAP + 6.0 * math.sin(x / 70 + ph[5]) + 0.03 * x
            y = 12.0 + s * (y_end - 12.0)
            free = _smooth(-y, 15.0, 70.0)
            # Kumaş masaya tam yapışmaz: yumuşak dalgalar, kesik uçta hafif kalkma. Düz serilen kat kâğıt gibiydi.
            wave = 2.2 * math.sin(x / 61 + ph[0]) * math.sin(-y / 41 + ph[1]) + 0.9 * math.sin(x / 27 + ph[2] - y / 60)
            curl = 2.8 * float(_smooth(y_end + 22.0 - y, 0.0, 22.0)) * (0.6 + 0.4 * math.sin(x / 83 + ph[3]))
            Vf.append((x, y, t + free * (2.4 + wave) + curl))
            UVf.append((x + BOLT_L / 2, -y))
    flap = _uv_mesh("BoltFlap", Vf, _grid_faces(ns, nx, outward=False), UVf, cloth)
    so = flap.modifiers.new("Solid", "SOLIDIFY")
    so.thickness, so.offset = t, -1.0
    parts.append(flap)
    root = lib.empty("BoltRoot", (BOLT_AT[0], BOLT_AT[1], 0.0))
    root.rotation_euler = (0.0, 0.0, BOLT_ROT)
    for o in parts:
        o.parent = root
    return root


def _folded(name, w, d, h, mat, rs):
    """Katlanmış kumaş: yastık gibi kabarık, köşeleri yuvarlak, kenar çizgisi hafif dalgalı; kenarlar katın
    kalınlığı kadar yuvarlak iner (alt yüz yok: altındakine oturur). Dik köşeli, düz kenarlı ve ince katlar
    uzaktan sayfalı bir kitap gibi okunuyordu. Izgara kenarda sıklaşır."""
    def axis(L):
        e = np.linspace(0, h, 9)
        return np.unique(np.concatenate([-L / 2 + e, np.arange(-L / 2 + h, L / 2 - h, 3.0), L / 2 - e[::-1]]))

    xs, ys = axis(w), axis(d)
    rc = 0.06 * min(w, d)  # köşe yarıçapı; 0,13'te parça yastık ya da telefon kılıfı gibiydi
    ph = rs.uniform(0, TAU, 6)
    # Katlama izleri kenarlara paralel, uzun ve sığ; biri kısa ve eğik. Rastgele yönlü izler ortada X çizip
    # dikişli minder gibi okunuyordu, ortadan geçen tek oluk da kitap sırtı gibi.
    wr = [(rs.uniform(-w / 5, w / 5), 0.0, math.pi / 2 + math.radians(rs.uniform(-6, 6)), 0.4 * d, 0.16 * h),
          (0.0, rs.uniform(-d / 5, d / 5), math.radians(rs.uniform(-6, 6)), 0.35 * w, 0.12 * h),
          (rs.uniform(-w / 4, w / 4), rs.uniform(-d / 4, d / 4), rs.uniform(0, math.pi), 35.0, 0.1 * h)]
    V = []
    for y in ys:
        for x in xs:
            dd = min(w / 2 - abs(x), d / 2 - abs(y))
            prof = math.sqrt(max(0.0, 1 - (1 - min(dd / h, 1.0)) ** 2))
            dome = 0.14 * h * (1 - (2 * x / w) ** 2) * (1 - (2 * y / d) ** 2)
            puff = dome + 0.12 * h * math.sin(x / 47 + ph[0]) * math.sin(y / 37 + ph[1])
            for cx, cy, a, L, amp in wr:
                u = (x - cx) * math.cos(a) + (y - cy) * math.sin(a)
                v = -(x - cx) * math.sin(a) + (y - cy) * math.cos(a)
                puff -= amp * math.exp(-(v / 4.0) ** 2 - (u / L) ** 2)
            z = h * prof + float(_smooth(dd, 2.0, 24.0)) * puff
            # Köşe: kare köşe parçası, L∞ yarıçapı korunarak çeyrek daireye. Kenardan uzaklık (dd) değişmez,
            # yani yuvarlak kenar profili köşede de aynı kalır.
            px, py = abs(x) - (w / 2 - rc), abs(y) - (d / 2 - rc)
            vx, vy = x, y
            if px > 0 and py > 0:
                k = max(px, py) / math.hypot(px, py)
                vx = math.copysign(w / 2 - rc + px * k, x)
                vy = math.copysign(d / 2 - rc + py * k, y)
            # Kenar çizgisi: bütün parça ±2,5 mm hafifçe eğilir.
            V.append((vx + 2.5 * math.sin(vy / 57 + ph[2]), vy + 2.5 * math.sin(vx / 63 + ph[3]), z))
    return lib.mesh_from(name, V, _grid_faces(len(ys), len(xs)), mat)


def folded_stack(seed=9):
    """Masada üst üste beş katlanmış kumaş. Yandan renk renk katlar görünür: tek düz kat uzaktan kitap ya da
    tepsi gibi okunuyordu. Katlar farklı boyda, biraz kaymış ve dönmüş; hizalı katlar sayfa gibi görünüyordu."""
    rs = np.random.default_rng(seed)
    root = lib.empty("StackRoot", (STACK_AT[0], STACK_AT[1], 0.0))
    root.rotation_euler = (0.0, 0.0, STACK_ROT)
    z = 0.0
    # Altta koyu lacivert: ekru taban masayla aynı tonda kayboluyordu. Üstte açık ekru: doygun kırmızı üst yüz
    # son karede çuvaldan çok göz çekiyordu.
    pieces = [("denim_dark", 266, 190, 12.0), ("ochre_red", 238, 176, 10.0), ("olive", 254, 164, 12.5),
              ("ocher", 224, 170, 9.0), ("canvas", 212, 152, 11.0)]
    for k, (fab, w, d, h) in enumerate(pieces):
        warp, weft, twill, pitch, _ = scraps.FABRICS[fab]
        mat = lib.fabric(f"Fold_{fab}", warp, weft, pitch=pitch, twill=twill, fuzz=0.6, var=0.18, bump=0.5, sheen=warp)
        o = _folded(f"Fold{k}", w, d, h, mat, rs)
        o.location = (rs.uniform(-9, 9), rs.uniform(-7, 7), z)
        o.rotation_euler = (0.0, 0.0, math.radians(rs.uniform(-5, 5)))
        o.parent = root
        z += h - 0.4  # üstteki kat alttakinin kabarık yüzüne biraz gömülür: aralarında boşluk kalmaz
    return root


def bench():
    """Kesim masasının kırpıntı alanı dışındaki eşyaları."""
    bolt()
    folded_stack()


# --- Kantar ---

def platform_scale():
    """Baklavalı sac platformlu kantar (600×600 mm), arka kenarda kolon ve gösterge kutusu."""
    frame = lib.plastic("ScaleFrame", "Dark Medici Blue", rough=0.4, wear=0.35, scale=0.01)
    plate = lib.tread("ScalePlate", "Neutral Gray", pitch=30.0, rough=0.36)
    steel = lib.steel("ScaleSteel", "Neutral Gray", rough=0.3, brushed=True, scale=0.02)
    housing = lib.plastic("Indicator", "Neutral Gray", rough=0.5, wear=0.2, scale=0.02)
    rubber = lib.plastic("Rubber", "Black", rough=0.7)
    objs = []
    for sx in (-270, 270):
        for sy in (-270, 270):
            objs.append(lib.cylinder("Foot", 22, 14, (sx, sy, FLOOR + 7), rubber, verts=32, bevel=1.5))
    objs.append(lib.box("ScaleBody", (600, 600, 55), (0, 0, FLOOR + 14 + 27.5), frame, bevel=3.0))
    objs.append(lib.box("ScaleTop", (594, 594, 6), (0, 0, PLAT_TOP - 3), plate, bevel=1.0))
    # Kolon: gövdeye cıvatalı ayak, üstünde gösterge. Gösterge yüzü yerel +X'e (kameradan uzağa) bakar.
    objs.append(lib.box("Bracket", (70, 90, 50), (335, 0, FLOOR + 45), frame, bevel=2.0))
    top_z = FLOOR + COLUMN
    objs.append(lib.cylinder("Column", 19, top_z - (FLOOR + 70), (345, 0, (top_z + FLOOR + 70) / 2), steel,
                             verts=48))
    objs.append(lib.box("IndicatorBox", (80, 240, 150), (365, 0, top_z + 40), housing, bevel=9.0))
    objs.append(lib.box("IndicatorMount", (40, 60, 70), (330, 0, top_z + 10), steel, bevel=2.0))
    # Kablo: kutunun altından kolon boyunca gövdeye.
    pts = [(372, 30, top_z - 30), (380, 34, top_z - 120), (368, 26, FLOOR + 600), (366, 24, FLOOR + 300),
           (362, 30, FLOOR + 90), (330, 46, FLOOR + 60)]
    P = _spline(np.array(pts, float), 80)
    objs.append(lib.curves("Cable", [(P, np.full(len(P), 3.0))], rubber))
    root = lib.empty("ScaleRoot", (SCALE_AT[0], SCALE_AT[1], 0.0))
    root.rotation_euler = (0.0, 0.0, SCALE_ROT)
    for o in objs:
        o.parent = root
    return objs


def _spline(P, n):
    """Catmull-Rom: kontrol noktalarından geçen yumuşak eğri."""
    Q = np.vstack([P[:1], P, P[-1:]])
    out = []
    for k in range(1, len(Q) - 2):
        p0, p1, p2, p3 = Q[k - 1], Q[k], Q[k + 1], Q[k + 2]
        for t in np.linspace(0, 1, max(2, n // (len(P) - 1)), endpoint=False):
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t
                              + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    out.append(P[-1])
    return np.array(out)


# --- Çuval ---

def _ring(count, seam_dir):
    """Süperelips taban: eşit yay aralıklı noktalar, dışa normaller, yay uzunluğu. Dikiş seam_dir yönünde."""
    t = np.linspace(0, TAU, 4096, endpoint=False)
    c, s = np.cos(t), np.sin(t)
    e = 2 / SACK_N
    P = np.column_stack([SACK_A * np.sign(c) * np.abs(c) ** e, SACK_B * np.sign(s) * np.abs(s) ** e])
    k0 = int(np.argmin(np.abs((np.arctan2(P[:, 1], P[:, 0]) - seam_dir + math.pi) % TAU - math.pi)))
    P = np.roll(P, -k0, axis=0)
    Q = np.vstack([P, P[:1]])
    arc = np.concatenate([[0.0], np.cumsum(np.linalg.norm(np.diff(Q, axis=0), axis=1))])
    L = arc[-1]
    u = np.linspace(0, L, count, endpoint=False)
    R = np.column_stack([np.interp(u, arc, Q[:, 0]), np.interp(u, arc, Q[:, 1])])
    T = np.roll(R, -1, axis=0) - np.roll(R, 1, axis=0)
    T /= np.linalg.norm(T, axis=1, keepdims=True)
    return R, np.column_stack([T[:, 1], -T[:, 0]]), u, L


def _bulge(z):
    return BULGE * np.sin(math.pi * np.clip(np.asarray(z) / SACK_H * 0.92, 0, 1)) ** 0.7


def _env(z):
    return _smooth(z, 10, 80) * (1 - 0.65 * _smooth(z, SACK_H - 140, SACK_H))


def _wrinkle(u, z, seed):
    a = noise.noise(Vector((u / 75.0, z / 190.0, seed)))
    b = noise.noise(Vector((u / 24.0, z / 70.0, seed + 7.3)))
    c = noise.noise(Vector((u / 110.0, seed + 2.1, 0.5)))
    # Ağız altında dolmayan bant: yatay bir sarkma kıvrımı.
    sag = -9.0 * math.exp(-((z - (SACK_H - 150)) / 32.0) ** 2) * (0.6 + 0.4 * c)
    return 8.0 * a + 2.6 * b + sag


def _body(u, z, seed):
    return float(_bulge(z) + _env(z) * _wrinkle(u, z, seed))


def sack_surface(seed=3):
    """Dolu dokuma PP çuval: yuvarlatılmış taban, karnı şişkin gövde, dışa kıvrılmış ağız (manşet).
    Profil çizgisi gövdeden ağız dudağına, oradan manşetin serbest kenarına iner; UV mm cinsinden."""
    M = 420
    R, Nrm, U, L = _ring(M, math.pi / 2)  # dikiş yerel +Y'de: kameraya bakan yüzün arkası
    prof = []  # (taban ofseti, z, tür) tür: 0 gövde, 1 dudak, 2 manşet
    for a in np.linspace(-90, 0, 9)[:-1]:
        r = math.radians(a)
        prof.append((-ROLL + ROLL * math.cos(r), ROLL + ROLL * math.sin(r), 0))
    for z in np.arange(ROLL, SACK_H, 5.0):
        prof.append((0.0, z, 0))
    for a in np.linspace(180, 0, 12):
        r = math.radians(a)
        prof.append((LIP + LIP * math.cos(r), SACK_H + LIP * math.sin(r), 1))
    for z in np.linspace(SACK_H, SACK_H - CUFF, 16)[1:]:
        prof.append((2 * LIP + 5.0 * ((SACK_H - z) / CUFF) ** 2, z, 2))
    po = np.array([(p[0], p[1]) for p in prof])
    V = np.concatenate([[0.0], np.cumsum(np.linalg.norm(np.diff(po, axis=0), axis=1))])
    verts = []
    top = [_body(U[i], SACK_H, seed) for i in range(M)]
    for j, (off, z, kind) in enumerate(prof):
        for i in range(M):
            if kind == 0:
                d = off + _body(U[i], z, seed)
            elif kind == 1:
                d = off + top[i]
            else:
                cuff = 1.6 * (1 + noise.noise(Vector((U[i] / 28.0, z / 22.0, seed + 3.0))))
                d = off + _body(U[i], z, seed) + cuff
            verts.append((R[i, 0] + Nrm[i, 0] * d, R[i, 1] + Nrm[i, 1] * d, z))
    rows = len(prof)
    faces, uvs = [], []
    for j in range(rows - 1):
        for i in range(M):
            i1 = (i + 1) % M
            faces.append((j * M + i, j * M + i1, (j + 1) * M + i1, (j + 1) * M + i))
            u0, u1 = U[i], (U[i1] if i1 else L)  # dikişte UV sarılmaz
            uvs += [(u0, V[j]), (u1, V[j]), (u1, V[j + 1]), (u0, V[j + 1])]
    c = len(verts)
    verts.append((0.0, 0.0, 0.0))
    for i in range(M):
        faces.append((c, (i + 1) % M, i))
        uvs += [(0.0, 0.0)] * 3
    return verts, faces, uvs, {"ring": R, "normal": Nrm, "u": U, "seed": seed}


def sack(seed=3):
    # Kırık beyaz dokuma PP: tamamen Ivory Buff çuval kraft kâğıtla ve masayla aynı tonda kayboluyordu.
    mat = lib.fabric("SackPP", "White", "Ivory Buff", pitch=(2.6, 2.6), fuzz=0.12, rough=0.42, twill=0,
                     var=0.1, bump=0.8, coord="UV")
    verts, faces, uvs, geo = sack_surface(seed)
    o = lib.mesh_from("Sack", verts, faces, mat)
    uv = o.data.uv_layers.new(name="UVMap")
    uv.data.foreach_set("uv", np.array(uvs, np.float32).ravel())
    so = o.modifiers.new("Solid", "SOLIDIFY")
    so.thickness = 1.2
    so.offset = -1.0
    o.location = (SCALE_AT[0], SCALE_AT[1], PLAT_TOP)
    o.rotation_euler = (0.0, 0.0, SACK_ROT)
    return o, geo


# --- Çuval ağzındaki kırpıntı yığını ---

def heap_field(seed=8, h=2.0):
    """Ağızda kubbeleşen yığın, dudakta yükselen ve dışarıda manşet boyunca düşen yüzey (dünya koordinatı)."""
    span = 340.0
    f = scraps.Field(SCALE_AT[0] - span, SCALE_AT[1] - span, SCALE_AT[0] + span, SCALE_AT[1] + span, h=h)
    lx, ly = _local(SCALE_AT, SACK_ROT, f.X, f.Y)
    rho = (np.abs(lx / SACK_A) ** SACK_N + np.abs(ly / SACK_B) ** SACK_N) ** (1 / SACK_N)
    r = np.hypot(lx, ly)
    dist = r * (1 - 1 / np.maximum(rho, 1e-6))  # süperelipsten ışın boyunca uzaklık (içeride negatif)
    lip = PLAT_TOP + SACK_H + 2 * LIP
    rs = np.random.default_rng(seed)
    lumps = np.zeros_like(rho)
    for _ in range(9):
        cx, cy = rs.uniform(-0.6, 0.6) * SACK_A, rs.uniform(-0.6, 0.6) * SACK_B
        lumps += rs.uniform(6, 14) * np.exp(-((lx - cx) ** 2 + (ly - cy) ** 2) / (2 * rs.uniform(40, 80) ** 2))
    # Ağızdan biraz taşan alçak tümsek: yüksek ve dar tümsekte kenardaki kırpıntı dikine duruyordu.
    inside = PLAT_TOP + SACK_H - 6 + DOME * np.clip(1 - rho ** 2, 0, 1) ** 0.8 + lumps * _smooth(1 - rho, 0.0, 0.25)
    rim = np.where(dist > LIP, lip + 1.2 - 1.6 * np.maximum(0, dist - 9.0),
                   lip + 1.2 - 4.0 * np.maximum(0, (LIP - dist) - 4.0))
    H = np.maximum(np.where(rho < 1, inside, -1e9), rim)
    f.H = np.maximum(H, PLAT_TOP)
    return f


def _rho(x, y):
    """Çuval ağzının süperelipsine göre uzaklık: 0 merkez, 1 dudak."""
    lx, ly = _local(SCALE_AT, SACK_ROT, x, y)
    return (np.abs(lx / SACK_A) ** SACK_N + np.abs(ly / SACK_B) ** SACK_N) ** (1 / SACK_N)


def heap_bed(field, inset=1.5):
    """Ağzı baştan sona dolduran alt katman: kırpıntıların arasından görünen, gölgedeki kumaş kütlesi.
    Yoksa örtülmeyen yerden çuvalın boş içi görünüyor, yığın havada asılı duruyordu."""
    keep = _rho(field.X, field.Y) < 0.985
    ny, nx = keep.shape
    idx = -np.ones(keep.shape, int)
    idx[keep] = np.arange(int(keep.sum()))
    V = np.column_stack([field.X[keep], field.Y[keep], field.H[keep] - inset])
    q = keep[:-1, :-1] & keep[:-1, 1:] & keep[1:, 1:] & keep[1:, :-1]
    j, i = np.nonzero(q)
    F = np.column_stack([idx[j, i], idx[j, i + 1], idx[j + 1, i + 1], idx[j + 1, i]])
    colours = sorted({c for fab in scraps.FABRICS.values() for c in fab[:2]})
    mat = lib.scrap_mass("HeapBed", colours, cell=45.0)
    return lib.mesh_from("HeapBed", [tuple(p) for p in V], [tuple(f) for f in F], mat)


def heap(seed=8, count=HEAP_COUNT, sizes=(55, 125), crumple=2.5, rho_max=0.92, gap=30.0):
    """Çuval ağzındaki yığın. Döner: {"objects", "field", "bed"} (ölçüm betikleri alanı da kullanır)."""
    field = heap_field(seed)
    bed = heap_bed(field)
    region = (SCALE_AT[0] - 240, SCALE_AT[1] - 240, SCALE_AT[0] + 240, SCALE_AT[1] + 240)
    placed = []

    # Kırpıntı ağzın her yerine eşit dağılır (geniş yayılım, kabulü ağız belirler) ve dudaktan biraz taşabilir;
    # merkezler birbirine gap mm'den yaklaşmaz. Merkezde toplanınca üst üste binip dikleşiyordu.
    def inside(c, W):
        if _rho(*c) >= rho_max or float(np.max(_rho(W[:, 0], W[:, 1]))) >= 1.15:
            return False
        if placed and min(math.hypot(c[0] - p[0], c[1] - p[1]) for p in placed) < gap:
            return False
        placed.append(c)
        return True

    objs = scraps.heap(seed, field, region, count, sizes=sizes, spread=(400, 400), mesh_step=1.0, crumple=crumple,
                       accept=inside)
    return {"objects": objs, "field": field, "bed": bed}


# --- Beyan etiketi ---

def tag(geo, along=-0.36, drop=95.0, seed=4):
    """Manşete iple bağlı kraft etiket. Basılı form çizgileri var, rakam yok (D-011)."""
    R, Nrm, U, sd = geo["ring"], geo["normal"], geo["u"], geo["seed"]
    # Kameraya bakan geniş yüzde (yerel −Y) bir nokta: halkada x ≈ along·A ve y < 0.
    k = int(np.argmin(np.abs(R[:, 0] - along * SACK_A) + 1e3 * (R[:, 1] > 0)))
    p, n = R[k], Nrm[k]
    hole_z = SACK_H - CUFF - drop + 98.0  # etiketin delik merkezi (etiket yereli y = 98)
    z_top, z_bot = hole_z + 12.0, hole_z - 98.0
    lean = max(_body(U[k], z, sd) for z in np.linspace(z_bot, z_top, 12)) + 1.5
    base = Vector((p[0] + n[0] * lean, p[1] + n[1] * lean, z_bot))
    # Etiket yereli: X yatay teğet, Y yukarı, Z dışa normal.
    nz = Vector((n[0], n[1], 0.0)).normalized()
    ny = Vector((0.0, 0.0, 1.0))
    nx = ny.cross(nz)
    rot = Matrix.Rotation(math.radians(7), 3, nz)  # hafif yatık asılı
    basis = Matrix((nx, ny, nz)).transposed() @ rot
    paper = lib.kraft("TagKraft", "Isabella Color", "Maple", "Ivory Buff", unit=1.0)
    ink = lib.plastic("TagInk", "Black", rough=0.55)
    ring_mat = lib.paper("TagRing", "Ivory Buff", scale=0.5)
    outline = [(-27.5, 0), (27.5, 0), (27.5, 98), (15.5, 110), (-15.5, 110), (-27.5, 98)]
    parts = [scraps._slab("Tag", outline, 0.35, paper, bevel=0.1, z0=0.0)]
    parts.append(scraps._ring("TagEyelet", (0, 98), (7.5, 7.5), (3.2, 3.2), 0.25, ring_mat, z0=0.35, n=48, bevel=0.1))
    # Form: başlık bandı ve iki doldurma satırı. Dört satırla uzaktan cetvel gibi okunuyordu.
    blocks = [(0, 80, 46, 12)]
    for y in (56, 36):
        blocks += [(-16, y, 14, 3.2), (9, y - 1.6, 26, 0.7)]
    for k2, (x, y, w, hgt) in enumerate(blocks):
        parts.append(lib.box(f"TagInk{k2}", (w, hgt, 0.04), (x, y, 0.37), ink))
    root = lib.empty("TagRoot")
    sack_m = Matrix.Translation((SCALE_AT[0], SCALE_AT[1], PLAT_TOP)) @ Matrix.Rotation(SACK_ROT, 4, "Z")
    root.matrix_world = sack_m @ Matrix.Translation(base) @ basis.to_4x4()
    for o in parts:
        o.parent = root
    # İp: delikten iki kol halinde manşetin serbest kenarına, oradan manşetin içine.
    strands = []
    hole = Vector((0, 98, 0.6))
    for side in (-1, 1):
        cuff_z = SACK_H - CUFF
        top_local = Vector((side * 7.0, 98.0 + (cuff_z + 14 - hole_z), -1.0))
        tuck = Vector((side * 9.0, 98.0 + (cuff_z + 22 - hole_z), -2.0 - 2 * LIP))
        pts = [hole + Vector((side * 1.2, 0, 0)), (hole + top_local) / 2 + Vector((side * 1.5, 0, 1.2)), top_local, tuck]
        P = _spline(np.array([tuple(root.matrix_world @ v) for v in pts]), 40)
        strands.append((P, np.full(len(P), 0.7)))
    twine = lib.fibre_hair("Twine", ["Isabella Color", "Ecru"], rough=0.6, var=0.2)
    lib.curves("TagString", strands, twine)
    return root


def station():
    """Tartım köşesi: kantar, çuval, ağızdaki yığın ve beyan etiketi."""
    platform_scale()
    _, geo = sack()
    heap()
    tag(geo)
