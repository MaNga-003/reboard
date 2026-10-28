# Kesim masası (birim mm): denim şeridin çevresine serilmiş kumaş kırpıntıları, makas, tebeşir, toplu iğneler.
# 1. ve 2. bölüm aynı masayı kurar; 1. bölümde arka planda bulanık durur, 2. bölümde kamera geri çekilince açılır.
import math

import numpy as np

import lib

TAU = 2 * math.pi

# Kumaşlar: (çözgü, atkı, dimi adımı (0: bezayağı), iplik aralığı (mm), kalınlık (mm)).
# Wada kombinasyonları 126, 199 ve 279'dan: indigo, ekru, toprak tonları.
FABRICS = {
    "denim": ("Deep Lyons Blue", "Ecru", 3, (0.5, 0.6), 0.75),
    "denim_dark": ("Dark Tyrian Blue", "Ecru", 3, (0.45, 0.55), 0.8),
    "canvas": ("Ecru", "Ecru", 0, (0.45, 0.45), 0.6),
    "sienna": ("Raw Sienna", "Raw Sienna", 3, (0.35, 0.4), 0.5),
    "cinnamon": ("Vinaceous Cinnamon", "Vinaceous Cinnamon", 0, (0.3, 0.3), 0.45),
    "ocher": ("Yellow Ocher", "Yellow Ocher", 0, (0.4, 0.4), 0.5),
    "ochre_red": ("Ochre Red", "Ochre Red", 3, (0.4, 0.45), 0.55),
    "olive": ("Light Brownish Olive", "Light Brownish Olive", 3, (0.4, 0.45), 0.6),
    "ivory": ("Ivory Buff", "Ivory Buff", 0, (0.25, 0.25), 0.35),
}


# --- Yükseklik alanı: üstteki kumaş alttakinin kenarından yumuşakça aşar ---

def _shift_max(A, r, axis):
    out = A.copy()
    for k in range(1, r + 1):
        out = np.maximum(out, np.roll(A, k, axis))
        out = np.maximum(out, np.roll(A, -k, axis))
    return out


def _box(A, r, axis):
    c = np.cumsum(np.pad(A, [(r + 1, r) if a == axis else (0, 0) for a in range(2)], mode="edge"), axis=axis)
    hi = np.take(c, np.arange(2 * r + 1, c.shape[axis]), axis=axis)
    lo = np.take(c, np.arange(0, c.shape[axis] - 2 * r - 1), axis=axis)
    return (hi - lo) / (2 * r + 1)


class Field:
    def __init__(self, x0, y0, x1, y1, h=0.5):
        self.x0, self.y0, self.h = x0, y0, h
        self.nx = int((x1 - x0) / h) + 1
        self.ny = int((y1 - y0) / h) + 1
        self.H = np.zeros((self.ny, self.nx))
        xs = x0 + np.arange(self.nx) * h
        ys = y0 + np.arange(self.ny) * h
        self.X, self.Y = np.meshgrid(xs, ys)

    def sample(self, A, x, y):
        fx = np.clip((np.asarray(x) - self.x0) / self.h, 0, self.nx - 1.001)
        fy = np.clip((np.asarray(y) - self.y0) / self.h, 0, self.ny - 1.001)
        i, j = fx.astype(int), fy.astype(int)
        u, v = fx - i, fy - j
        return (A[j, i] * (1 - u) * (1 - v) + A[j, i + 1] * u * (1 - v)
                + A[j + 1, i] * (1 - u) * v + A[j + 1, i + 1] * u * v)

    def under(self, r_mm=2.0):
        """Üste serilecek kumaşın oturacağı yüzey: alttakiler genişletilip yumuşatılır."""
        r = max(1, int(r_mm / self.h))
        D = _shift_max(_shift_max(self.H, r, 0), r, 1)
        for _ in range(2):
            D = _box(_box(D, r, 0), r, 1)
        return np.maximum(D, self.H)


def _inside(poly, x, y):
    ok = np.ones(np.shape(x), bool)
    n = len(poly)
    for k in range(n):
        ax, ay = poly[k]
        bx, by = poly[(k + 1) % n]
        ok &= (bx - ax) * (y - ay) - (by - ay) * (x - ax) >= -1e-9
    return ok


def _clip(cell, poly):
    """Sutherland–Hodgman: hücreyi dışbükey çokgenle kırp."""
    out = cell
    n = len(poly)
    for k in range(n):
        if not out:
            break
        ax, ay = poly[k]
        bx, by = poly[(k + 1) % n]
        inp, out = out, []

        def side(p):
            return (bx - ax) * (p[1] - ay) - (by - ay) * (p[0] - ax)

        for i in range(len(inp)):
            p, q = inp[i], inp[(i + 1) % len(inp)]
            sp, sq = side(p), side(q)
            if sp >= 0:
                out.append(p)
            if (sp >= 0) != (sq >= 0):
                t = sp / (sp - sq)
                out.append((p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t))
    return out


def convex_shape(rs, size, sides=None, arc=0.35):
    """Kesim artığı biçimi: düz kenarlı dışbükey çokgen, bir kenarı kalıp eğrisi gibi kavisli (CCW)."""
    k = sides or int(rs.integers(4, 7))
    ang = np.sort(rs.uniform(0, TAU, k))
    gaps = np.diff(np.concatenate([ang, [ang[0] + TAU]]))
    while gaps.max() > math.pi * 0.95:
        ang = np.sort(rs.uniform(0, TAU, k))
        gaps = np.diff(np.concatenate([ang, [ang[0] + TAU]]))
    rx, ry = size / 2, size / 2 * rs.uniform(0.45, 0.9)
    pts = [(rx * math.cos(a), ry * math.sin(a)) for a in ang]
    if arc and rs.random() < 0.7:
        e = int(rs.integers(0, k))
        (ax, ay), (bx, by) = pts[e], pts[(e + 1) % k]
        mx, my = (ax + bx) / 2, (ay + by) / 2
        L = math.hypot(bx - ax, by - ay)
        nx, ny = (by - ay) / L, -(bx - ax) / L  # dışa dik (CCW için sağ)
        bulge = L * arc * rs.uniform(0.15, 0.3)
        arcpts = []
        for t in np.linspace(0, 1, 14)[1:-1]:
            b = bulge * math.sin(math.pi * t)
            arcpts.append((ax + (bx - ax) * t + nx * b, ay + (by - ay) * t + ny * b))
        pts = pts[:e + 1] + arcpts + pts[e + 1:]
    return pts


def _densify(poly, step):
    out = []
    n = len(poly)
    for k in range(n):
        a, b = np.array(poly[k]), np.array(poly[(k + 1) % n])
        m = max(1, int(np.linalg.norm(b - a) / step))
        for t in np.arange(m) / m:
            out.append(a + (b - a) * t)
    return np.array(out)


class Scrap:
    def __init__(self, fabric, center, angle, shape, waves, fold=None):
        self.fabric, self.center, self.angle, self.shape = fabric, np.array(center), angle, shape
        self.waves, self.fold = waves, fold

    def world(self, P):
        c, s = math.cos(self.angle), math.sin(self.angle)
        P = np.asarray(P)
        return np.stack([self.center[0] + c * P[..., 0] - s * P[..., 1],
                         self.center[1] + s * P[..., 0] + c * P[..., 1]], axis=-1)

    def relief(self, lx, ly):
        """Kumaşın kendi dalgası ve varsa bir kırışık (yerel koordinat, hep ≥ 0)."""
        z = np.zeros(np.shape(lx))
        for amp, kx, ky, ph in self.waves:
            z += amp * (1 + np.sin(lx * kx + ly * ky + ph)) / 2
        if self.fold:
            (px, py), (dx, dy), amp, w = self.fold
            d = (lx - px) * (-dy) + (ly - py) * dx
            z += amp * np.exp(-(d / w) ** 2)
        return z


def drop(field, scrap):
    """Kırpıntıyı alana bırakır; üst yüzey işlevini döndürür (dünya x, y → z)."""
    t = FABRICS[scrap.fabric][4]
    G = field.under()
    poly_w = scrap.world(scrap.shape)
    # Yerel → dünya: rölyef yerel koordinatta, alan dünya koordinatında.
    c, s = math.cos(scrap.angle), math.sin(scrap.angle)

    def surf(xw, yw):
        dx, dy = np.asarray(xw) - scrap.center[0], np.asarray(yw) - scrap.center[1]
        lx, ly = c * dx + s * dy, -s * dx + c * dy
        return field.sample(G, xw, yw) + t + scrap.relief(lx, ly)

    mask = _inside(poly_w, field.X, field.Y)
    Z = surf(field.X, field.Y)
    field.H = np.where(mask, np.maximum(field.H, Z), field.H)
    return surf, G


def scrap_mesh(name, scrap, surf, mat, h=0.6):
    """Kırpılmış ızgara üst yüzey + düz gölgeli kesik kenar (ayrı köşeler: kenarın normali yüzeyi bozmasın)."""
    poly = scrap.shape
    xs = np.array([p[0] for p in poly])
    ys = np.array([p[1] for p in poly])
    gx = np.arange(xs.min() - h, xs.max() + h, h)
    gy = np.arange(ys.min() - h, ys.max() + h, h)
    GX, GY = np.meshgrid(gx, gy)
    ins = _inside(poly, GX, GY)
    verts, index, faces = [], {}, []

    def vid(p):
        key = (round(p[0] * 1e4), round(p[1] * 1e4))
        if key not in index:
            index[key] = len(verts)
            verts.append(p)
        return index[key]

    for j in range(len(gy) - 1):
        for i in range(len(gx) - 1):
            c4 = ins[j, i], ins[j, i + 1], ins[j + 1, i + 1], ins[j + 1, i]
            cell = [(gx[i], gy[j]), (gx[i + 1], gy[j]), (gx[i + 1], gy[j + 1]), (gx[i], gy[j + 1])]
            if all(c4):
                faces.append([vid(p) for p in cell])
            else:
                cl = _clip(cell, poly)
                if len(cl) >= 3:
                    ids = []
                    for p in cl:
                        v = vid(p)
                        if not ids or ids[-1] != v:
                            ids.append(v)
                    if len(ids) > 2 and ids[0] == ids[-1]:
                        ids.pop()
                    if len(set(ids)) >= 3:
                        faces.append(ids)
    L = np.array(verts)
    W = scrap.world(L)
    Z = surf(W[:, 0], W[:, 1])
    top = np.column_stack([L, Z])
    # Kenar: yerel koordinatta, ayrı köşelerle.
    t = FABRICS[scrap.fabric][4]
    ring = _densify(poly, 0.3)
    Wr = scrap.world(ring)
    zr = surf(Wr[:, 0], Wr[:, 1])
    n0 = len(top)
    m = len(ring)
    rim_v = np.concatenate([np.column_stack([ring, zr]), np.column_stack([ring, zr - t])])
    rim_f = [(n0 + k, n0 + m + k, n0 + m + (k + 1) % m, n0 + (k + 1) % m) for k in range(m)]
    V = np.concatenate([top, rim_v])
    o = lib.mesh_from(name, [tuple(p) for p in V], faces + rim_f, mat)
    for p in o.data.polygons[len(faces):]:
        p.use_smooth = False
    o.location = (scrap.center[0], scrap.center[1], 0.0)
    o.rotation_euler = (0.0, 0.0, scrap.angle)
    # Object koordinatı yerel olsun diye köşeler yerelde; z dünya yüksekliği (konum z = 0).
    return o


def fray(rs, scrap, surf, G, field, density=0.55, r_f=0.0068):
    """Kesik kenardan taşan lifler: dışa doğru, alttaki yüzeye yatar."""
    t = FABRICS[scrap.fabric][4]
    ring = _densify(scrap.shape, 0.1)
    m = len(ring)
    nxt = np.roll(ring, -1, axis=0)
    tang = nxt - ring
    tang /= np.linalg.norm(tang, axis=1, keepdims=True) + 1e-12
    out_n = np.stack([tang[:, 1], -tang[:, 0]], axis=1)
    strands = []
    for k in np.nonzero(rs.random(m) < density)[0]:
        a = rs.normal(0, 0.55)
        d = out_n[k] * math.cos(a) + tang[k] * math.sin(a)
        L = float(np.clip(rs.lognormal(math.log(0.45), 0.6), 0.08, 2.6))
        n = max(5, int(L / 0.04))
        s = np.linspace(0, 1, n)
        p0 = ring[k] - out_n[k] * 0.12
        bend = rs.normal(0, 0.9)
        perp = np.array([-d[1], d[0]])
        xy = p0[None] + (s * L)[:, None] * d[None] + (bend * L * 0.25 * s ** 2)[:, None] * perp[None]
        xy += 0.012 * np.stack([np.sin(s * L * TAU * 4.2 + rs.uniform(0, TAU)),
                                np.sin(s * L * TAU * 3.6 + rs.uniform(0, TAU))], axis=1)
        W = scrap.world(xy)
        z_top = surf(W[0, 0], W[0, 1]) - t * rs.uniform(0.15, 0.6)
        z_rest = field.sample(G, W[:, 0], W[:, 1]) + r_f * 1.2
        fall = np.clip(s * 1.6, 0, 1) ** 2 * (3 - 2 * np.clip(s * 1.6, 0, 1))
        z = z_top * (1 - fall) + np.maximum(z_rest, z_top - t * 1.2) * fall
        z = np.maximum(z, z_rest)
        P = np.column_stack([W, z])
        rad = np.full(n, r_f)
        rad[-3:] *= np.linspace(1.0, 0.4, 3)
        strands.append((P, rad, float(rs.random())))
    return strands


def layout(rs, keep_out, count=14, region=(-135, -125, 155, 115), bias=(55, 35), sizes=(38, 105), spread=(70, 55)):
    """Kırpıntı yerleşimi: denim şeridin çevresi boş kalır; yoğunluk arka tarafa (bias) kayar."""
    scraps = []
    names = list(FABRICS)
    order = ["denim", "canvas", "sienna", "denim_dark", "ocher", "cinnamon", "olive", "ochre_red", "ivory",
             "denim", "canvas", "sienna", "olive", "denim_dark", "cinnamon", "ocher"]
    tries = 0
    while len(scraps) < count and tries < 4000:
        tries += 1
        size = rs.uniform(*sizes)
        cx = np.clip(rs.normal(bias[0], spread[0]), region[0] + size / 3, region[2] - size / 3)
        cy = np.clip(rs.normal(bias[1], spread[1]), region[1] + size / 3, region[3] - size / 3)
        ang = rs.uniform(0, TAU)
        shape = convex_shape(rs, size)
        sc = Scrap(order[len(scraps) % len(order)] if order else names[0], (cx, cy), ang, shape, [])
        W = sc.world(_densify(shape, 1.0))
        kx0, ky0, kx1, ky1 = keep_out
        if np.any((W[:, 0] > kx0) & (W[:, 0] < kx1) & (W[:, 1] > ky0) & (W[:, 1] < ky1)):
            continue
        # Şeridi çevreleyen kutunun içine düşen kırpıntı da olmasın (tam içeride kalanı kenar denetimi yakalamaz).
        if kx0 < cx < kx1 and ky0 < cy < ky1:
            continue
        waves = [(rs.uniform(0.25, 1.1), rs.normal(0, 0.18), rs.normal(0, 0.18), rs.uniform(0, TAU)) for _ in range(3)]
        fold = None
        if rs.random() < 0.45:
            dirn = rs.normal(0, 1, 2)
            dirn /= np.linalg.norm(dirn)
            fold = ((rs.uniform(-size / 5, size / 5), rs.uniform(-size / 6, size / 6)), tuple(dirn),
                    rs.uniform(1.2, 3.2), rs.uniform(1.6, 3.5))
        sc.waves, sc.fold = waves, fold
        scraps.append(sc)
    return scraps


# --- Masadaki araçlar ---

def _slab(name, outline, th, mat, bevel=0.6, z0=0.0, segments=3):
    """Düz biçimden kalınlık verilmiş parça (kenarları yuvarlatılmış)."""
    area = sum(outline[k][0] * outline[(k + 1) % len(outline)][1] - outline[(k + 1) % len(outline)][0] * outline[k][1]
               for k in range(len(outline)))
    if area < 0:
        outline = outline[::-1]  # yüz normali yukarı: kalınlık yukarı doğru eklensin
    V = [(x, y, z0) for x, y in outline]
    o = lib.mesh_from(name, V, [list(range(len(V)))], mat, smooth_shade=False)
    so = o.modifiers.new("Solid", "SOLIDIFY")
    so.thickness = th
    so.offset = 1.0
    so.use_even_offset = True
    if bevel:
        bv = o.modifiers.new("Bevel", "BEVEL")
        bv.width = bevel
        bv.segments = segments
        bv.limit_method = "ANGLE"
        bv.harden_normals = True
    for p in o.data.polygons:
        p.use_smooth = True
    return o


def _ring(name, c, outer, inner, th, mat, z0=0.0, n=96, bevel=1.4):
    a = np.linspace(0, TAU, n, endpoint=False)
    o_pts = [(c[0] + outer[0] * math.cos(t), c[1] + outer[1] * math.sin(t), z0) for t in a]
    i_pts = [(c[0] + inner[0] * math.cos(t), c[1] + inner[1] * math.sin(t), z0) for t in a]
    faces = [(k, (k + 1) % n, n + (k + 1) % n, n + k) for k in range(n)]
    o = lib.mesh_from(name, o_pts + i_pts, faces, mat, smooth_shade=False)
    so = o.modifiers.new("Solid", "SOLIDIFY")
    so.thickness = th
    so.offset = 1.0
    bv = o.modifiers.new("Bevel", "BEVEL")
    bv.width = bevel
    bv.segments = 4
    bv.limit_method = "ANGLE"
    bv.harden_normals = True
    for p in o.data.polygons:
        p.use_smooth = True
    return o


def _parent(objs, loc, angle):
    # Yükseklik parçaların kendisinde (z0); kök yalnızca masa düzleminde konum ve dönüş taşır.
    root = lib.empty("ToolRoot", (loc[0], loc[1], 0.0))
    root.rotation_euler = (0.0, 0.0, angle)
    for o in objs:
        o.parent = root
    return root


def shears(loc, angle, open_deg=9.0, z=0.0):
    """Terzi makası (~235 mm): çelik bıçaklar, siyah kulplar. Pivot yerel orijinde, uçlar +X."""
    steel = lib.steel("ShearSteel", "Neutral Gray", rough=0.22, brushed=True, scale=0.05)
    black = lib.plastic("ShearGrip", "Black", rough=0.38, coat=0.25, wear=0.3, scale=0.05)
    xs = np.linspace(-12, 150, 60)
    edge = [(x, 0.0) for x in xs]
    back = [(x, 1.2 + 12.5 * (1 - max(x, 0) / 150) ** 0.85) for x in xs[::-1]]
    blade = edge + back
    objs = []
    for k, sgn in enumerate((1, -1)):
        pts = [(x, sgn * y) for x, y in blade]
        b = _slab(f"Blade{k}", pts, 2.2, steel, bevel=0.35, z0=z + 2.2 * k)
        b.rotation_euler = (0.0, 0.0, math.radians(open_deg / 2) * (1 if k else -1))
        objs.append(b)
        # Sap ve kulp: alt bıçağa büyük parmak kulpu, üstteki bıçağa başparmak kulpu.
        shank = [(-12, -4.5 * sgn), (-34, -9 * sgn), (-34, 9 * sgn), (-12, 6 * sgn)]
        s = _slab(f"Shank{k}", shank, 6.0, black, bevel=1.5, z0=z + 0.3 + 2.2 * k * 0.5)
        s.rotation_euler = b.rotation_euler
        objs.append(s)
        if k == 0:
            r = _ring("GripBig", (-62, -10), (32, 17), (24, 10), 7.0, black, z0=z + 0.3)
        else:
            r = _ring("GripThumb", (-50, 15), (17, 15), (10.5, 9), 7.0, black, z0=z + 1.4)
        r.rotation_euler = b.rotation_euler
        objs.append(r)
    objs.append(lib.cylinder("Pivot", 4.6, 6.4, (0, 0, z + 2.6), steel, verts=48, bevel=0.6))
    return _parent(objs, loc, angle)


def chalk(loc, angle, z=0.0, color="Pale King's Blue"):
    """Terzi tebeşiri: köşeleri aşınmış üçgen, 45 mm."""
    m, b, n = lib.principled("Chalk")
    b.inputs["Roughness"].default_value = 0.95
    nz = n.noise(n.coords(scale=(0.4,) * 3), 3.0, 8.0, 0.7)
    n.link(n.shade(lib.rgba(color), n.math("MULTIPLY_ADD", nz, 0.12, 0.92)), b.inputs["Base Color"])
    n.link(n.bump(n.noise(n.coords(scale=(3.0,) * 3), 2.0, 6.0, 0.6), 0.3, 0.05), b.inputs["Normal"])
    tri = []
    for k in range(3):
        a0 = TAU * k / 3 + math.pi / 2
        for d in np.linspace(-0.22, 0.22, 7):
            r = 26 - 30 * d * d
            tri.append((r * math.cos(a0 + d), r * math.sin(a0 + d)))
    o = _slab("Chalk", tri, 4.2, m, bevel=0.9, z0=z)
    return _parent([o], loc, angle)


def pins(rs, field, spots, heads=("Spectrum Red", "Blue", "Lemon Yellow", "Ivory Buff")):
    """Toplu iğneler: 32 mm çelik gövde, renkli küre baş; düştükleri yüzeye yaslanır."""
    steel = lib.steel("PinSteel", "Neutral Gray", rough=0.15, brushed=False)
    mats = {h: lib.plastic(f"PinHead_{h}", h, rough=0.12, coat=0.6) for h in heads}
    objs = []
    for k, (x, y, ang) in enumerate(spots):
        d = np.array([math.cos(ang), math.sin(ang)])
        p0, p1 = np.array([x, y]), np.array([x, y]) + d * 32
        z0 = field.sample(field.H, p0[0], p0[1]) + 1.8
        z1 = field.sample(field.H, p1[0], p1[1]) + 0.3
        mid = (p0 + p1) / 2
        L = math.hypot(32, z1 - z0)
        pitch = math.degrees(math.atan2(z0 - z1, 32))
        c = lib.cylinder(f"Pin{k}", 0.28, L, (mid[0], mid[1], (z0 + z1) / 2), steel,
                         rot=(0, 90 + pitch, math.degrees(ang)), verts=16)
        h = lib.sphere(f"PinHead{k}", 1.8, (p0[0], p0[1], z0), mats[heads[k % len(heads)]], 48, 24)
        objs += [c, h]
    return objs


def _rest(field, loc, angle, xr, half_w):
    """Katı bir aracın oturacağı yükseklik: izdüşümündeki en yüksek kumaş."""
    c, s = math.cos(angle), math.sin(angle)
    lx, ly = np.meshgrid(np.linspace(xr[0], xr[1], 60), np.linspace(-half_w, half_w, 12))
    wx = loc[0] + c * lx - s * ly
    wy = loc[1] + s * lx + c * ly
    return float(field.sample(field.H, wx, wy).max())


def cutting_table(seed=5):
    res = build(seed)
    field = res["field"]
    rs = np.random.default_rng(seed + 100)
    sh_loc, sh_ang = (112.0, -38.0), math.radians(112)
    shears(sh_loc, sh_ang, z=_rest(field, sh_loc, sh_ang, (-95, 150), 22))
    ch_loc, ch_ang = (-78.0, 52.0), 0.4
    chalk(ch_loc, ch_ang, z=_rest(field, ch_loc, ch_ang, (-26, 26), 26))
    pins(rs, field, [(30.0, 16.0, 0.5), (-50.0, -40.0, 2.4), (74.0, 56.0, 4.0)])
    return res


def build(seed=5, keep_out=(-33, -30, 33, 12), count=14):
    """Kırpıntıları kurar. Döner: {"field", "objects", "scraps"}."""
    rs = np.random.default_rng(seed)
    field = Field(-180, -170, 200, 160, h=0.5)
    # Denim şeridin yeri alanda dolu sayılır (makas ve iğneler onun üstüne düşerse otursun).
    kx0, ky0, kx1, ky1 = -25.2, -20.4, 25.2, 0.0
    m = (field.X > kx0) & (field.X < kx1) & (field.Y > ky0) & (field.Y < ky1)
    field.H[m] = 0.62
    objs = []
    fray_by = {}
    for k, sc in enumerate(layout(rs, keep_out, count)):
        warp, weft, twill, pitch, _ = FABRICS[sc.fabric]
        mat = lib.fabric(f"Fab_{sc.fabric}_{k}", warp, weft, pitch=pitch, twill=twill, fuzz=0.7, var=0.14, bump=0.5)
        surf, G = drop(field, sc)
        objs.append(scrap_mesh(f"Scrap_{k}_{sc.fabric}", sc, surf, mat))
        fray_by.setdefault(sc.fabric, []).extend(fray(rs, sc, surf, G, field))
    for fab, strands in fray_by.items():
        warp, weft = FABRICS[fab][:2]
        mat = lib.fibre_hair(f"Fray_{fab}", [warp, weft] if warp != weft else [warp], var=0.25)
        objs.append(lib.curves(f"Fray_{fab}", strands, mat))
    return {"field": field, "objects": objs}


def heap(seed, field, region, count, sizes=(60, 150), spread=(80, 60), mesh_step=1.0):
    """Hazır bir yükseklik alanına (ör. çuval ağzındaki tümsek) kırpıntı yığar. Uzak plan için: saçak lifi yok,
    ızgara daha seyrek. Döner: nesneler."""
    rs = np.random.default_rng(seed)
    cx, cy = (region[0] + region[2]) / 2, (region[1] + region[3]) / 2
    far = (1e9, 1e9, 1e9 + 1, 1e9 + 1)
    objs = []
    for k, sc in enumerate(layout(rs, far, count, region, (cx, cy), sizes, spread)):
        warp, weft, twill, pitch, _ = FABRICS[sc.fabric]
        mat = lib.fabric(f"Heap_{sc.fabric}_{k}", warp, weft, pitch=pitch, twill=twill, fuzz=0.7, var=0.14, bump=0.5)
        surf, _ = drop(field, sc)
        objs.append(scrap_mesh(f"Heap_{k}_{sc.fabric}", sc, surf, mat, h=mesh_step))
    return objs
