# Lif düzeyinde dokuma kumaş: her iplik tek tek liflerden bükülür (birim mm).
# 1. ve 2. bölüm aynı şeridi kullanır; böylece bölüm sınırındaki kesme kesintisiz görünür.
import math

import numpy as np

import lib

TAU = 2 * math.pi


class Denim:
    """2/1 dimi (denim). Çözgü Y, atkı X yönünde; kesik kenar y=0'da, saçak +Y'ye uzanır."""

    def __init__(self, length=50.0, width=20.0, pw=0.5, pf=0.6, seed=11):
        self.length, self.width = length, width
        self.pw, self.pf = pw, pf
        self.rh_w, self.rv_w = 0.23, 0.15  # çözgü kesiti (yatay, dikey yarıçap)
        self.rh_f, self.rv_f = 0.27, 0.15  # atkı kesiti
        self.crimp = 0.13
        self.z_mid = 0.31
        self.r_fibre = 0.0068  # pamuk lifi ~14 µm
        self.twist_w, self.twist_f = 1.7, 3.2  # bir tur için iplik boyu (mm); atkı açık uçlu, daha az bükümlü
        self.seed = seed
        self.rs = np.random.default_rng(seed)
        self.n_warp = int(length / pw)
        self.n_weft = int(width / pf)
        self.x0 = -(self.n_warp - 1) * pw / 2
        self.hero = self.n_warp // 2
        self.fringe = self.rs.uniform(1.4, 3.6, self.n_warp)
        # Saçakta bazı iplikler kısa kopmuş, bazıları uzun kalmış.
        short = self.rs.random(self.n_warp) < 0.18
        self.fringe[short] = self.rs.uniform(0.3, 1.0, short.sum())
        self.fringe[self.hero] = 2.4
        # Kahraman lifinin çevresi açık kalsın: komşu saçaklar kısa.
        self.fringe[self.hero - 2:self.hero + 3] = np.minimum(self.fringe[self.hero - 2:self.hero + 3], [2.2, 1.7, 2.4, 1.5, 2.0])
        self.fan = np.radians(self.rs.normal(0, 3.5, self.n_warp))
        self.und = self.rs.uniform(0, TAU, 4)

    # --- yardımcılar ---
    def warp_x(self, i):
        return self.x0 + i * self.pw

    def weft_y(self, j):
        return -self.pf / 2 - j * self.pf

    @staticmethod
    def over(i, j):
        """Çözgü i, atkı j kesişiminde üstte mi: 2 üst 1 alt, her çözgüde bir kayma (diyagonal)."""
        return np.where(np.mod(np.asarray(i) + np.asarray(j), 3) != 0, 1.0, -1.0)

    def undulation(self, x, y):
        # Masaya serili kumaşın hafif dalgası; kesik kenarda sıfır, içe doğru artar.
        p = self.und
        amp = 0.28 * np.clip(-y / 5.0, 0, 1) ** 2
        w = (1 + np.sin(x * 0.21 + p[0]) * np.sin(y * 0.33 + p[1])) / 2
        w2 = (1 + np.sin(x * 0.53 + p[2] + y * 0.2)) / 2
        return amp * (0.7 * w + 0.3 * w2)

    def detail(self, dist):
        """Kahraman lifine uzaklığa göre ayrıntı: (lif sayısı, örnek aralığı)."""
        if dist < 6:
            return 130, 0.035
        if dist < 13:
            return 80, 0.06
        return 40, 0.11


def _frames(P):
    T = np.gradient(P, axis=0)
    T /= np.linalg.norm(T, axis=1, keepdims=True) + 1e-12
    N = np.cross(T, np.array([0.0, 0.0, 1.0]))
    N /= np.linalg.norm(N, axis=1, keepdims=True) + 1e-12
    B = np.cross(N, T)
    return T, N, B


def _wobble(rs, s, amp, count, freqs=(0.35, 0.9, 2.2)):
    """count adet düzgün rastgele işlev; (count, len(s))."""
    out = np.zeros((count, len(s)))
    for f in freqs:
        k = rs.uniform(0.7, 1.3, (count, 1)) * f * TAU
        ph = rs.uniform(0, TAU, (count, 1))
        out += np.sin(s[None, :] * k + ph) / f
    return out * amp / sum(1 / f for f in freqs)


def _smooth(t):
    t = np.clip(t, 0, 1)
    return t * t * (3 - 2 * t)


def _yarn_fibres(rs, C, s, rh, rv, n_f, twist, r_f, fringe_s=None, fringe_len=1.0, inner_frac=0.0, yarn=0.5):
    """İplik merkez eğrisi C boyunca bükülmüş lifler. Saçakta büküm çözülür, lifler açılır, uçlar dağılır.
    Döner: [(dış|iç, noktalar, yarıçaplar)]."""
    T, Nv, Bv = _frames(C)
    n = len(s)
    th0 = rs.uniform(0, TAU, n_f)
    rho = np.sqrt(rs.uniform(0.25, 1.0, n_f))
    if fringe_s is None:
        u = np.zeros(n)
    else:
        u = np.clip((s - fringe_s) / fringe_len, 0, 1)
    ds = np.gradient(s)
    rate = TAU / twist * (1 - 0.8 * u)
    phase = np.cumsum(rate * ds)
    theta = th0[:, None] + phase[None, :]
    spread = 1 + rs.uniform(0.6, 3.8, (n_f, 1)) * u[None, :] ** 1.5
    # Pamuk ipliği düzensizdir: boyunca kalınlaşır, incelir (slub); lifler de tam sarmal izlemez.
    slub = 1 + _wobble(rs, s, 0.14, 1, (0.12, 0.35, 0.8))
    jitter = (1 + _wobble(rs, s, 0.2, n_f)) * slub
    rad_h = rho[:, None] * rh * spread * jitter
    rad_v = rho[:, None] * rv * (1 + 0.35 * (spread - 1)) * jitter
    P = (C[None] + (rad_h * np.cos(theta))[..., None] * Nv[None] + (rad_v * np.sin(theta))[..., None] * Bv[None])
    if fringe_s is not None:
        drift = np.stack([_wobble(rs, s, 0.5, n_f, (0.4, 1.1)), _wobble(rs, s, 0.5, n_f, (0.4, 1.1)),
                          _wobble(rs, s, 0.08, n_f, (0.6, 1.5))], axis=-1)
        P += drift * (u[None, :, None] ** 2)
        # Pamuk lifi serbest kalınca kısa dalgalarla kıvrılır (~4 kıvrım/mm); düz erişte gibi durmaz.
        kink = np.stack([_wobble(rs, s, 0.016, n_f, (2.6, 5.2)), _wobble(rs, s, 0.016, n_f, (2.6, 5.2)),
                         _wobble(rs, s, 0.009, n_f, (3.1, 6.0))], axis=-1)
        P += kink * (u[None, :, None] ** 0.7)
    P[..., 2] = np.maximum(P[..., 2], r_f * 1.15)
    ends = np.full(n_f, n)
    if fringe_s is not None:
        tip = fringe_s + fringe_len * (0.62 + 0.38 * rs.random(n_f) ** 0.6)
        ends = np.searchsorted(s, tip)
    out = []
    for k in range(n_f):
        e = max(2, ends[k])
        rad = np.full(e, r_f)
        # Lif ucu incelir.
        taper = min(e, 6)
        rad[-taper:] *= np.linspace(1.0, 0.35, taper)
        outer = rho[k] > inner_frac
        out.append((outer, P[k, :e], rad, yarn))
    return out


def _hairs(rs, C, s, rh, rv, count, r_f, lo, hi, yarn=0.5):
    """İplikten dışarı taşan lif uçları (tüylülük)."""
    T, Nv, Bv = _frames(C)
    res = []
    idx = rs.integers(int(lo), int(hi), count)
    for i in idx:
        th = rs.uniform(-0.2, math.pi + 0.2)
        radial = np.cos(th) * Nv[i] + np.sin(th) * Bv[i]
        start = C[i] + radial * np.array([rh, rh, rv]).mean() * 0.95
        sgn = 1 if rs.random() < 0.5 else -1
        d = radial * rs.uniform(0.25, 0.7) + T[i] * sgn
        d /= np.linalg.norm(d)
        length = rs.uniform(0.2, 1.1) ** 1.3
        m = max(4, int(length / 0.03))
        pts = [start]
        bend = rs.normal(0, 0.8, 3)
        for _ in range(m - 1):
            d = d + np.cross(d, bend) * 0.03 + rs.normal(0, 0.025, 3)
            d /= np.linalg.norm(d)
            nxt = pts[-1] + d * length / m
            nxt[2] = max(nxt[2], r_f * 1.15)
            pts.append(nxt)
        P = np.array(pts)
        rad = np.full(m, r_f)
        rad[-4:] *= np.linspace(1.0, 0.35, 4)
        res.append((P, rad, yarn))
    return res


def _ribbon(name, P, mat, half_w=0.0105, half_t=0.0036, ring=16):
    """Pamuk lifi: içi çökmüş tüp (yassı şerit), ~5 kıvrım/mm, yönü aralıklarla döner; uç incelir."""
    T, Nv, Bv = _frames(P)
    seg = np.linalg.norm(np.diff(P, axis=0), axis=1)
    s = np.concatenate([[0], np.cumsum(seg)])
    rate = TAU * 2.4 * np.tanh(3 * np.sin(TAU * s / 1.15 + 0.7))
    phi = np.cumsum(rate * np.gradient(s))
    taper = np.clip((s[-1] - s) / 0.14, 0.18, 1) ** 0.7
    t = np.linspace(0, TAU, ring, endpoint=False)
    cx = half_w * np.cos(t)
    cy = half_t * np.sin(t) * (0.5 + 0.5 * np.abs(np.cos(t)))
    ca, sa = np.cos(phi)[:, None], np.sin(phi)[:, None]
    a = (cx[None] * ca - cy[None] * sa) * taper[:, None]
    b = (cx[None] * sa + cy[None] * ca) * taper[:, None]
    V = P[:, None, :] + a[..., None] * Nv[:, None, :] + b[..., None] * Bv[:, None, :]
    n = len(P)
    faces = [(i * ring + k, i * ring + (k + 1) % ring, (i + 1) * ring + (k + 1) % ring, (i + 1) * ring + k)
             for i in range(n - 1) for k in range(ring)]
    tip = n * ring
    verts = [tuple(p) for p in V.reshape(-1, 3)] + [tuple(P[-1] + T[-1] * 0.004)]
    faces += [((n - 1) * ring + k, (n - 1) * ring + (k + 1) % ring, tip) for k in range(ring)]
    o = lib.mesh_from(name, verts, faces, mat)
    uv = o.data.uv_layers.new(name="UVMap")
    vidx = np.zeros(len(o.data.loops), dtype=np.int64)
    o.data.loops.foreach_get("vertex_index", vidx)
    si = np.where(vidx < tip, vidx // ring, n - 1)
    ki = np.where(vidx < tip, vidx % ring, 0)
    uv.data.foreach_set("uv", np.stack([s[si], ki / ring], axis=1).ravel())
    return o


def _tube(C, rh, rv, scale, ring=10):
    """Elips kesitli iplik çekirdeği (lif aralarından görünen derinlik)."""
    T, Nv, Bv = _frames(C)
    a = np.linspace(0, TAU, ring, endpoint=False)
    V = (C[:, None, :] + (rh * scale)[:, None, None] * np.cos(a)[None, :, None] * Nv[:, None, :]
         + (rv * scale)[:, None, None] * np.sin(a)[None, :, None] * Bv[:, None, :])
    n = len(C)
    faces = []
    for i in range(n - 1):
        for k in range(ring):
            k2 = (k + 1) % ring
            faces.append((i * ring + k, i * ring + k2, (i + 1) * ring + k2, (i + 1) * ring + k))
    return V.reshape(-1, 3), faces


class _MeshAcc:
    def __init__(self):
        self.v, self.f, self.off = [], [], 0

    def add(self, V, F):
        self.v.append(V)
        self.f.extend(tuple(x + self.off for x in q) for q in F)
        self.off += len(V)

    def build(self, name, mat):
        V = np.concatenate(self.v) if self.v else np.zeros((0, 3))
        return lib.mesh_from(name, [tuple(p) for p in V], self.f, mat)


def build(spec, colours, hero_extra=2.6):
    """colours: {"warp", "warp_inner", "weft": Wada ad listeleri; "warp_core", "weft_core": Wada adı}. Döner: meta."""
    rs = spec.rs
    r_f = spec.r_fibre
    strands = {"warp": [], "warp_inner": [], "weft": []}
    cores = {"warp": _MeshAcc(), "weft": _MeshAcc()}
    hero_x = spec.warp_x(spec.hero)
    meta = {}

    for i in range(spec.n_warp):
        x_i = spec.warp_x(i)
        n_f, ds = spec.detail(abs(x_i - hero_x))
        L = spec.fringe[i]
        y = np.arange(-spec.width - 0.3, L + 0.05, ds)
        j = (-y - spec.pf / 2) / spec.pf
        j0 = np.floor(j)
        f = j - j0
        s0, s1 = spec.over(i, j0), spec.over(i, j0 + 1)
        c = s0 + (s1 - s0) * (1 - np.cos(np.pi * f)) / 2
        # Son atkıdan sonra kıvrım söner ve iplik masaya iner.
        tail = y > -spec.pf / 2
        fade = 1 - _smooth((y + spec.pf / 2) / (spec.pf / 2 + 0.7))
        c = np.where(tail, spec.over(i, 0) * fade, c)
        z = spec.z_mid + spec.crimp * c + spec.undulation(x_i, y)
        drop = _smooth(y / 0.9)
        z = z * (1 - drop) + (spec.rv_w * 0.85) * drop
        yy = np.maximum(y, 0)
        x = x_i + np.tan(spec.fan[i]) * yy + _wobble(rs, y, 0.12, 1)[0] * _smooth(yy / L) ** 2
        C = np.stack([x, y, z], axis=1)
        s = y
        yv = float(rs.random())
        fib = _yarn_fibres(rs, C, s, spec.rh_w, spec.rv_w, n_f, spec.twist_w, r_f, fringe_s=0.0,
                           fringe_len=L, inner_frac=0.78, yarn=yv)
        for outer, P, rad, yarn in fib:
            strands["warp" if outer else "warp_inner"].append((P, rad, yarn))
        if i == spec.hero:
            meta["hero_yarn"] = C
            meta["hero_yv"] = yv
        hairs = _hairs(rs, C, s, spec.rh_w, spec.rv_w, int(spec.width * (4.5 if n_f > 70 else 1.5)), r_f,
                       0, np.searchsorted(s, -0.4), yv)
        strands["warp"].extend(hairs)
        u = np.clip(y / (0.35 * L), 0, 1)
        scale = 0.8 * (1 - u)
        V, F = _tube(C, np.full(len(C), spec.rh_w), np.full(len(C), spec.rv_w), scale)
        cores["warp"].add(V, F)

    # Kahraman lifi: kahraman ipliğin saçağından ötekilerden uzun çıkar, kâğıdın üstünde kıvrılır.
    # Yakın plan olduğu için eğri değil, gerçek pamuk lifi gibi yassı ve kendi çevresinde bükülen bir şerit.
    Ch = meta["hero_yarn"]
    L = spec.fringe[spec.hero]
    end = L + hero_extra
    y = np.arange(-0.6, end, 0.005)
    xc = np.interp(np.minimum(y, L), Ch[:, 1], Ch[:, 0])
    zc = np.interp(np.minimum(y, L), Ch[:, 1], Ch[:, 2])
    beyond = _smooth((y - 0.4) / (L + hero_extra - 0.4))
    x = xc + 0.34 * np.sin(0.85 * (y - 0.4)) * beyond - 0.1 * beyond
    x = x + 0.09 * np.sin(3.4 * (y - end) + 0.6) * _smooth((y - end + 1.3) / 1.0)
    z = zc + spec.rv_w * 0.7 * (1 - _smooth((y + 0.6) / 1.4))
    arch = 0.05 * np.sin(np.clip((y - L + 0.6) / (hero_extra + 0.6), 0, 1) * math.pi)
    z = np.maximum(z, 0.0105) + arch + 0.022 * _smooth((y - end + 0.45) / 0.45)
    P = np.stack([x, y, z], axis=1)
    meta["hero_obj"] = _ribbon("HeroFibre", P, lib.fibre_ribbon("HeroFibreMat", colours["hero"]))
    meta["hero_tip"] = tuple(P[-1])
    meta["hero_mid"] = tuple(P[int(len(P) * 0.78)])
    meta["hero_path"] = P

    for j in range(spec.n_weft):
        y_j = spec.weft_y(j)
        n_f, ds = spec.detail(abs(y_j) * 1.6)
        n_f = int(n_f * 0.85)
        x = np.arange(spec.x0 - 0.4, spec.x0 + spec.length + 0.4, ds)
        i = (x - spec.x0) / spec.pw
        i0 = np.floor(i)
        f = i - i0
        s0, s1 = -spec.over(i0, j), -spec.over(i0 + 1, j)
        c = s0 + (s1 - s0) * (1 - np.cos(np.pi * f)) / 2
        z = spec.z_mid + spec.crimp * c + spec.undulation(x, y_j)
        yv = y_j + _wobble(rs, x, 0.035, 1)[0]
        C = np.stack([x, yv, z], axis=1)
        yv = float(rs.random())
        fib = _yarn_fibres(rs, C, x, spec.rh_f, spec.rv_f, n_f, spec.twist_f, r_f, yarn=yv)
        strands["weft"].extend((P, rad, yarn) for _, P, rad, yarn in fib)
        hairs = _hairs(rs, C, x, spec.rh_f, spec.rv_f, int(spec.length * (2.0 if j < 8 else 0.6)), r_f,
                       0, len(x) - 1, yv)
        strands["weft"].extend(hairs)
        V, F = _tube(C, np.full(len(C), spec.rh_f), np.full(len(C), spec.rv_f), np.full(len(C), 0.8))
        cores["weft"].add(V, F)

    # Masaya dökülmüş birkaç gevşek lif.
    loose = []
    for _ in range(26):
        p = np.array([rs.uniform(spec.x0, spec.x0 + spec.length), rs.uniform(0.6, 6.0), r_f * 1.15])
        if abs(p[0] - hero_x) < 1.8:
            p[0] += 3.6 * (1 if p[0] >= hero_x else -1)
        d = rs.normal(0, 1, 3)
        d[2] = 0
        d /= np.linalg.norm(d)
        length = rs.uniform(0.8, 3.0)
        m = int(length / 0.03)
        pts = [p]
        bend = rs.normal(0, 0.6)
        for _ in range(m - 1):
            ang = bend * 0.03 + rs.normal(0, 0.04)
            d = np.array([d[0] * math.cos(ang) - d[1] * math.sin(ang), d[0] * math.sin(ang) + d[1] * math.cos(ang), 0])
            q = pts[-1] + d * length / m
            q[2] = r_f * 1.15 + 0.03 * max(0, math.sin(len(pts) * 0.2))
            pts.append(q)
        loose.append((np.array(pts), np.full(m, r_f), float(rs.random())))
    strands["warp_inner"].extend(loose[:14])
    strands["weft"].extend(loose[14:])

    mats = {
        "warp": lib.fibre_hair("FibreWarp", colours["warp"], var=0.3),
        "warp_inner": lib.fibre_hair("FibreWarpInner", colours["warp_inner"], var=0.3),
        "weft": lib.fibre_hair("FibreWeft", colours["weft"], var=0.2, yarn_weight=0.3),
    }
    objs = [lib.curves("Fibres_" + k, v, mats[k]) for k, v in strands.items() if v]
    objs.append(cores["warp"].build("CoreWarp", lib.fibre_diffuse("CoreWarpMat", colours["warp_core"], var=0.15)))
    objs.append(cores["weft"].build("CoreWeft", lib.fibre_diffuse("CoreWeftMat", colours["weft_core"], var=0.15)))
    meta["objects"] = objs
    meta["points"] = sum(len(s[0]) for v in strands.values() for s in v)
    meta["curves"] = sum(len(v) for v in strands.values())
    return meta
